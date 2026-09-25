/**
 * Canvas plumbing shared by the border effects: a viewport-sized canvas
 * with a capped backing-store resolution, plus the "border ring" geometry
 * every effect confines itself to (activity within ~14% of the short side
 * from each edge — an ambient frame, never a full-screen takeover).
 */
import { createCappedLoop } from '../raf-loop'
import type { ActiveTier, BorderEffect, EffectOptions } from './types'

export const FPS: Record<ActiveTier, number> = { high: 30, eco: 24 }

/** Border ring depth as a fraction of the viewport's short side. */
export const BAND_FRACTION = 0.14

export function bandSize(w: number, h: number): number {
  return Math.min(w, h) * BAND_FRACTION
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/**
 * 1 at the screen edge, easing to 0 at `band` px inward. Measured as the
 * Euclidean distance *outside* the inner rect (inset by `band`), not the
 * nearest-edge distance: nearest-edge contours meet at hard 90° corners,
 * which any soft glow clipped by this ring rendered as visible squares in
 * all four corners.
 */
export function edgeFactor(
  x: number,
  y: number,
  w: number,
  h: number,
  band: number
): number {
  const qx = Math.max(0, band - Math.min(x, w - x))
  const qy = Math.max(0, band - Math.min(y, h - y))
  return smoothstep(0, band * 0.7, Math.hypot(qx, qy))
}

/** Uniform-ish random point inside the border ring (rejection sampling, bounded). */
export function randomInBand(
  w: number,
  h: number,
  band: number
): { x: number; y: number } {
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    if (Math.min(x, w - x, y, h - y) < band) return { x, y }
  }
  // Fallback: snap to a random side's band.
  return Math.random() < 0.5
    ? { x: Math.random() * band, y: Math.random() * h }
    : { x: Math.random() * w, y: h - Math.random() * band }
}

export interface LayerCanvasOptions {
  /** Backing store px per CSS px ceiling (before the pixel budget below). */
  maxDpr: number
  /** Total backing-store pixel budget — keeps a 4K TV from costing 4x a laptop. */
  maxPixels: number
  onResize?: (width: number, height: number) => void
}

export interface LayerCanvas {
  canvas: HTMLCanvasElement
  /** Backing-store size in device px (what drawing code uses). */
  width: number
  height: number
  destroy(): void
}

export function createLayerCanvas(
  host: HTMLElement,
  opts: LayerCanvasOptions
): LayerCanvas {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block;'
  host.appendChild(canvas)

  const layer: LayerCanvas = {
    canvas,
    width: 0,
    height: 0,
    destroy() {
      window.removeEventListener('resize', resize)
      canvas.remove()
      // Drop the backing store now rather than whenever GC gets to it.
      canvas.width = 0
      canvas.height = 0
    }
  }

  function resize(): void {
    const cssW = Math.max(1, window.innerWidth)
    const cssH = Math.max(1, window.innerHeight)
    let scale = Math.min(window.devicePixelRatio || 1, opts.maxDpr)
    const budget = Math.sqrt(opts.maxPixels / (cssW * cssH))
    scale = Math.min(scale, budget)
    const w = Math.max(1, Math.round(cssW * scale))
    const h = Math.max(1, Math.round(cssH * scale))
    if (w === layer.width && h === layer.height) return
    canvas.width = w
    canvas.height = h
    layer.width = w
    layer.height = h
    opts.onResize?.(w, h)
  }

  window.addEventListener('resize', resize)
  resize()
  return layer
}

/**
 * Alpha mask of the border ring at the canvas's resolution, for effects
 * that draw soft shapes freely and then clip with `destination-in`. Built
 * per pixel once per resize — only used on low-resolution glow layers,
 * where that's a few hundred thousand pixels at most.
 */
export function createRingMask(
  w: number,
  h: number,
  band: number
): HTMLCanvasElement {
  const mask = document.createElement('canvas')
  mask.width = w
  mask.height = h
  const ctx = mask.getContext('2d')
  if (!ctx) return mask
  const img = ctx.createImageData(w, h)
  const data = img.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = edgeFactor(x + 0.5, y + 0.5, w, h, band)
      data[(y * w + x) * 4 + 3] = Math.round(a * 255)
    }
  }
  ctx.putImageData(img, 0, 0)
  return mask
}

/** Pre-renders a sprite once so per-frame drawing is a cheap `drawImage` blit. */
export function makeSprite(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  const ctx = c.getContext('2d')
  if (ctx) draw(ctx)
  return c
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export interface Scene2d {
  /** Called on mount and on every viewport resize, in backing-store px. */
  resize(w: number, h: number, band: number): void
  /** `t`/`dt` in seconds. The canvas is already cleared. */
  draw(ctx: CanvasRenderingContext2D, t: number, dt: number): void
  /** Drawn after the ring mask, for shapes that must keep their own silhouette (a round sun bloom clipped by the ring reads as a box). */
  drawOver?(ctx: CanvasRenderingContext2D, t: number): void
}

export interface Canvas2dSpec {
  fps: number
  maxDpr: number
  maxPixels: number
  /** Clip every frame to the border ring — for scenes that draw soft shapes freely. */
  ringMask?: boolean
}

/** Canvas + capped loop + teardown plumbing for every Canvas2D effect, so each module is only its scene. */
export function createCanvas2dEffect(
  specFor: (opts: EffectOptions) => Canvas2dSpec,
  makeScene: (opts: EffectOptions) => Scene2d
): BorderEffect {
  let teardown: (() => void) | null = null

  return {
    mount(host, opts) {
      if (teardown) return
      const spec = specFor(opts)
      const scene = makeScene(opts)
      let mask: HTMLCanvasElement | null = null
      const layer = createLayerCanvas(host, {
        maxDpr: spec.maxDpr,
        maxPixels: spec.maxPixels,
        onResize(w, h) {
          const band = bandSize(w, h)
          if (spec.ringMask) mask = createRingMask(w, h, band)
          scene.resize(w, h, band)
        }
      })
      layer.canvas.dataset.renderer = '2d'
      const ctx = layer.canvas.getContext('2d')
      if (!ctx) {
        layer.destroy()
        return
      }
      let t = Math.random() * 600
      const loop = createCappedLoop(spec.fps, (deltaMs) => {
        const dt = deltaMs / 1000
        t += dt
        ctx.globalCompositeOperation = 'source-over'
        ctx.clearRect(0, 0, layer.width, layer.height)
        scene.draw(ctx, t, dt)
        if (mask) {
          ctx.globalCompositeOperation = 'destination-in'
          ctx.drawImage(mask, 0, 0)
          ctx.globalCompositeOperation = 'source-over'
        }
        scene.drawOver?.(ctx, t)
      })
      loop.start()
      teardown = () => {
        loop.stop()
        layer.destroy()
        mask = null
      }
    },
    unmount() {
      teardown?.()
      teardown = null
    }
  }
}

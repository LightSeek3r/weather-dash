/**
 * Canvas plumbing shared by the weather effects: a viewport-sized canvas
 * with a capped backing-store resolution, a seedable random source, and the
 * "presence field" every effect is clipped by.
 *
 * The presence field is where on screen an effect may show, 0..1: strongest
 * along the edges (the frame still reads as a window), a per-effect floor
 * everywhere else so weather fills the whole sky, and quiet behind the
 * layout's glass panels (lib/fx/calm-zones.ts). It's a coarse grid (≤128
 * cells on the long side), so it's cheap to rebuild whenever the layout
 * moves, and doubles as a tiny alpha mask canvas that upscales smoothly for
 * `destination-in` clipping.
 *
 * Effects may also draw a few "near" elements into a front canvas that sits
 * above the page text (BorderFx.svelte's front host). Its own field cuts the
 * glass panels out entirely, so nothing ever paints over a card.
 */
import { createCappedLoop } from '../raf-loop'
import {
  CALM_FEATHER,
  calmAt,
  clearAt,
  measureCalmZones,
  watchCalmZones,
  zonesSignature,
  type CalmZone
} from '../calm-zones'
import type { ActiveTier, BorderEffect, EffectOptions } from './types'

export const FPS: Record<ActiveTier, number> = { high: 30, eco: 24 }

/** Size unit for particles/sprites (and the old border-ring depth), as a fraction of the viewport's short side. */
export const BAND_FRACTION = 0.14

/** Depth of the edge-emphasis ramp of the presence field, as a fraction of the short side. */
export const EDGE_FRACTION = 0.24

export function bandSize(w: number, h: number): number {
  return Math.min(w, h) * BAND_FRACTION
}

/**
 * Detail unit for particle sizes/line widths, ~1/700 of the short side.
 * Derived from `band` (backing-store px) so a drop is the same size on
 * screen whatever the canvas's downscale — a fixed "1 backing px" floor
 * shrinks to a hairline on a canvas rendered at 0.6x.
 */
export function detailUnit(band: number): number {
  return Math.max(0.75, band / 100)
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

// --- Random source ---------------------------------------------------------

/** mulberry32 (public domain) — tiny, fast, good enough for particle layouts. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let seeded: (() => number) | null = null

/** Every effect draws its randomness from here, so a frozen render can replay the exact same scene. `null` restores Math.random. */
export function seedRandom(seed: number | null): void {
  seeded = seed === null ? null : mulberry32(seed)
}

export function random(): number {
  return seeded ? seeded() : Math.random()
}

export function rand(min: number, max: number): number {
  return min + random() * (max - min)
}

// --- Layer canvas ----------------------------------------------------------

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

/** A full-host canvas with no sizing of its own (createLayerCanvas sizes one; a front canvas mirrors its layer's size). */
export function appendCanvas(host: HTMLElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block;'
  host.appendChild(canvas)
  return canvas
}

/** Removes a canvas and drops its backing store now rather than whenever GC gets to it. */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.remove()
  canvas.width = 0
  canvas.height = 0
}

export function createLayerCanvas(
  host: HTMLElement,
  opts: LayerCanvasOptions
): LayerCanvas {
  const canvas = appendCanvas(host)

  const layer: LayerCanvas = {
    canvas,
    width: 0,
    height: 0,
    destroy() {
      window.removeEventListener('resize', resize)
      releaseCanvas(canvas)
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

// --- Presence field --------------------------------------------------------

const FIELD_CELLS = 128

export interface PresenceField {
  /** Grid spacing in backing-store px. */
  cell: number
  cols: number
  rows: number
  /** Presence 0..1 at backing-store px (bilinear between grid samples). */
  at(x: number, y: number): number
  /** `cols`×`rows` alpha mask (white, alpha = presence); see drawPresenceMask. */
  mask: HTMLCanvasElement
}

/**
 * @param floor presence away from the edges and calm zones (1 = no edge bias).
 * @param cssScale backing-store px per CSS px (zones are in CSS px).
 * @param sample zone multiplier: `calmAt` behind the page, `clearAt` in front of it.
 */
export function buildPresenceField(
  w: number,
  h: number,
  floor: number,
  zones: CalmZone[],
  cssScale: number,
  sample: typeof calmAt = calmAt
): PresenceField {
  const cell = Math.max(1, Math.max(w, h) / FIELD_CELLS)
  const cols = Math.ceil(w / cell) + 1
  const rows = Math.ceil(h / cell) + 1
  const values = new Float32Array(cols * rows)
  const edgeBand = Math.min(w, h) * EDGE_FRACTION
  const s = cssScale > 0 ? cssScale : 1
  const feather = (Math.min(w, h) / s) * CALM_FEATHER
  for (let j = 0; j < rows; j++) {
    const y = Math.min(h, j * cell)
    for (let i = 0; i < cols; i++) {
      const x = Math.min(w, i * cell)
      const edge = floor >= 1 ? 1 : edgeFactor(x, y, w, h, edgeBand)
      const base = floor + (1 - floor) * edge
      values[j * cols + i] = base * sample(zones, x / s, y / s, feather)
    }
  }

  const mask = document.createElement('canvas')
  mask.width = cols
  mask.height = rows
  const mctx = mask.getContext('2d')
  if (mctx) {
    const img = mctx.createImageData(cols, rows)
    const data = img.data
    for (let k = 0; k < values.length; k++) {
      data[k * 4] = 255
      data[k * 4 + 1] = 255
      data[k * 4 + 2] = 255
      data[k * 4 + 3] = Math.round(values[k] * 255)
    }
    mctx.putImageData(img, 0, 0)
  }

  return {
    cell,
    cols,
    rows,
    mask,
    at(x, y) {
      const gx = Math.min(cols - 1.001, Math.max(0, x / cell))
      const gy = Math.min(rows - 1.001, Math.max(0, y / cell))
      const i = Math.floor(gx)
      const j = Math.floor(gy)
      const fx = gx - i
      const fy = gy - j
      const k = j * cols + i
      const top = values[k] + (values[k + 1] - values[k]) * fx
      const bot =
        values[k + cols] + (values[k + cols + 1] - values[k + cols]) * fx
      return top + (bot - top) * fy
    }
  }
}

/** Clips everything drawn so far to the field (grid samples sit on cell corners, hence the half-cell offset). */
export function drawPresenceMask(
  ctx: CanvasRenderingContext2D,
  field: PresenceField
): void {
  const c = field.cell
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(field.mask, -c / 2, -c / 2, field.cols * c, field.rows * c)
  ctx.globalCompositeOperation = 'source-over'
}

// Layout rarely moves without a resize/ResizeObserver signal, but the page's
// pixel-shift transform does, and ResizeObserver can't see transforms.
const REMEASURE_S = 5

export interface FieldTracker {
  readonly field: PresenceField | null
  /** Front-layer field (glass cut out, no edge bias); null unless built `withFront`. */
  readonly front: PresenceField | null
  /** Backing-store size changed: re-measure and rebuild. */
  resize(w: number, h: number): void
  /** Frame-loop hook for the periodic re-measure. */
  tick(dt: number): void
  destroy(): void
}

/** Keeps a presence field in sync with the layout; `onChange` fires after a zone-driven rebuild (not after `resize`). */
export function createFieldTracker(
  floor: number,
  onChange: () => void,
  withFront = false
): FieldTracker {
  let w = 0
  let h = 0
  let zones: CalmZone[] = []
  let sig = ''
  let since = 0
  let field: PresenceField | null = null
  let front: PresenceField | null = null

  function measure(): void {
    zones = measureCalmZones(document)
    sig = zonesSignature(zones)
  }
  function rebuild(): void {
    if (w <= 0 || h <= 0) return
    const scale = w / Math.max(1, window.innerWidth)
    field = buildPresenceField(w, h, floor, zones, scale)
    if (withFront) front = buildPresenceField(w, h, 1, zones, scale, clearAt)
  }
  function recheck(): void {
    const prev = sig
    measure()
    if (sig === prev || w <= 0) return
    rebuild()
    onChange()
  }

  const unwatch = watchCalmZones(recheck)
  return {
    get field() {
      return field
    },
    get front() {
      return front
    },
    resize(nw, nh) {
      w = nw
      h = nh
      measure()
      rebuild()
    },
    tick(dt) {
      since += dt
      if (since < REMEASURE_S) return
      since = 0
      recheck()
    },
    destroy() {
      unwatch()
      field = null
      front = null
    }
  }
}

// --- Frozen (deterministic) rendering ---------------------------------------

/**
 * `?freeze=1` (lib/core/debug-params.ts) renders one reproducible frame and
 * never starts a loop: the same seed, the same simulated warm-up (so
 * particles are spread out, not all at their spawn points) and the same
 * clock every time — visual baselines stay pixel-stable.
 */
export const FROZEN_SEED = 0x5eed
export const FROZEN_T = 120
export const FROZEN_STEPS = 60
export const FROZEN_DT = 1 / 30

// --- Canvas2D effect scaffold ------------------------------------------------

export interface SceneEnv {
  /** Presence 0..1 at backing-store px — for skipping/recycling particles nobody can see. */
  presence(x: number, y: number): number
}

export interface Scene2d {
  /** Called on mount and on every viewport resize, in backing-store px. `band` is the particle size unit. */
  resize(w: number, h: number, band: number): void
  /**
   * `t`/`dt` in seconds. Both canvases are already cleared; the presence
   * masks are applied afterwards. `front` (same size as `ctx`) is where the
   * scene's near elements go when the effect has a front layer — null when
   * it doesn't, in which case those elements belong on `ctx`.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    dt: number,
    front: CanvasRenderingContext2D | null
  ): void
}

export interface Canvas2dSpec {
  fps: number
  maxDpr: number
  maxPixels: number
  /** Presence away from the edges (see buildPresenceField). */
  floor: number
  /** The scene draws near elements in front of the page when mounted with `opts.front`. */
  front?: boolean
}

/** Canvas + capped loop + presence mask + teardown plumbing for every Canvas2D effect, so each module is only its scene. */
export function createCanvas2dEffect(
  specFor: (opts: EffectOptions) => Canvas2dSpec,
  makeScene: (opts: EffectOptions, env: SceneEnv) => Scene2d
): BorderEffect {
  let teardown: (() => void) | null = null

  return {
    mount(host, opts) {
      if (teardown) return
      const spec = specFor(opts)
      const env: SceneEnv = {
        presence: (x, y) => tracker.field?.at(x, y) ?? 1
      }
      let ctx: CanvasRenderingContext2D | null = null
      let fctx: CanvasRenderingContext2D | null = null
      let scene: Scene2d | null = null
      let w = 0
      let h = 0
      let t = random() * 600

      function frame(dt: number): void {
        if (!ctx || !scene) return
        for (const c of fctx ? [ctx, fctx] : [ctx]) {
          c.globalCompositeOperation = 'source-over'
          c.globalAlpha = 1
          c.clearRect(0, 0, w, h)
        }
        scene.draw(ctx, t, dt, fctx)
        ctx.globalAlpha = 1
        if (tracker.field) drawPresenceMask(ctx, tracker.field)
        if (fctx) {
          fctx.globalAlpha = 1
          if (tracker.front) drawPresenceMask(fctx, tracker.front)
        }
      }

      function renderFrozen(): void {
        if (!ctx) return
        seedRandom(FROZEN_SEED)
        try {
          scene = makeScene(opts, env)
          scene.resize(w, h, bandSize(w, h))
          t = FROZEN_T
          for (let i = 0; i < FROZEN_STEPS; i++) {
            t += FROZEN_DT
            frame(FROZEN_DT)
          }
        } finally {
          seedRandom(null)
        }
      }

      const frontHost = spec.front ? opts.front : undefined
      const tracker = createFieldTracker(
        spec.floor,
        () => {
          if (opts.frozen) renderFrozen()
        },
        !!frontHost
      )
      // Created before the layer so the layer's first onResize sizes it too.
      const frontCanvas = frontHost ? appendCanvas(frontHost) : null
      const layer = createLayerCanvas(host, {
        maxDpr: spec.maxDpr,
        maxPixels: spec.maxPixels,
        onResize(nw, nh) {
          w = nw
          h = nh
          if (frontCanvas) {
            frontCanvas.width = nw
            frontCanvas.height = nh
          }
          tracker.resize(nw, nh)
          if (opts.frozen) renderFrozen()
          else scene?.resize(nw, nh, bandSize(nw, nh))
        }
      })
      layer.canvas.dataset.renderer = '2d'
      ctx = layer.canvas.getContext('2d')
      if (frontCanvas) {
        frontCanvas.dataset.renderer = '2d'
        fctx = frontCanvas.getContext('2d')
      }
      const release = (): void => {
        tracker.destroy()
        layer.destroy()
        if (frontCanvas) releaseCanvas(frontCanvas)
      }
      if (!ctx) {
        release()
        return
      }

      if (opts.frozen) {
        renderFrozen()
        teardown = release
        return
      }

      scene = makeScene(opts, env)
      scene.resize(w, h, bandSize(w, h))
      const loop = createCappedLoop(spec.fps, (deltaMs) => {
        const dt = deltaMs / 1000
        t += dt
        tracker.tick(dt)
        frame(dt)
      })
      loop.start()
      teardown = () => {
        loop.stop()
        release()
      }
    },
    unmount() {
      teardown?.()
      teardown = null
    }
  }
}

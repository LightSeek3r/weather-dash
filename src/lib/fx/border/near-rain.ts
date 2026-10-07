/**
 * Near rain: a sparse population of long, fast, soft streaks falling in
 * front of the page text — rain close to the viewer, outside the window.
 * Shared by both renderers: rain-eco draws it into its own front canvas,
 * rain-webgl into a small Canvas2D overlay (one GL context can't draw two
 * canvases). Same wind slant as the rain behind, faster for parallax, and
 * dimmer: out of focus, and over the clock it must never read as a scratch.
 */
import { detailUnit, makeSprite, rand, smoothstep } from './common'
import type { EffectOptions } from './types'

/** Vertical streak, transparent tail at the top, bright head at the bottom. */
export function streakSprite(): HTMLCanvasElement {
  return makeSprite(8, 128, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, 'rgba(200, 228, 255, 0)')
    g.addColorStop(0.75, 'rgba(214, 236, 255, 0.55)')
    g.addColorStop(1, 'rgba(240, 248, 255, 1)')
    ctx.fillStyle = g
    ctx.fillRect(2, 0, 4, 128)
    ctx.fillStyle = 'rgba(240, 248, 255, 0.35)'
    ctx.fillRect(0, 96, 8, 32)
  })
}

export function isDrizzleOpts(opts: EffectOptions): boolean {
  return (
    opts.conditionKey === 'drizzle' || opts.conditionKey === 'freezingDrizzle'
  )
}

/** Wind slant (radians) shared by every rain layer: steeper the heavier it rains. */
export function rainSlant(opts: EffectOptions): number {
  const heavy = isDrizzleOpts(opts) ? 0 : smoothstep(0.5, 1, opts.density)
  return -(isDrizzleOpts(opts) ? 0.03 : 0.05 + 0.13 * heavy)
}

interface NearStreak {
  x: number
  y: number
  len: number
  v: number
  alpha: number
  width: number
}

export interface NearRain {
  resize(w: number, h: number, band: number): void
  draw(ctx: CanvasRenderingContext2D, dt: number): void
}

export function createNearRain(opts: EffectOptions): NearRain {
  const isDrizzle = isDrizzleOpts(opts)
  const d = opts.density
  const heavy = isDrizzle ? 0 : smoothstep(0.5, 1, d)
  const tierScale = opts.tier === 'high' ? 1 : 0.7
  const target = Math.round(tierScale * (isDrizzle ? 6 + 8 * d : 10 + 30 * d))
  const slant = rainSlant(opts)
  const cosS = Math.cos(slant)
  const sinS = Math.sin(slant)
  const img = streakSprite()
  let w = 0
  let h = 0
  let band = 0
  let px = 1
  let streaks: NearStreak[] = []

  function spawn(anywhere: boolean): NearStreak {
    const len =
      band * (isDrizzle ? rand(0.3, 0.5) : rand(0.9, 1.4) + 1.2 * heavy)
    return {
      x: rand(-0.2, 1.2) * w,
      y: anywhere ? rand(-len, h) : -rand(len, len + h * 0.5),
      len,
      v:
        h * (isDrizzle ? rand(0.6, 0.9) : rand(1.3, 1.8) * (0.9 + 1.1 * heavy)),
      alpha: isDrizzle ? rand(0.16, 0.26) : rand(0.26, 0.4) + 0.1 * heavy,
      width: (isDrizzle ? rand(1.6, 2.4) : rand(2.6, 4) + 1.6 * heavy) * px
    }
  }

  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
      px = detailUnit(band)
      streaks = Array.from({ length: target }, () => spawn(true))
    },
    draw(ctx, dt) {
      ctx.save()
      // Rotated by the wind slant about the top centre, like the rain behind.
      ctx.setTransform(
        cosS,
        sinS,
        -sinS,
        cosS,
        w / 2 - (cosS * w) / 2,
        (-sinS * w) / 2
      )
      for (let i = 0; i < streaks.length; i++) {
        const s = streaks[i]
        s.y += s.v * dt
        if (sinS * (s.x - w / 2) + cosS * (s.y - s.len) > h) {
          streaks[i] = spawn(false)
          continue
        }
        ctx.globalAlpha = s.alpha
        ctx.drawImage(img, s.x - s.width, s.y - s.len, s.width * 2, s.len)
      }
      ctx.restore()
      ctx.globalAlpha = 1
    }
  }
}

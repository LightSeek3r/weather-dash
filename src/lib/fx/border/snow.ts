/**
 * Snow: flakes drifting down the side bands of the frame (and a lighter
 * scatter across the top that fades before reaching the content), in three
 * depth layers — small/slow/dim far flakes, large/soft near ones. A faint
 * frost settles along the bottom edge.
 */
import {
  FPS,
  createCanvas2dEffect,
  edgeFactor,
  makeSprite,
  rand,
  type Scene2d
} from './common'
import type { BorderEffect, EffectOptions } from './types'

interface Flake {
  x: number
  y: number
  x0: number
  size: number
  vy: number
  sway: number
  swayFreq: number
  phase: number
  alpha: number
}

const SPRITE = 32

function snowScene(opts: EffectOptions): Scene2d {
  let w = 0
  let h = 0
  let band = 0
  let px = 1
  let flakes: Flake[] = []
  let frost: CanvasGradient | null = null
  const count = Math.round(
    (opts.tier === 'high' ? 170 : 85) * (0.4 + 0.6 * opts.density)
  )
  const sprite = makeSprite(SPRITE, SPRITE, (ctx) => {
    const c = SPRITE / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, c)
    g.addColorStop(0, 'rgba(238, 244, 251, 1)')
    g.addColorStop(0.35, 'rgba(238, 244, 251, 0.7)')
    g.addColorStop(1, 'rgba(214, 232, 250, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SPRITE, SPRITE)
  })

  function spawn(anywhereY = false): Flake {
    const depth = Math.random()
    const near = depth >= 0.9
    const size =
      (depth < 0.55 ? rand(3, 5) : near ? rand(10, 16) : rand(5, 8)) * px
    // Three quarters fall inside the side bands; the rest cross the top
    // band anywhere and fade out as they leave the ring.
    const side = Math.random() < 0.75
    const x0 = side
      ? Math.random() < 0.5
        ? rand(0, band * 0.9)
        : w - rand(0, band * 0.9)
      : rand(0, w)
    return {
      x: x0,
      x0,
      y: anywhereY ? rand(0, h) : -size - rand(0, band),
      size,
      vy: band * (0.35 + size / (16 * px)) * rand(0.8, 1.2),
      sway: band * rand(0.05, 0.15),
      swayFreq: rand(0.15, 0.4),
      phase: rand(0, Math.PI * 2),
      // Near flakes are big and out of focus — softer, not brighter.
      alpha: near ? rand(0.25, 0.45) : rand(0.5, 0.9)
    }
  }

  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
      px = Math.max(1, Math.min(w, h) / 900)
      flakes = Array.from({ length: count }, () => spawn(true))
      frost = null
    },
    draw(ctx, t, dt) {
      if (!frost) {
        frost = ctx.createLinearGradient(0, h, 0, h - band * 0.6)
        frost.addColorStop(0, 'rgba(238, 244, 251, 0.1)')
        frost.addColorStop(1, 'rgba(238, 244, 251, 0)')
      }
      ctx.fillStyle = frost
      ctx.fillRect(0, h - band * 0.6, w, band * 0.6)

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i]
        f.y += f.vy * dt
        f.x = f.x0 + Math.sin(t * f.swayFreq * Math.PI * 2 + f.phase) * f.sway
        const e = edgeFactor(f.x, Math.max(f.y, 0), w, h, band)
        // Centre-crossing flakes are invisible once past the top band — recycle early.
        if (f.y > h + f.size || (e === 0 && f.y > band * 1.2)) {
          flakes[i] = spawn()
          continue
        }
        const a = f.alpha * e
        if (a < 0.02) continue
        ctx.globalAlpha = a
        ctx.drawImage(
          sprite,
          f.x - f.size / 2,
          f.y - f.size / 2,
          f.size,
          f.size
        )
      }
      ctx.globalAlpha = 1
    }
  }
}

export function createEffect(): BorderEffect {
  return createCanvas2dEffect(
    (o) => ({
      fps: FPS[o.tier],
      maxDpr: o.tier === 'high' ? 2 : 1,
      maxPixels: o.tier === 'high' ? 3_000_000 : 1_000_000
    }),
    snowScene
  )
}

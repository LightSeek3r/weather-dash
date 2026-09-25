/**
 * Fog: pale, slow wisps drifting both ways along the frame over a faint
 * standing haze, heavier along the bottom edge where fog settles. Like the
 * cloud shadows it draws freely at low resolution and relies on the ring
 * mask for confinement.
 */
import { createCanvas2dEffect, rand, type Scene2d } from './common'
import type { BorderEffect, EffectOptions } from './types'

interface Wisp {
  x: number
  y: number
  r: number
  stretch: number
  vx: number
  alpha: number
  period: number
  phase: number
}

function makeWisp(w: number, h: number, band: number): Wisp {
  const roll = Math.random()
  // Half the wisps hug the bottom edge, a fifth the top, the rest anywhere
  // (only visible where the ring mask lets them through on the sides).
  const y =
    roll < 0.5
      ? h - rand(0, band * 0.9)
      : roll < 0.7
        ? rand(0, band * 0.7)
        : rand(0, h)
  return {
    x: rand(0, w),
    y,
    r: band * rand(0.5, 1.1),
    stretch: rand(2.4, 4.5),
    vx: band * rand(0.012, 0.035) * (Math.random() < 0.5 ? -1 : 1),
    alpha: rand(0.07, 0.14),
    period: rand(18, 40),
    phase: rand(0, Math.PI * 2)
  }
}

function fogScene(opts: EffectOptions): Scene2d {
  let w = 0
  let h = 0
  let band = 0
  let wisps: Wisp[] = []
  let haze: CanvasGradient | null = null
  const count = opts.tier === 'high' ? 16 : 9

  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
      wisps = Array.from({ length: count }, () => makeWisp(w, h, band))
      haze = null
    },
    draw(ctx, t, dt) {
      if (!haze) {
        haze = ctx.createLinearGradient(0, 0, 0, h)
        haze.addColorStop(0, 'rgba(149, 169, 189, 0.07)')
        haze.addColorStop(0.6, 'rgba(149, 169, 189, 0.05)')
        haze.addColorStop(1, 'rgba(149, 169, 189, 0.16)')
      }
      ctx.fillStyle = haze
      ctx.fillRect(0, 0, w, h)

      for (const p of wisps) {
        p.x += p.vx * dt
        const span = p.r * p.stretch
        if (p.x > w + span) p.x = -span
        else if (p.x < -span) p.x = w + span
        const a =
          p.alpha *
          (0.55 + 0.45 * Math.sin((t * Math.PI * 2) / p.period + p.phase))
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.scale(p.stretch, 1)
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r)
        g.addColorStop(0, `rgba(205, 220, 234, ${a})`)
        g.addColorStop(0.5, `rgba(189, 205, 221, ${a * 0.5})`)
        g.addColorStop(1, 'rgba(189, 205, 221, 0)')
        ctx.fillStyle = g
        ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2)
        ctx.restore()
      }
    }
  }
}

export function createEffect(): BorderEffect {
  return createCanvas2dEffect(
    (o) => ({
      fps: o.tier === 'high' ? 20 : 12,
      maxDpr: o.tier === 'high' ? 0.5 : 0.33,
      maxPixels: o.tier === 'high' ? 400_000 : 160_000,
      ringMask: true
    }),
    fogScene
  )
}

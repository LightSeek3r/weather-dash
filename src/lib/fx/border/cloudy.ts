/**
 * Cloudy: a field of soft cloud shadows sliding across the window on a
 * steady wind, visible only where it crosses the border ring (clipped by
 * the shared ring mask) — so a shadow drifts in on one edge and out the
 * other, the way real overcast light moves across a window frame.
 *
 * `conditionKey` (see types.ts) splits this one module into two readings
 * of the same scene rather than a second file: `partlyCloudy` gets fewer,
 * lighter puffs with a brighter sunlit rim (sun bleeding through gaps),
 * `overcast` gets a fuller, flatter, more uniform grey field. Everything
 * else — motion, puff shapes, the ring mask — is shared.
 */
import { createCanvas2dEffect, rand, type Scene2d } from './common'
import type { BorderEffect, EffectOptions } from './types'

interface Puff {
  dx: number
  dy: number
  r: number
}

interface Cloud {
  x: number
  y: number
  r: number
  speed: number
  puffs: Puff[]
  phase: number
}

function makeCloud(w: number, h: number, band: number, x?: number): Cloud {
  const r = band * rand(0.9, 1.7)
  return {
    x: x ?? rand(-r, w + r),
    y: rand(-band * 0.3, h + band * 0.3),
    r,
    speed: band * rand(0.025, 0.05),
    phase: rand(0, Math.PI * 2),
    puffs: Array.from({ length: 3 }, () => ({
      dx: rand(-0.7, 0.7),
      dy: rand(-0.3, 0.3),
      r: rand(0.55, 0.9)
    }))
  }
}

function cloudyScene(opts: EffectOptions): Scene2d {
  let w = 0
  let h = 0
  let band = 0
  let clouds: Cloud[] = []
  // Partly-cloudy: sparser, lighter shadows with more sun bleeding through.
  // Overcast: a fuller, flatter, more uniform grey field. Both variants
  // still scale up with density (a heavier overcast day vs a hazy one).
  const partly = opts.conditionKey === 'partlyCloudy'
  const baseCount = opts.tier === 'high' ? 16 : 12
  const count = Math.round(
    (partly ? baseCount * 0.6 : baseCount) * (0.7 + 0.3 * opts.density)
  )
  const shadowAlpha = partly ? 0.32 : 0.5
  const rimAlpha = partly ? 0.1 : 0.06

  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
      clouds = Array.from({ length: count }, () => makeCloud(w, h, band))
    },
    draw(ctx, t, dt) {
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i]
        c.x += c.speed * dt
        if (c.x - c.r * 1.8 > w) {
          clouds[i] = makeCloud(w, h, band, -clouds[i].r * 1.8)
          continue
        }
        const depth = 0.75 + 0.25 * Math.sin(t / 19 + c.phase)
        for (const p of c.puffs) {
          const px = c.x + p.dx * c.r
          const py = c.y + p.dy * c.r
          const pr = c.r * p.r
          const g = ctx.createRadialGradient(px, py, 0, px, py, pr)
          g.addColorStop(0, `rgba(3, 9, 18, ${shadowAlpha * depth})`)
          g.addColorStop(0.6, `rgba(5, 12, 22, ${shadowAlpha * 0.43 * depth})`)
          g.addColorStop(1, 'rgba(5, 12, 22, 0)')
          ctx.fillStyle = g
          ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2)
        }
        // Sunlit upper rim — keeps the shadows readable on an already-dark
        // sky, and (for partly-cloudy) reads as sun bleeding through gaps.
        const rx = c.x - c.r * 0.2
        const ry = c.y - c.r * 0.55
        const rr = c.r * 0.8
        const g = ctx.createRadialGradient(rx, ry, rr * 0.4, rx, ry, rr)
        g.addColorStop(0, 'rgba(189, 205, 221, 0)')
        g.addColorStop(0.75, `rgba(189, 205, 221, ${rimAlpha * depth})`)
        g.addColorStop(1, 'rgba(189, 205, 221, 0)')
        ctx.fillStyle = g
        ctx.fillRect(rx - rr, ry - rr, rr * 2, rr * 2)
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
    cloudyScene
  )
}

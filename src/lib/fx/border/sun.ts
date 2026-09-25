/**
 * Clear day: the sun sits just past the top-right corner and lights the
 * frame from there. One radial light field (masked to the border ring)
 * gilds the top and right edges and fades toward the far corner — a single
 * field rather than per-edge washes, whose overlaps summed into bright
 * squares at the corners. Slow god rays sweep through that field, warm
 * motes drift in it, and the sun itself is an unmasked round bloom so the
 * ring can't clip it into a box. Soft shapes only, so it renders at a
 * fraction of screen resolution (the upscale blur is part of the look) and
 * at a low frame rate.
 */
import {
  createCanvas2dEffect,
  makeSprite,
  rand,
  randomInBand,
  type Scene2d
} from './common'
import type { BorderEffect, EffectOptions } from './types'

const TAU = Math.PI * 2

interface Mote {
  x: number
  y: number
  vx: number
  vy: number
  phase: number
  size: number
}

function radial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stops: [number, string][]
): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  for (const [at, color] of stops) g.addColorStop(at, color)
  return g
}

/** Fills only the gradient's bounding square — every stop list here ends transparent, so the square's corners stay invisible. */
function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stops: [number, string][]
): void {
  ctx.fillStyle = radial(ctx, x, y, r, stops)
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function sunScene(opts: EffectOptions): Scene2d {
  const moteCount = opts.tier === 'high' ? 40 : 18
  let w = 0
  let h = 0
  let band = 0
  let reach = 0
  let motes: Mote[] = []
  let moteSprite: HTMLCanvasElement | null = null
  // Uneven ray widths so the sweep never reads as a regular pinwheel.
  const rays: [number, number][] = []
  for (let a = 0; a < 1;) {
    const width = rand(0.012, 0.035)
    rays.push([a, rand(0.35, 1)])
    a += width + rand(0.01, 0.04)
  }

  function sun(t: number): { x: number; y: number } {
    return {
      x: w + band * 0.1 + Math.sin(t / 37) * band * 0.25,
      y: -band * 0.15 + Math.cos(t / 41) * band * 0.15
    }
  }

  function spawnMote(): Mote {
    const p = randomInBand(w, h, band)
    return {
      x: p.x,
      y: p.y,
      vx: rand(-0.04, 0.04) * band,
      vy: rand(-0.06, -0.01) * band,
      phase: rand(0, TAU),
      size: rand(0.02, 0.05) * band
    }
  }

  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
      reach = Math.hypot(w, h) * 0.85
      motes = Array.from({ length: moteCount }, spawnMote)
      const s = Math.max(4, band * 0.12)
      moteSprite = makeSprite(s, s, (c) => {
        c.fillStyle = radial(c, s / 2, s / 2, s / 2, [
          [0, 'rgba(255, 244, 220, 1)'],
          [0.4, 'rgba(255, 214, 160, 0.5)'],
          [1, 'rgba(255, 200, 140, 0)']
        ])
        c.fillRect(0, 0, s, s)
      })
    },
    draw(ctx, t, dt) {
      const breathe = 0.85 + 0.15 * Math.sin((t * TAU) / 23)
      const { x: sx, y: sy } = sun(t)

      // Rays first: the destination-in falloff below would erase anything
      // drawn before it. createConicGradient is missing on pre-2022
      // engines — those simply get no rays.
      if (typeof ctx.createConicGradient === 'function') {
        const cg = ctx.createConicGradient(t / 90, sx, sy)
        for (const [at, strength] of rays) {
          const a = 0.2 * strength * breathe
          cg.addColorStop(at, 'rgba(255, 222, 170, 0)')
          cg.addColorStop(Math.min(1, at + 0.008), `rgba(255, 222, 170, ${a})`)
          cg.addColorStop(Math.min(1, at + 0.02), 'rgba(255, 222, 170, 0)')
        }
        ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = cg
        ctx.fillRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'destination-in'
        ctx.fillStyle = radial(ctx, sx, sy, reach * 0.7, [
          [0, 'rgba(0, 0, 0, 1)'],
          [0.5, 'rgba(0, 0, 0, 0.45)'],
          [1, 'rgba(0, 0, 0, 0)']
        ])
        ctx.fillRect(0, 0, w, h)
      }

      ctx.globalCompositeOperation = 'lighter'
      // The light field: brightest on the edges nearest the sun, still a
      // warm tint by the far corner so the whole frame reads sunlit.
      ctx.fillStyle = radial(ctx, sx, sy, reach, [
        [0, `rgba(255, 240, 210, ${0.95 * breathe})`],
        [0.12, `rgba(255, 214, 160, ${0.62 * breathe})`],
        [0.38, `rgba(255, 190, 130, ${0.3 * breathe})`],
        [0.7, `rgba(255, 176, 124, ${0.14 * breathe})`],
        [1, 'rgba(255, 170, 120, 0.06)']
      ])
      ctx.fillRect(0, 0, w, h)

      // Light leak smeared along the top edge, sweeping back and forth.
      const lx = w * (0.5 + 0.15 * Math.sin(t / 29))
      ctx.save()
      ctx.translate(lx, 0)
      ctx.scale(4, 1)
      glow(ctx, 0, 0, band * 1.1, [
        [0, `rgba(255, 206, 150, ${0.3 * breathe})`],
        [1, 'rgba(255, 190, 140, 0)']
      ])
      ctx.restore()

      if (moteSprite) {
        for (const m of motes) {
          m.x += m.vx * dt
          m.y += m.vy * dt
          if (m.y < -m.size || m.x < -m.size || m.x > w + m.size) {
            Object.assign(m, spawnMote())
            m.y = Math.min(h, m.y + band * 0.5)
          }
          const near = 1 - Math.min(1, Math.hypot(m.x - sx, m.y - sy) / reach)
          const twinkle = 0.5 + 0.5 * Math.sin(t * 0.9 + m.phase)
          ctx.globalAlpha = (0.25 + 0.75 * near) * twinkle
          ctx.drawImage(
            moteSprite,
            m.x - m.size,
            m.y - m.size,
            m.size * 2,
            m.size * 2
          )
        }
        ctx.globalAlpha = 1
      }
    },
    drawOver(ctx, t) {
      const breathe = 0.85 + 0.15 * Math.sin((t * TAU) / 23)
      const { x: sx, y: sy } = sun(t)
      ctx.globalCompositeOperation = 'lighter'
      glow(ctx, sx, sy, band * 2.8 * (0.94 + 0.06 * breathe), [
        [0, 'rgba(255, 250, 236, 0.95)'],
        [0.1, `rgba(255, 236, 196, ${0.75 * breathe})`],
        [0.3, `rgba(255, 206, 150, ${0.32 * breathe})`],
        [0.6, `rgba(255, 190, 130, ${0.1 * breathe})`],
        [1, 'rgba(255, 190, 130, 0)']
      ])
      // Lens ghosts on the sun -> screen-centre diagonal, close to the corner.
      const dx = w / 2 - sx
      const dy = h / 2 - sy
      const len = Math.hypot(dx, dy)
      const ghosts: [number, number, string][] = [
        [0.9, 0.16, '255, 200, 150'],
        [1.6, 0.1, '166, 220, 255'],
        [2.4, 0.26, '255, 214, 170']
      ]
      const drift = 1 + Math.sin(t / 53) * 0.08
      for (const [dist, size, rgb] of ghosts) {
        const k = (band * dist * drift) / len
        glow(ctx, sx + dx * k, sy + dy * k, band * size, [
          [0, `rgba(${rgb}, 0)`],
          [0.7, `rgba(${rgb}, ${0.14 * breathe})`],
          [1, `rgba(${rgb}, 0)`]
        ])
      }
      ctx.globalCompositeOperation = 'source-over'
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
    sunScene
  )
}

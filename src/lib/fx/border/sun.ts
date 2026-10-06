/**
 * Clear day: sunlight from wherever the sun really is (the sky layer's
 * CelestialArc draws the disc itself; this adds what it does to the air and
 * the lens). One radial light field centred on the sun warms the whole
 * frame — a single field rather than per-edge washes, whose overlaps summed
 * into bright squares at the corners. Slow god rays sweep out of the sun,
 * a soft bloom and an anamorphic glare streak sit on it, lens ghosts trail
 * along the sun → screen-centre line, and warm motes drift everywhere,
 * brighter the closer they are to the light.
 *
 * Soft shapes only, so it renders at a fraction of screen resolution (the
 * upscale blur is part of the look) and at a low frame rate. The presence
 * field here has no edge bias (floor 1): only the glass calm zones quiet it.
 */
import { createCanvas2dEffect, makeSprite, rand, type Scene2d } from './common'
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

type Stops = [number, string][]

function radial(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stops: Stops
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
  stops: Stops
): void {
  ctx.fillStyle = radial(ctx, x, y, r, stops)
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function sunScene(opts: EffectOptions): Scene2d {
  const moteCount = opts.tier === 'high' ? 70 : 32
  let w = 0
  let h = 0
  let band = 0
  let reach = 0
  let motes: Mote[] = []
  let moteSprite: HTMLCanvasElement | null = null
  // Uneven ray widths so the sweep never reads as a regular pinwheel.
  const rays: [number, number][] = []
  for (let a = 0; a < 1;) {
    const width = rand(0.012, 0.04)
    rays.push([a, rand(0.35, 1)])
    a += width + rand(0.008, 0.035)
  }

  function sun(t: number): { x: number; y: number } {
    const pos = opts.celestial?.()
    if (pos && pos.body === 'sun') return { x: pos.x * w, y: pos.y * h }
    // No position (tests, missing sunrise/sunset): high in the top-right.
    return {
      x: w * 0.86 + Math.sin(t / 37) * band * 0.1,
      y: h * 0.14 + Math.cos(t / 41) * band * 0.06
    }
  }

  function spawnMote(anywhere: boolean): Mote {
    return {
      x: rand(0, w),
      y: anywhere ? rand(0, h) : h + rand(0, band * 0.5),
      vx: rand(-0.05, 0.05) * band,
      vy: rand(-0.09, -0.02) * band,
      phase: rand(0, TAU),
      size: rand(0.04, 0.11) * band
    }
  }

  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
      reach = Math.hypot(w, h) * 0.9
      motes = Array.from({ length: moteCount }, () => spawnMote(true))
      const s = Math.max(4, band * 0.22)
      moteSprite = makeSprite(s, s, (c) => {
        c.fillStyle = radial(c, s / 2, s / 2, s / 2, [
          [0, 'rgba(255, 246, 226, 1)'],
          [0.35, 'rgba(255, 218, 166, 0.55)'],
          [1, 'rgba(255, 200, 140, 0)']
        ])
        c.fillRect(0, 0, s, s)
      })
    },
    draw(ctx, t, dt) {
      const breathe = 0.88 + 0.12 * Math.sin((t * TAU) / 23)
      const { x: sx, y: sy } = sun(t)
      // Low sun: warmer, redder light (sunrise/sunset glow).
      const low = Math.min(1, Math.max(0, (sy / h - 0.45) / 0.45))
      const warmRgb = low > 0.5 ? '255, 170, 110' : '255, 206, 150'

      // Rays first: the destination-in falloff below would erase anything
      // drawn before it. createConicGradient is missing on pre-2022
      // engines — those simply get no rays.
      if (typeof ctx.createConicGradient === 'function') {
        const cg = ctx.createConicGradient(t / 90, sx, sy)
        for (const [at, strength] of rays) {
          const a = 0.6 * strength * breathe
          cg.addColorStop(at, 'rgba(255, 226, 176, 0)')
          cg.addColorStop(Math.min(1, at + 0.009), `rgba(255, 226, 176, ${a})`)
          cg.addColorStop(Math.min(1, at + 0.022), 'rgba(255, 226, 176, 0)')
        }
        ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = cg
        ctx.fillRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'destination-in'
        ctx.fillStyle = radial(ctx, sx, sy, reach * 0.75, [
          [0, 'rgba(0, 0, 0, 1)'],
          [0.45, 'rgba(0, 0, 0, 0.5)'],
          [1, 'rgba(0, 0, 0, 0)']
        ])
        ctx.fillRect(0, 0, w, h)
      }

      ctx.globalCompositeOperation = 'lighter'
      // The light field: strong around the sun, still a warm tint by the
      // far corner so the whole frame reads sunlit.
      ctx.fillStyle = radial(ctx, sx, sy, reach, [
        [0, `rgba(255, 244, 220, ${0.95 * breathe})`],
        [0.1, `rgba(255, 224, 172, ${0.75 * breathe})`],
        [0.32, `rgba(${warmRgb}, ${0.4 * breathe})`],
        [0.65, `rgba(${warmRgb}, ${0.18 * breathe})`],
        [1, `rgba(${warmRgb}, 0.08)`]
      ])
      ctx.fillRect(0, 0, w, h)

      // Bloom on the sun itself.
      glow(ctx, sx, sy, band * 4 * (0.95 + 0.05 * breathe), [
        [0, 'rgba(255, 252, 240, 0.9)'],
        [0.08, `rgba(255, 240, 204, ${0.7 * breathe})`],
        [0.25, `rgba(255, 220, 166, ${0.55 * breathe})`],
        [0.6, `rgba(255, 200, 140, ${0.18 * breathe})`],
        [1, 'rgba(255, 196, 136, 0)']
      ])

      // Anamorphic glare: a long horizontal streak through the sun.
      ctx.save()
      ctx.translate(sx, sy)
      ctx.scale(7, 0.22)
      glow(ctx, 0, 0, band * 1.2, [
        [0, `rgba(255, 246, 226, ${0.85 * breathe})`],
        [0.3, `rgba(255, 220, 176, ${0.2 * breathe})`],
        [1, 'rgba(255, 210, 160, 0)']
      ])
      ctx.restore()

      // Lens ghosts along the sun -> screen-centre line (and past it).
      const dx = w / 2 - sx
      const dy = h / 2 - sy
      const ghosts: [number, number, string, boolean][] = [
        [0.45, 0.22, '255, 200, 150', false],
        [0.8, 0.12, '166, 220, 255', false],
        [1.25, 0.45, '255, 214, 170', true],
        [1.6, 0.2, '190, 236, 210', false],
        [1.9, 0.7, '166, 200, 255', true]
      ]
      const drift = 1 + Math.sin(t / 53) * 0.04
      for (const [dist, size, rgb, ring] of ghosts) {
        const gx = sx + dx * dist * drift
        const gy = sy + dy * dist * drift
        glow(
          ctx,
          gx,
          gy,
          band * size,
          ring
            ? [
                [0, `rgba(${rgb}, 0)`],
                [0.78, `rgba(${rgb}, 0.03)`],
                [0.9, `rgba(${rgb}, ${0.16 * breathe})`],
                [1, `rgba(${rgb}, 0)`]
              ]
            : [
                [0, `rgba(${rgb}, ${0.16 * breathe})`],
                [0.7, `rgba(${rgb}, ${0.1 * breathe})`],
                [1, `rgba(${rgb}, 0)`]
              ]
        )
      }

      if (moteSprite) {
        for (const m of motes) {
          m.x += m.vx * dt
          m.y += m.vy * dt
          if (m.y < -m.size || m.x < -m.size || m.x > w + m.size) {
            Object.assign(m, spawnMote(false))
          }
          const near = 1 - Math.min(1, Math.hypot(m.x - sx, m.y - sy) / reach)
          const twinkle = 0.5 + 0.5 * Math.sin(t * 0.9 + m.phase)
          ctx.globalAlpha = (0.3 + 0.7 * near * near) * twinkle
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
      floor: 1,
      calm: ['glass']
    }),
    sunScene
  )
}

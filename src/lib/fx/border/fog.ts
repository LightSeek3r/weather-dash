/**
 * Fog: banks of mist in three parallax layers rolling slowly sideways over
 * a standing haze that thickens toward the ground. The far layer sits
 * higher and moves slowest; the near layer hugs the bottom edge and moves
 * fastest (alternate layers drift opposite ways, like eddies). Each layer is
 * one pre-rendered, horizontally seamless strip scrolled with wrap-around,
 * so a frame is six blits plus a gradient. The haze is also what veils the
 * sky layer's sun/moon.
 */
import { createCanvas2dEffect, makeSprite, rand, type Scene2d } from './common'
import type { BorderEffect, EffectOptions } from './types'

// Per layer (far → near): centre and thickness (fractions of h), speed
// (fraction of w per second; sign = direction), opacity.
const LAYERS = [
  { y: 0.5, thick: 0.5, speed: 1 / 320, alpha: 0.55 },
  { y: 0.7, thick: 0.46, speed: -1 / 210, alpha: 0.7 },
  { y: 0.88, thick: 0.38, speed: 1 / 140, alpha: 0.85 }
]

/** A seamless strip of stretched mist puffs, denser toward its middle. */
function bankSprite(w: number, bh: number, puffs: number): HTMLCanvasElement {
  return makeSprite(w, bh, (ctx) => {
    for (let i = 0; i < puffs; i++) {
      const x = rand(0, w)
      // Sum of two uniforms: puffs cluster around the strip's centre line.
      const y = bh * (0.5 + (rand(0, 0.5) + rand(0, 0.5) - 0.5) * 0.7)
      const r = bh * rand(0.16, 0.32)
      const stretch = rand(2.5, 5)
      const a = rand(0.18, 0.4)
      for (const ox of [x - w, x, x + w]) {
        if (ox + r * stretch < 0 || ox - r * stretch > w) continue
        ctx.save()
        ctx.translate(ox, y)
        ctx.scale(stretch, 1)
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
        g.addColorStop(0, `rgba(214, 226, 238, ${a})`)
        g.addColorStop(0.5, `rgba(200, 214, 228, ${a * 0.55})`)
        g.addColorStop(1, 'rgba(200, 214, 228, 0)')
        ctx.fillStyle = g
        ctx.fillRect(-r, -r, r * 2, r * 2)
        ctx.restore()
      }
    }
  })
}

function fogScene(opts: EffectOptions): Scene2d {
  let w = 0
  let h = 0
  let band = 0
  let banks: HTMLCanvasElement[] = []
  let haze: CanvasGradient | null = null
  const puffs = opts.tier === 'high' ? 34 : 22
  // Fog has no intensity signal to ride (mapWmo never sets one for codes
  // 45/48), so density only nudges opacity.
  const boost = 0.85 + 0.3 * opts.density
  const phases = LAYERS.map(() => rand(0, 1))

  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
      banks = LAYERS.map((L) => bankSprite(w, h * L.thick, puffs))
      haze = null
    },
    draw(ctx, t) {
      if (!haze) {
        haze = ctx.createLinearGradient(0, 0, 0, h)
        haze.addColorStop(0, `rgba(160, 178, 198, ${0.2 * boost})`)
        haze.addColorStop(0.5, `rgba(170, 186, 204, ${0.24 * boost})`)
        haze.addColorStop(1, `rgba(186, 200, 216, ${0.5 * boost})`)
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = haze
      ctx.fillRect(0, 0, w, h)

      LAYERS.forEach((L, i) => {
        const img = banks[i]
        if (!img) return
        const off = ((((t * L.speed + phases[i]) * w) % w) + w) % w
        const bob = Math.sin(t / (23 + i * 7) + phases[i] * 6) * band * 0.12
        const y = h * L.y - img.height / 2 + bob
        const breathe = 0.85 + 0.15 * Math.sin(t / (13 + i * 5) + phases[i] * 4)
        ctx.globalAlpha = Math.min(1, L.alpha * boost * breathe)
        ctx.drawImage(img, off - w, y)
        ctx.drawImage(img, off, y)
      })
      ctx.globalAlpha = 1
    }
  }
}

export function createEffect(): BorderEffect {
  return createCanvas2dEffect(
    (o) => ({
      fps: o.tier === 'high' ? 20 : 12,
      maxDpr: o.tier === 'high' ? 0.5 : 0.33,
      maxPixels: o.tier === 'high' ? 400_000 : 160_000,
      floor: 0.85,
      calm: ['glass']
    }),
    fogScene
  )
}

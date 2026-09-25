/**
 * Clear day: a warm light leak pooled in the top-right corner, spilling as
 * a wash along the whole top edge and partway down both sides (dominant on
 * the sun's own side, a cooler hint on the other, so the frame doesn't read
 * lopsided), breathing and drifting slowly, with a few faint lens ghosts
 * trailing inward along the edge. Soft shapes only, so it renders at a
 * fraction of screen resolution (the upscale blur is free and part of the
 * look) and at a low frame rate — nothing here moves faster than a few px
 * per second.
 */
import { createCanvas2dEffect, type Scene2d } from './common'
import type { BorderEffect } from './types'

const TAU = Math.PI * 2

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stops: [number, string][]
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  for (const [at, color] of stops) g.addColorStop(at, color)
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function sunScene(): Scene2d {
  let w = 0
  let h = 0
  let band = 0
  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
    },
    draw(ctx, t) {
      const breathe = 0.82 + 0.18 * Math.sin((t * TAU) / 23)
      const cx = w + band * 0.15 + Math.sin(t / 37) * band * 0.3
      const cy = -band * 0.25 + Math.cos(t / 41) * band * 0.2

      ctx.globalCompositeOperation = 'lighter'
      glow(ctx, cx, cy, band * 3.6 * (0.95 + 0.05 * breathe), [
        [0, `rgba(255, 238, 218, ${0.55 * breathe})`],
        [0.16, `rgba(255, 200, 164, ${0.34 * breathe})`],
        [0.45, `rgba(255, 184, 150, ${0.12 * breathe})`],
        [1, 'rgba(255, 184, 150, 0)']
      ])

      // Full top-edge wash: the corner's light read as spilling along the
      // whole top border, brightest near the sun's own corner and fading
      // toward the far side — this is what makes the effect read as "the
      // top edge is lit" rather than "one corner has a flare".
      const topWash = ctx.createLinearGradient(0, 0, w, 0)
      topWash.addColorStop(0, `rgba(196, 212, 236, ${0.035 * breathe})`)
      topWash.addColorStop(0.5, `rgba(255, 208, 178, ${0.09 * breathe})`)
      topWash.addColorStop(1, `rgba(255, 222, 194, ${0.22 * breathe})`)
      ctx.fillStyle = topWash
      ctx.fillRect(0, 0, w, band * 1.3)

      // Vertical wash bleeding partway down the sun's own (right) side.
      const rightWash = ctx.createLinearGradient(0, 0, 0, h)
      rightWash.addColorStop(0, `rgba(255, 214, 188, ${0.22 * breathe})`)
      rightWash.addColorStop(0.32, `rgba(255, 200, 170, ${0.09 * breathe})`)
      rightWash.addColorStop(0.62, 'rgba(255, 200, 170, 0)')
      ctx.fillStyle = rightWash
      ctx.fillRect(w - band * 1.3, 0, band * 1.3, h)

      // Fainter, cooler wash partway down the opposite (left) side, so the
      // frame reads lit on both sides without being symmetric about it.
      const leftWash = ctx.createLinearGradient(0, 0, 0, h)
      leftWash.addColorStop(0, `rgba(205, 222, 242, ${0.09 * breathe})`)
      leftWash.addColorStop(0.28, `rgba(190, 210, 232, ${0.03 * breathe})`)
      leftWash.addColorStop(0.5, 'rgba(190, 210, 232, 0)')
      ctx.fillStyle = leftWash
      ctx.fillRect(0, 0, band * 1.3, h)

      // Light leak smeared along the top edge, sweeping back and forth.
      const lx = w * (0.55 + 0.1 * Math.sin(t / 29))
      ctx.save()
      ctx.translate(lx, 0)
      ctx.scale(3.4, 1)
      glow(ctx, 0, 0, band * 1.0, [
        [0, `rgba(255, 196, 160, ${0.18 * breathe})`],
        [1, 'rgba(255, 184, 150, 0)']
      ])
      ctx.restore()

      // Lens ghosts along the right edge — hug the frame, don't wander in.
      const ghosts: [number, number, string][] = [
        [1.3, 0.22, '255, 184, 150'],
        [2.2, 0.14, '166, 220, 255'],
        [3.2, 0.32, '255, 200, 170'],
        [4.4, 0.18, '255, 214, 190']
      ]
      const drift = Math.sin(t / 53) * 0.12
      for (const [dist, size, rgb] of ghosts) {
        const gx = cx - band * 0.55 * dist * (0.4 + drift)
        const gy = cy + band * dist
        glow(ctx, gx, gy, band * size, [
          [0, `rgba(${rgb}, 0)`],
          [0.7, `rgba(${rgb}, ${0.12 * breathe})`],
          [1, `rgba(${rgb}, 0)`]
        ])
      }

      // Faint cool bounce in the opposite corner so the frame isn't lopsided.
      glow(ctx, -band * 0.2, h + band * 0.2, band * 2.4, [
        [0, `rgba(166, 220, 255, ${0.09 + 0.04 * breathe})`],
        [1, 'rgba(166, 220, 255, 0)']
      ])
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

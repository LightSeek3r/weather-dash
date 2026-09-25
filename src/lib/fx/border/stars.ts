/**
 * Clear night: sparse stars scattered through the border ring, each
 * twinkling on its own slow period, plus a rare shooting star skimming the
 * top edge. Points are blitted from one pre-rendered sprite, alpha-faded by
 * their distance into the ring so the field thins out toward the content.
 */
import {
  createCanvas2dEffect,
  edgeFactor,
  makeSprite,
  rand,
  randomInBand,
  type Scene2d
} from './common'
import type { BorderEffect, EffectOptions } from './types'

interface Star {
  x: number
  y: number
  size: number
  base: number
  freq: number
  phase: number
  warm: boolean
  edge: number
}

interface Meteor {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
}

const SPRITE = 32

function starSprite(rgb: string): HTMLCanvasElement {
  return makeSprite(SPRITE, SPRITE, (ctx) => {
    const c = SPRITE / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, c)
    g.addColorStop(0, `rgba(${rgb}, 1)`)
    g.addColorStop(0.18, `rgba(${rgb}, 0.85)`)
    g.addColorStop(0.45, `rgba(${rgb}, 0.18)`)
    g.addColorStop(1, `rgba(${rgb}, 0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SPRITE, SPRITE)
  })
}

function starsScene(opts: EffectOptions): Scene2d {
  let w = 0
  let h = 0
  let band = 0
  let px = 1
  let stars: Star[] = []
  let meteor: Meteor | null = null
  let nextMeteor = rand(20, 50)
  const cool = starSprite('238, 244, 251')
  const warm = starSprite('255, 214, 190')
  const count = opts.tier === 'high' ? 150 : 100

  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
      // Sprite sizes are in backing-store px; scale with the canvas density.
      px = Math.max(1, Math.min(w, h) / 900)
      stars = Array.from({ length: count }, () => {
        const { x, y } = randomInBand(w, h, band)
        const bright = Math.random() < 0.08
        return {
          x,
          y,
          size: (bright ? rand(7, 11) : rand(3, 6.5)) * px,
          base: bright ? rand(0.75, 1) : rand(0.3, 0.7),
          freq: rand(0.25, 1.1),
          phase: rand(0, Math.PI * 2),
          warm: Math.random() < 0.15,
          edge: edgeFactor(x, y, w, h, band)
        }
      })
    },
    draw(ctx, t, dt) {
      for (const s of stars) {
        const twinkle = 0.6 + 0.4 * Math.sin(t * s.freq * Math.PI * 2 + s.phase)
        const a = s.base * twinkle * s.edge
        if (a < 0.02) continue
        ctx.globalAlpha = a
        ctx.drawImage(
          s.warm ? warm : cool,
          s.x - s.size / 2,
          s.y - s.size / 2,
          s.size,
          s.size
        )
      }

      nextMeteor -= dt
      if (!meteor && nextMeteor <= 0) {
        const speed = band * rand(2.2, 3.2)
        meteor = {
          x: rand(w * 0.2, w * 0.9),
          y: rand(band * 0.1, band * 0.4),
          vx: -speed * 0.9,
          vy: speed * 0.35,
          age: 0,
          life: rand(0.6, 1)
        }
        nextMeteor = rand(35, 90)
      }
      if (meteor) {
        meteor.age += dt
        meteor.x += meteor.vx * dt
        meteor.y += meteor.vy * dt
        const k = meteor.age / meteor.life
        if (k >= 1) {
          meteor = null
        } else {
          const fade =
            Math.sin(k * Math.PI) * edgeFactor(meteor.x, meteor.y, w, h, band)
          const tail = 0.12
          const tx = meteor.x - meteor.vx * tail
          const ty = meteor.y - meteor.vy * tail
          const g = ctx.createLinearGradient(meteor.x, meteor.y, tx, ty)
          g.addColorStop(0, `rgba(238, 244, 251, ${0.8 * fade})`)
          g.addColorStop(1, 'rgba(166, 220, 255, 0)')
          ctx.globalAlpha = 1
          ctx.strokeStyle = g
          ctx.lineWidth = 1.6 * px
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(meteor.x, meteor.y)
          ctx.lineTo(tx, ty)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }
  }
}

export function createEffect(): BorderEffect {
  return createCanvas2dEffect(
    (o) => ({
      fps: o.tier === 'high' ? 20 : 15,
      maxDpr: o.tier === 'high' ? 2 : 1,
      maxPixels: o.tier === 'high' ? 3_000_000 : 1_000_000
    }),
    starsScene
  )
}

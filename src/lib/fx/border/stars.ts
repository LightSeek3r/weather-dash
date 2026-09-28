/**
 * Clear night: a full sky of stars. Two populations:
 *
 * - the field: hundreds of faint pinpoints plus a soft milky band, drawn
 *   once per resize onto a static layer (one blit per frame);
 * - twinklers: fewer, brighter stars in real star colours (blue-white to
 *   orange), each twinkling on two incommensurate periods so no two pulse
 *   alike, with an occasional sharp "shine" flare. The brightest carry
 *   four-point diffraction spikes.
 *
 * Stars near the moon (the sky layer's CelestialArc) are washed out by its
 * glare, and every 12–40 s a meteor crosses the upper sky. The horizon
 * band fades them out (atmospheric extinction). No edge bias: floor 1.
 */
import {
  createCanvas2dEffect,
  detailUnit,
  makeSprite,
  rand,
  random,
  smoothstep,
  type Scene2d
} from './common'
import type { BorderEffect, EffectOptions } from './types'

interface Star {
  x: number
  y: number
  size: number
  base: number
  f1: number
  f2: number
  p1: number
  p2: number
  shineFreq: number
  sprite: number
  spikes: boolean
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
const TAU = Math.PI * 2
// Blue-white, white, pale yellow, orange: the common naked-eye star colours.
const COLOURS = [
  '200, 220, 255',
  '240, 244, 251',
  '255, 240, 214',
  '255, 204, 160'
]
const COLOUR_WEIGHTS = [0.3, 0.45, 0.15, 0.1]

function starSprite(rgb: string, spikes: boolean): HTMLCanvasElement {
  return makeSprite(SPRITE, SPRITE, (ctx) => {
    const c = SPRITE / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, spikes ? c * 0.6 : c)
    g.addColorStop(0, `rgba(${rgb}, 1)`)
    g.addColorStop(0.18, `rgba(${rgb}, 0.85)`)
    g.addColorStop(0.45, `rgba(${rgb}, 0.2)`)
    g.addColorStop(1, `rgba(${rgb}, 0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SPRITE, SPRITE)
    if (!spikes) return
    for (const horizontal of [true, false]) {
      const s = horizontal
        ? ctx.createLinearGradient(0, c, SPRITE, c)
        : ctx.createLinearGradient(c, 0, c, SPRITE)
      s.addColorStop(0, `rgba(${rgb}, 0)`)
      s.addColorStop(0.5, `rgba(${rgb}, 0.9)`)
      s.addColorStop(1, `rgba(${rgb}, 0)`)
      ctx.fillStyle = s
      if (horizontal) ctx.fillRect(0, c - 0.6, SPRITE, 1.2)
      else ctx.fillRect(c - 0.6, 0, 1.2, SPRITE)
    }
  })
}

function pickColour(): number {
  let u = random()
  for (let i = 0; i < COLOUR_WEIGHTS.length; i++) {
    u -= COLOUR_WEIGHTS[i]
    if (u <= 0) return i
  }
  return 1
}

/** Fewer, fainter stars toward the horizon. */
function horizon(y: number, h: number): number {
  return 1 - smoothstep(0.72, 0.98, y / h) * 0.85
}

function fieldLayer(
  w: number,
  h: number,
  px: number,
  count: number
): HTMLCanvasElement {
  return makeSprite(w, h, (ctx) => {
    // Milky band: a faint diagonal glow, lumpy along its length.
    ctx.save()
    ctx.translate(w * 0.5, h * 0.35)
    ctx.rotate(-0.5)
    const len = Math.hypot(w, h)
    for (let i = 0; i < 14; i++) {
      const x = (i / 13 - 0.5) * len
      const r = Math.min(w, h) * rand(0.1, 0.2)
      const g = ctx.createRadialGradient(x, rand(-r, r) * 0.3, 0, x, 0, r)
      g.addColorStop(0, `rgba(190, 206, 240, ${rand(0.03, 0.06)})`)
      g.addColorStop(1, 'rgba(190, 206, 240, 0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, -r, r * 2, r * 2)
    }
    ctx.restore()

    for (let i = 0; i < count; i++) {
      const inBand = random() < 0.3
      let x: number
      let y: number
      if (inBand) {
        // Concentrate some pinpoints along the milky band.
        const along = rand(-0.5, 0.5) * Math.hypot(w, h)
        const across = (random() + random() - 1) * Math.min(w, h) * 0.12
        x = w * 0.5 + along * Math.cos(-0.5) - across * Math.sin(-0.5)
        y = h * 0.35 + along * Math.sin(-0.5) + across * Math.cos(-0.5)
      } else {
        x = rand(0, w)
        y = rand(0, h)
      }
      const a = rand(0.25, 0.7) * horizon(y, h)
      const r = rand(0.7, 1.6) * px
      ctx.fillStyle = `rgba(${COLOURS[pickColour()]}, ${a})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, TAU)
      ctx.fill()
    }
  })
}

function starsScene(opts: EffectOptions): Scene2d {
  let w = 0
  let h = 0
  let band = 0
  let px = 1
  let stars: Star[] = []
  let field: HTMLCanvasElement | null = null
  let meteor: Meteor | null = null
  let nextMeteor = rand(6, 20)
  const plain = COLOURS.map((c) => starSprite(c, false))
  const spiky = COLOURS.map((c) => starSprite(c, true))
  const count = opts.tier === 'high' ? 140 : 90
  const fieldCount = opts.tier === 'high' ? 600 : 350

  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
      px = detailUnit(band)
      field = fieldLayer(w, h, px, fieldCount)
      stars = Array.from({ length: count }, () => {
        const x = rand(0, w)
        const y = rand(0, h)
        const brightness = random()
        const spikes = brightness > 0.9
        return {
          x,
          y,
          size:
            (spikes
              ? rand(20, 30)
              : brightness > 0.7
                ? rand(9, 14)
                : rand(4.5, 8.5)) * px,
          base: (spikes ? rand(0.8, 1) : rand(0.4, 0.85)) * horizon(y, h),
          f1: rand(0.15, 0.9),
          f2: rand(1.3, 3.1),
          p1: rand(0, TAU),
          p2: rand(0, TAU),
          shineFreq: rand(0.02, 0.07),
          sprite: pickColour(),
          spikes
        }
      })
    },
    draw(ctx, t, dt) {
      const moon = opts.celestial?.()
      const mx = moon?.body === 'moon' ? moon.x * w : NaN
      const my = moon?.body === 'moon' ? moon.y * h : NaN
      const glare = band * 2.2

      if (field) {
        ctx.globalAlpha = 1
        ctx.drawImage(field, 0, 0)
      }

      for (const s of stars) {
        const twinkle =
          (0.6 + 0.4 * Math.sin(t * s.f1 * TAU + s.p1)) *
          (0.85 + 0.15 * Math.sin(t * s.f2 * TAU + s.p2))
        const shine = Math.pow(
          Math.max(0, Math.sin(t * s.shineFreq * TAU + s.p2)),
          40
        )
        const washed = Number.isNaN(mx)
          ? 1
          : 0.2 +
            0.8 * smoothstep(glare * 0.4, glare, Math.hypot(s.x - mx, s.y - my))
        const a = Math.min(1, s.base * twinkle * washed + shine * 0.6 * washed)
        if (a < 0.02) continue
        const size = s.size * (1 + shine * 0.6)
        ctx.globalAlpha = a
        ctx.drawImage(
          (s.spikes ? spiky : plain)[s.sprite],
          s.x - size / 2,
          s.y - size / 2,
          size,
          size
        )
      }

      nextMeteor -= dt
      if (!meteor && nextMeteor <= 0) {
        const speed = band * rand(3, 4.5)
        const dir = random() < 0.5 ? -1 : 1
        const angle = rand(0.25, 0.55)
        meteor = {
          x: rand(w * 0.15, w * 0.85),
          y: rand(h * 0.05, h * 0.45),
          vx: dir * speed * Math.cos(angle),
          vy: speed * Math.sin(angle),
          age: 0,
          life: rand(0.6, 1.1)
        }
        nextMeteor = rand(12, 40)
      }
      if (meteor) {
        meteor.age += dt
        meteor.x += meteor.vx * dt
        meteor.y += meteor.vy * dt
        const k = meteor.age / meteor.life
        if (k >= 1 || meteor.y > h * 0.6) {
          meteor = null
        } else {
          const fade = Math.sin(k * Math.PI)
          const tail = 0.16
          const tx = meteor.x - meteor.vx * tail
          const ty = meteor.y - meteor.vy * tail
          const g = ctx.createLinearGradient(meteor.x, meteor.y, tx, ty)
          g.addColorStop(0, `rgba(248, 250, 255, ${0.95 * fade})`)
          g.addColorStop(0.3, `rgba(200, 228, 255, ${0.5 * fade})`)
          g.addColorStop(1, 'rgba(166, 220, 255, 0)')
          ctx.globalAlpha = 1
          ctx.strokeStyle = g
          ctx.lineWidth = 2.4 * px
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(meteor.x, meteor.y)
          ctx.lineTo(tx, ty)
          ctx.stroke()
          ctx.globalAlpha = fade
          const hs = 10 * px
          ctx.drawImage(plain[1], meteor.x - hs, meteor.y - hs, hs * 2, hs * 2)
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
      maxPixels: o.tier === 'high' ? 3_000_000 : 1_000_000,
      floor: 1
    }),
    starsScene
  )
}

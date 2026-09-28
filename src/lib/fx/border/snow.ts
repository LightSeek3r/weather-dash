/**
 * Snow across the whole sky, in three depth layers: small, slow, dim far
 * flakes; mid flakes, some of them slowly turning six-armed crystals; and a
 * few big out-of-focus near flakes. Light snow is a sparse, gentle, almost
 * vertical drift; heavy snow is dense, bigger, faster and blown sideways by
 * a gusting wind. Snow collects in a lumpy bank along the bottom edge
 * (deeper when heavy) that sparkles here and there.
 *
 * Snow grains (and anything icy, see ice.ts) swap the flakes for small hard
 * pellets that fall fast and straight with sharp glints, plus frost grown
 * in from the edges.
 */
import {
  FPS,
  createCanvas2dEffect,
  detailUnit,
  makeSprite,
  rand,
  random,
  smoothstep,
  type Scene2d,
  type SceneEnv
} from './common'
import { frostLayer, glintSprite, isIcy } from './ice'
import type { BorderEffect, EffectOptions } from './types'

interface Flake {
  x: number
  y: number
  size: number
  vy: number
  drift: number
  sway: number
  swayFreq: number
  phase: number
  alpha: number
  /** 0 = soft dot, 1 = crystal, 2 = bokeh, 3 = pellet. */
  kind: number
  spin: number
  glint: boolean
}

interface Sparkle {
  x: number
  y: number
  freq: number
  phase: number
  size: number
}

const SPRITE = 32
const TAU = Math.PI * 2

function dotSprite(): HTMLCanvasElement {
  return makeSprite(SPRITE, SPRITE, (ctx) => {
    const c = SPRITE / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, c)
    g.addColorStop(0, 'rgba(248, 250, 255, 1)')
    g.addColorStop(0.4, 'rgba(238, 244, 251, 0.75)')
    g.addColorStop(1, 'rgba(214, 232, 250, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, SPRITE, SPRITE)
  })
}

/** Big near flake, out of focus: a soft disc with a faint brighter rim. */
function bokehSprite(): HTMLCanvasElement {
  const S = 64
  return makeSprite(S, S, (ctx) => {
    const c = S / 2
    const g = ctx.createRadialGradient(c, c, 0, c, c, c)
    g.addColorStop(0, 'rgba(238, 244, 251, 0.55)')
    g.addColorStop(0.7, 'rgba(238, 244, 251, 0.45)')
    g.addColorStop(0.85, 'rgba(248, 250, 255, 0.6)')
    g.addColorStop(1, 'rgba(238, 244, 251, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
  })
}

function crystalSprite(): HTMLCanvasElement {
  const S = 48
  return makeSprite(S, S, (ctx) => {
    const c = S / 2
    const r = S / 2 - 2
    ctx.translate(c, c)
    ctx.strokeStyle = 'rgba(248, 250, 255, 0.95)'
    ctx.lineCap = 'round'
    ctx.lineWidth = 2.2
    for (let k = 0; k < 6; k++) {
      ctx.save()
      ctx.rotate((k * TAU) / 6)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -r)
      for (const at of [0.4, 0.68]) {
        const len = r * (at < 0.5 ? 0.32 : 0.22)
        ctx.moveTo(0, -r * at)
        ctx.lineTo(-len * 0.8, -r * at - len)
        ctx.moveTo(0, -r * at)
        ctx.lineTo(len * 0.8, -r * at - len)
      }
      ctx.stroke()
      ctx.restore()
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.35)
    g.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
    g.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = g
    ctx.fillRect(-r, -r, r * 2, r * 2)
  })
}

function pelletSprite(): HTMLCanvasElement {
  const S = 16
  return makeSprite(S, S, (ctx) => {
    const c = S / 2
    const g = ctx.createRadialGradient(c - 1.5, c - 1.5, 0, c, c, c)
    g.addColorStop(0, 'rgba(255, 255, 255, 1)')
    g.addColorStop(0.55, 'rgba(226, 240, 255, 0.9)')
    g.addColorStop(0.8, 'rgba(200, 222, 245, 0.5)')
    g.addColorStop(1, 'rgba(200, 222, 245, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
  })
}

function snowScene(opts: EffectOptions, env: SceneEnv): Scene2d {
  let w = 0
  let h = 0
  let band = 0
  let px = 1
  let flakes: Flake[] = []
  let sparkles: Sparkle[] = []
  let bank: HTMLCanvasElement | null = null
  let bankH = 0
  let frost: HTMLCanvasElement | null = null

  const icy = isIcy(opts)
  const d = opts.density
  // 0 at light snow, ~0.5 moderate, 1 heavy (densityFor levels).
  const heavy = smoothstep(0.5, 1, d)
  const tierScale = opts.tier === 'high' ? 1 : 0.7
  const count = Math.round(
    tierScale * (icy ? 180 + 160 * heavy : 200 + 280 * heavy)
  )
  const windFactor = icy ? 0.08 : 0.05 + 0.55 * heavy

  const dot = dotSprite()
  const bokeh = bokehSprite()
  const crystal = crystalSprite()
  const pellet = pelletSprite()
  const glintImg = glintSprite(48)

  function spawn(anywhereY: boolean): Flake {
    const depth = random()
    let kind = 0
    let size: number
    let alpha: number
    if (icy) {
      kind = 3
      size = rand(4, 8) * px
      alpha = rand(0.7, 1)
    } else if (depth < 0.5) {
      size = rand(3.5, 6) * px * (1 + 0.3 * heavy)
      alpha = rand(0.5, 0.8)
    } else if (depth < 0.9) {
      kind = random() < 0.3 ? 1 : 0
      size = (kind === 1 ? rand(16, 26) : rand(7, 12)) * px * (1 + 0.35 * heavy)
      alpha = rand(0.65, 0.95)
    } else {
      kind = 2
      size = rand(24, 42) * px * (1 + 0.4 * heavy)
      // Near flakes are big and out of focus — softer, not brighter.
      alpha = rand(0.3, 0.5)
    }
    const fall = icy
      ? band * rand(2.2, 3.2)
      : band *
        (0.28 + (size / (20 * px)) * 0.35) *
        rand(0.8, 1.2) *
        (1 + 0.9 * heavy)
    return {
      x: rand(-0.1, 1.05) * w,
      y: anywhereY ? rand(0, h) : -size - rand(0, band),
      size,
      vy: fall,
      drift: rand(0.7, 1.3),
      sway: icy ? 0 : band * rand(0.05, 0.16),
      swayFreq: rand(0.12, 0.35),
      phase: rand(0, TAU),
      alpha,
      kind,
      spin: rand(-0.6, 0.6),
      glint: icy && random() < 0.12
    }
  }

  function bankSprite(): HTMLCanvasElement {
    const top = bankH * 0.45
    const H = bankH + top
    const seeds = [rand(0, TAU), rand(0, TAU), rand(0, TAU)]
    const surf = (x: number): number =>
      top +
      (Math.sin((x / w) * TAU * 1.3 + seeds[0]) * 0.5 +
        Math.sin((x / w) * TAU * 3.7 + seeds[1]) * 0.3 +
        Math.sin((x / w) * TAU * 9.1 + seeds[2]) * 0.2) *
        top *
        0.9
    sparkles = Array.from({ length: opts.tier === 'high' ? 28 : 16 }, () => {
      const x = rand(0, w)
      return {
        x,
        y: h - H + surf(x) + rand(1, bankH * 0.5),
        freq: rand(0.1, 0.35),
        phase: rand(0, TAU),
        size: rand(8, 18) * px
      }
    })
    return makeSprite(w, H, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, H)
      g.addColorStop(
        0,
        icy ? 'rgba(236, 244, 255, 0.85)' : 'rgba(248, 250, 255, 0.92)'
      )
      g.addColorStop(0.5, 'rgba(226, 236, 250, 0.82)')
      g.addColorStop(1, 'rgba(196, 214, 238, 0.78)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(0, H)
      const steps = 64
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * w
        ctx.lineTo(x, surf(x))
      }
      ctx.lineTo(w, H)
      ctx.closePath()
      ctx.fill()
      // Soft bright crest.
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.lineWidth = 2 * px
      ctx.beginPath()
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * w
        if (i === 0) ctx.moveTo(x, surf(x) + px)
        else ctx.lineTo(x, surf(x) + px)
      }
      ctx.stroke()
    })
  }

  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
      px = detailUnit(band)
      flakes = Array.from({ length: count }, () => spawn(true))
      bankH = band * (0.08 + 0.3 * heavy)
      bank = bankSprite()
      frost = icy ? frostLayer(w, h, band * 1.3, px, true) : null
    },
    draw(ctx, t, dt) {
      const gust = 0.7 + 0.3 * Math.sin(t / 7) + 0.15 * Math.sin(t / 2.3)
      const vx = band * windFactor * gust

      if (frost) {
        ctx.globalAlpha = 1
        ctx.drawImage(frost, 0, 0)
      }

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i]
        f.y += f.vy * dt
        const x = f.x + vx * f.drift * dt
        f.x = x
        const sx = x + Math.sin(t * f.swayFreq * TAU + f.phase) * f.sway
        if (f.y > h + f.size || sx > w + f.size * 2) {
          flakes[i] = spawn(false)
          continue
        }
        if (env.presence(sx, f.y) < 0.02) continue
        ctx.globalAlpha = f.alpha
        const s = f.size
        if (f.kind === 1) {
          ctx.save()
          ctx.translate(sx, f.y)
          ctx.rotate(f.phase + t * f.spin)
          ctx.drawImage(crystal, -s / 2, -s / 2, s, s)
          ctx.restore()
        } else {
          const img = f.kind === 2 ? bokeh : f.kind === 3 ? pellet : dot
          ctx.drawImage(img, sx - s / 2, f.y - s / 2, s, s)
        }
        if (f.glint) {
          const k = Math.pow(Math.max(0, Math.sin(t * 3 + f.phase)), 8)
          if (k > 0.05) {
            ctx.globalAlpha = k
            const gs = s * 4
            ctx.drawImage(glintImg, sx - gs / 2, f.y - gs / 2, gs, gs)
          }
        }
      }

      if (bank) {
        ctx.globalAlpha = 1
        ctx.drawImage(bank, 0, h - bank.height)
        for (const sp of sparkles) {
          const k = Math.pow(
            Math.max(0, Math.sin(t * sp.freq * TAU + sp.phase)),
            16
          )
          if (k < 0.04) continue
          ctx.globalAlpha = k
          ctx.drawImage(
            glintImg,
            sp.x - sp.size / 2,
            sp.y - sp.size / 2,
            sp.size,
            sp.size
          )
        }
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
      maxPixels: o.tier === 'high' ? 3_000_000 : 1_000_000,
      floor: 0.8
    }),
    snowScene
  )
}

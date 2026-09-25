/**
 * Rain / drizzle, Canvas2D tier: drops on glass without a shader. Three
 * populations, all blitted from one pre-rendered drop sprite:
 *
 * - beads: small drops that land in the border ring, sit, and slowly
 *   evaporate (the condensation field);
 * - runners: heavier drops sliding down the side bands with a stick-slip
 *   gait, absorbing beads in their path (and growing/speeding up for it);
 * - trail: tiny droplets a runner sheds behind it, fading after a few s.
 *
 * Every draw is alpha-weighted by `edgeFactor`, so the activity thins out
 * toward the content instead of stopping at a hard line.
 */
import {
  FPS,
  createCanvas2dEffect,
  edgeFactor,
  makeSprite,
  rand,
  randomInBand,
  type Scene2d
} from './common'
import type { BorderEffect, EffectOptions } from './types'

interface Bead {
  x: number
  y: number
  r: number
  age: number
  life: number
}

interface Runner {
  x0: number
  x: number
  y: number
  r: number
  phase: number
  rate: number
  vmax: number
  seed: number
  sinceTrail: number
}

const SPRITE = 64
const TAU = Math.PI * 2

/** Drop seen against a dark sky: faint body, dark lower rim, bright caustic crescent, specular glint. */
function dropSprite(): HTMLCanvasElement {
  return makeSprite(SPRITE, SPRITE, (ctx) => {
    const c = SPRITE / 2
    const r = SPRITE / 2 - 2
    const body = ctx.createRadialGradient(
      c - r * 0.3,
      c - r * 0.35,
      r * 0.1,
      c,
      c,
      r
    )
    body.addColorStop(0, 'rgba(238, 244, 251, 0.26)')
    body.addColorStop(0.7, 'rgba(166, 220, 255, 0.12)')
    body.addColorStop(1, 'rgba(166, 220, 255, 0.2)')
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(c, c, r, 0, TAU)
    ctx.fill()

    ctx.lineWidth = r * 0.14
    ctx.strokeStyle = 'rgba(6, 14, 26, 0.45)'
    ctx.beginPath()
    ctx.arc(c, c, r * 0.93, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()

    ctx.lineWidth = r * 0.12
    ctx.strokeStyle = 'rgba(255, 214, 190, 0.35)'
    ctx.beginPath()
    ctx.arc(c, c, r * 0.8, Math.PI * 0.2, Math.PI * 0.8)
    ctx.stroke()

    const glint = ctx.createRadialGradient(
      c - r * 0.38,
      c - r * 0.4,
      0,
      c - r * 0.38,
      c - r * 0.4,
      r * 0.3
    )
    glint.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
    glint.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = glint
    ctx.fillRect(0, 0, SPRITE, SPRITE)
  })
}

function rainScene(opts: EffectOptions): Scene2d {
  let w = 0
  let h = 0
  let band = 0
  let px = 1
  let beads: Bead[] = []
  let trail: Bead[] = []
  let runners: Runner[] = []
  const sprite = dropSprite()
  // Drizzle/freezing-drizzle: finer, more numerous, slower droplets and far
  // fewer heavy runners — reads as a fine mist rather than rain's fuller,
  // faster streaks (less "accumulation" sliding down the glass).
  const isDrizzle =
    opts.conditionKey === 'drizzle' || opts.conditionKey === 'freezingDrizzle'
  const scale = 0.45 + 0.55 * opts.density
  const beadTarget = Math.round(
    (opts.tier === 'high' ? 220 : 170) * scale * (isDrizzle ? 1.25 : 1)
  )
  const runnerTarget = Math.max(
    2,
    Math.round(
      (opts.tier === 'high' ? 14 : 10) * scale * (isDrizzle ? 0.45 : 1)
    )
  )
  const dropAlpha = isDrizzle ? 0.7 : 1
  const TRAIL_CAP = 260

  function newBead(age = 0): Bead {
    const { x, y } = randomInBand(w, h, band)
    return {
      x,
      y,
      r: (isDrizzle ? rand(0.9, 2.3) : rand(1.4, 4.2)) * px,
      age,
      life: isDrizzle ? rand(14, 45) : rand(18, 60)
    }
  }

  function newRunner(fromTop: boolean): Runner {
    const left = Math.random() < 0.5
    // Mostly the side bands; a few start in the top band and fade out
    // as they slide down past it.
    const x0 =
      Math.random() < 0.8
        ? left
          ? rand(band * 0.05, band * 0.8)
          : w - rand(band * 0.05, band * 0.8)
        : rand(band, w - band)
    return {
      x0,
      x: x0,
      y: fromTop ? -rand(0, band) : rand(0, h),
      r: (isDrizzle ? rand(2, 3.6) : rand(3.5, 6.5)) * px,
      phase: rand(0, TAU),
      rate: isDrizzle ? rand(0.22, 0.45) : rand(0.35, 0.8),
      vmax: band * (isDrizzle ? rand(0.5, 1.0) : rand(1.1, 2.2)),
      seed: rand(0, 100),
      sinceTrail: 0
    }
  }

  function draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    alpha: number,
    stretch = 1
  ): void {
    if (alpha < 0.02) return
    ctx.globalAlpha = Math.min(1, alpha * dropAlpha)
    ctx.drawImage(sprite, x - r, y - r * stretch, r * 2, r * 2 * stretch)
  }

  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
      px = Math.max(1, Math.min(w, h) / 900)
      beads = Array.from({ length: beadTarget }, () => newBead(rand(0, 20)))
      runners = Array.from({ length: runnerTarget }, () => newRunner(false))
      trail = []
    },
    draw(ctx, _t, dt) {
      // New impacts: refill toward the target at a density-scaled rate.
      const spawn = Math.min(
        beadTarget - beads.length,
        Math.ceil(dt * 30 * scale)
      )
      for (let i = 0; i < spawn; i++) beads.push(newBead())

      for (let i = runners.length - 1; i >= 0; i--) {
        const d = runners[i]
        d.phase += dt * d.rate * TAU
        // Stick-slip: speed swings between ~0 (pinned by surface tension)
        // and vmax (released), weighted by the drop's size.
        const gait = 0.5 - 0.5 * Math.cos(d.phase)
        const v = d.vmax * gait * gait * (d.r / (5 * px))
        const dy = v * dt
        d.y += dy
        d.x = d.x0 + Math.sin((d.y * 0.02) / px + d.seed) * d.r * 0.6
        d.sinceTrail += dy
        if (d.sinceTrail > d.r * 1.3 && trail.length < TRAIL_CAP) {
          d.sinceTrail = 0
          trail.push({
            x: d.x + rand(-0.3, 0.3) * d.r,
            y: d.y - d.r * 0.9,
            r: d.r * rand(0.28, 0.45),
            age: 0,
            life: rand(1.5, 4)
          })
        }
        // deliberate: O(beads × runners) absorb scan per frame — ~190 × 12 at
        // most; switch to a spatial grid if either count grows past ~1000.
        for (let j = beads.length - 1; j >= 0; j--) {
          const b = beads[j]
          const dx = b.x - d.x
          const by = b.y - d.y
          const reach = d.r + b.r
          if (dx * dx + by * by < reach * reach) {
            d.r = Math.min(d.r + b.r * 0.08, 8 * px)
            beads.splice(j, 1)
          }
        }
        const e = edgeFactor(d.x, Math.max(0, d.y), w, h, band)
        if (d.y - d.r > h || (e === 0 && d.y > band)) {
          runners[i] = newRunner(true)
          continue
        }
        draw(ctx, d.x, d.y, d.r, e, 1 + gait * 0.25)
      }

      for (let i = trail.length - 1; i >= 0; i--) {
        const b = trail[i]
        b.age += dt
        if (b.age >= b.life) {
          trail.splice(i, 1)
          continue
        }
        const fade = 1 - b.age / b.life
        draw(ctx, b.x, b.y, b.r, fade * edgeFactor(b.x, b.y, w, h, band))
      }

      for (let i = beads.length - 1; i >= 0; i--) {
        const b = beads[i]
        b.age += dt
        if (b.age >= b.life) {
          beads.splice(i, 1)
          continue
        }
        const grow = Math.min(1, b.age / 0.25)
        const fade = Math.min(1, (b.life - b.age) / 6)
        draw(
          ctx,
          b.x,
          b.y,
          b.r * (0.6 + 0.4 * grow),
          fade * edgeFactor(b.x, b.y, w, h, band)
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
    rainScene
  )
}

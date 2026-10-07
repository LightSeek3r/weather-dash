/**
 * Rain / drizzle, Canvas2D: rain on a window, drawn big and bright enough
 * to read from across a room. Layers, back to front:
 *
 * - veil: a grey cloud-deck gradient from the top (it's what hides the sun
 *   and moon of the sky layer beneath during rain);
 * - streaks: rain falling past the glass, slanted by the wind. Light rain is
 *   sparse short slow streaks; heavy rain is dense, long, fast and steeper;
 * - beads: drops that hit the pane — each pops in with a small impact ring
 *   and sits until it evaporates (or a runner sweeps it up);
 * - runners: heavier drops sliding down with a stick-slip gait, shedding a
 *   wet trail of tiny droplets and absorbing beads in their path;
 * - pool: water collecting along the bottom edge, its meniscus rippling and
 *   splashing wherever a runner or streak lands in it;
 * - near rain (near-rain.ts): a few long soft streaks in front of the page
 *   text, when mounted with a front layer.
 *
 * Drizzle swaps to fine mist-like beads and few runners. The icy variants
 * (freezing rain/drizzle, hail — see ice.ts) add edge frost and glints,
 * slow the runners, freeze the pool into a ledge, and (hail) bouncing
 * pellets. Everything is clipped by the shared presence field.
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
import { createNearRain, rainSlant, streakSprite } from './near-rain'
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

interface Streak {
  x: number
  y: number
  len: number
  v: number
  alpha: number
  width: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  bounced: boolean
}

interface Ripple {
  x: number
  age: number
  life: number
  size: number
}

interface Glint {
  x: number
  y: number
  size: number
  freq: number
  phase: number
}

const SPRITE = 64
const TAU = Math.PI * 2

/** Drop seen against a dark sky: lit body, dark lower rim, bright caustic crescent, specular glint. */
function dropSprite(icy: boolean): HTMLCanvasElement {
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
    body.addColorStop(
      0,
      icy ? 'rgba(240, 248, 255, 0.6)' : 'rgba(238, 244, 251, 0.42)'
    )
    body.addColorStop(
      0.7,
      icy ? 'rgba(210, 232, 252, 0.34)' : 'rgba(166, 220, 255, 0.2)'
    )
    body.addColorStop(
      1,
      icy ? 'rgba(226, 242, 255, 0.5)' : 'rgba(166, 220, 255, 0.34)'
    )
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(c, c, r, 0, TAU)
    ctx.fill()

    ctx.lineWidth = r * 0.16
    ctx.strokeStyle = 'rgba(6, 14, 26, 0.5)'
    ctx.beginPath()
    ctx.arc(c, c, r * 0.92, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()

    ctx.lineWidth = r * 0.14
    ctx.strokeStyle = icy
      ? 'rgba(236, 246, 255, 0.6)'
      : 'rgba(255, 220, 196, 0.55)'
    ctx.beginPath()
    ctx.arc(c, c, r * 0.8, Math.PI * 0.2, Math.PI * 0.8)
    ctx.stroke()

    const glint = ctx.createRadialGradient(
      c - r * 0.38,
      c - r * 0.4,
      0,
      c - r * 0.38,
      c - r * 0.4,
      r * 0.34
    )
    glint.addColorStop(0, 'rgba(255, 255, 255, 1)')
    glint.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = glint
    ctx.fillRect(0, 0, SPRITE, SPRITE)
  })
}

function dotSprite(): HTMLCanvasElement {
  return makeSprite(16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8)
    g.addColorStop(0, 'rgba(240, 248, 255, 1)')
    g.addColorStop(0.5, 'rgba(214, 236, 255, 0.6)')
    g.addColorStop(1, 'rgba(214, 236, 255, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 16, 16)
  })
}

function rainScene(opts: EffectOptions, env: SceneEnv): Scene2d {
  let w = 0
  let h = 0
  let band = 0
  let px = 1
  let beads: Bead[] = []
  let trail: Bead[] = []
  let runners: Runner[] = []
  let streaks: Streak[] = []
  let splashes: Particle[] = []
  let hail: Particle[] = []
  let ripples: Ripple[] = []
  let glints: Glint[] = []
  let frost: HTMLCanvasElement | null = null
  let veil: CanvasGradient | null = null
  let poolFill: CanvasGradient | null = null

  const icy = isIcy(opts)
  const hasHail = opts.hail === true
  const isDrizzle =
    opts.conditionKey === 'drizzle' || opts.conditionKey === 'freezingDrizzle'
  const d = opts.density
  // 0 at light rain, ~0.5 at moderate, 1 at heavy/storm (densityFor levels).
  const heavy = isDrizzle ? 0 : smoothstep(0.5, 1, d)
  const tierScale = opts.tier === 'high' ? 1 : 0.7

  const drop = dropSprite(icy)
  const streakImg = streakSprite()
  const dot = dotSprite()
  const glintImg = icy ? glintSprite(48) : null
  const nearRain = opts.front ? createNearRain(opts) : null

  const beadTarget = Math.round(
    tierScale * (isDrizzle ? 170 + 140 * d : 90 + 170 * d)
  )
  const runnerTarget = Math.max(
    2,
    Math.round(
      tierScale * (isDrizzle ? 3 + 4 * d : 5 + 16 * d) * (icy ? 0.35 : 1)
    )
  )
  const streakTarget = Math.round(
    tierScale * (isDrizzle ? 30 + 50 * d : 40 + 190 * d)
  )
  const hailTarget = hasHail ? Math.round(tierScale * 36) : 0
  const slant = rainSlant(opts)
  const cosS = Math.cos(slant)
  const sinS = Math.sin(slant)
  const TRAIL_CAP = 320
  const SPLASH_CAP = 160
  const gravity = () => band * 14

  function poolDepth(): number {
    return band * (isDrizzle ? 0.1 : 0.14 + 0.26 * heavy)
  }
  function surface(x: number, t: number): number {
    const a = poolDepth() * (icy ? 0.05 : 0.09)
    return (
      h -
      poolDepth() +
      Math.sin((x / w) * TAU * 3 + t * 1.3) * a +
      Math.sin((x / w) * TAU * 7.3 - t * 0.9) * a * 0.6
    )
  }

  function newBead(age = 0): Bead {
    return {
      x: rand(0, w),
      y: rand(0, h - poolDepth()),
      r: (isDrizzle ? rand(1.2, 3.2) : rand(2.4, 6.8) * (1 + 0.3 * heavy)) * px,
      age,
      life: icy ? rand(40, 90) : isDrizzle ? rand(14, 40) : rand(16, 50)
    }
  }

  function newRunner(fromTop: boolean): Runner {
    const x0 = rand(0.01, 0.99) * w
    return {
      x0,
      x: x0,
      y: fromTop ? -rand(0, band) : rand(0, h * 0.9),
      r: (isDrizzle ? rand(2.6, 4.6) : rand(5, 9) * (1 + 0.25 * heavy)) * px,
      phase: rand(0, TAU),
      rate: icy
        ? rand(0.12, 0.25)
        : isDrizzle
          ? rand(0.22, 0.45)
          : rand(0.35, 0.85),
      vmax:
        band *
        (icy ? rand(0.25, 0.5) : isDrizzle ? rand(0.5, 1.0) : rand(1.1, 2.3)) *
        (1 + 0.6 * heavy),
      seed: rand(0, 100),
      sinceTrail: 0
    }
  }

  function newStreak(anywhere: boolean): Streak {
    const len =
      band * (isDrizzle ? rand(0.12, 0.24) : rand(0.4, 0.7) + 0.9 * heavy)
    return {
      x: rand(-0.2, 1.2) * w,
      y: anywhere ? rand(-len, h) : -rand(len, len + h * 0.4),
      len,
      v:
        h *
        (isDrizzle ? rand(0.35, 0.6) : rand(0.8, 1.2) * (0.9 + 1.1 * heavy)),
      alpha: isDrizzle ? rand(0.22, 0.38) : rand(0.34, 0.6) + 0.15 * heavy,
      width: (isDrizzle ? rand(1, 1.5) : rand(1.6, 2.6) + 1.2 * heavy) * px
    }
  }

  function newHail(anywhere: boolean): Particle {
    return {
      x: rand(0, w),
      y: anywhere ? rand(0, h) : -rand(0, h * 0.5),
      vx: band * rand(0.1, 0.4),
      vy: h * rand(1.1, 1.6),
      r: rand(2.4, 4.8) * px,
      bounced: false
    }
  }

  function splash(x: number, strength: number): void {
    if (x < 0 || x > w || env.presence(x, h - poolDepth()) < 0.05) return
    ripples.push({
      x,
      age: 0,
      life: rand(0.6, 1.1),
      size: band * rand(0.12, 0.25) * strength
    })
    if (icy) return
    const n = Math.round(rand(2, 5) * strength)
    for (let i = 0; i < n && splashes.length < SPLASH_CAP; i++) {
      splashes.push({
        x,
        y: h - poolDepth(),
        vx: band * rand(-1, 1),
        vy: -band * rand(1.6, 3) * Math.sqrt(strength),
        r: rand(0.9, 1.8) * px,
        bounced: false
      })
    }
  }

  function drawDrop(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    alpha: number,
    stretch = 1
  ): void {
    if (alpha < 0.02) return
    ctx.globalAlpha = Math.min(1, alpha)
    ctx.drawImage(drop, x - r, y - r * stretch, r * 2, r * 2 * stretch)
  }

  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
      px = detailUnit(band)
      beads = Array.from({ length: beadTarget }, () => newBead(rand(0, 30)))
      runners = Array.from({ length: runnerTarget }, () => newRunner(false))
      streaks = Array.from({ length: streakTarget }, () => newStreak(true))
      hail = Array.from({ length: hailTarget }, () => newHail(true))
      trail = []
      splashes = []
      ripples = []
      veil = null
      poolFill = null
      frost = icy
        ? frostLayer(
            w,
            h,
            band * 1.4,
            px,
            opts.conditionKey === 'freezingRain' || hasHail
          )
        : null
      glints = icy
        ? Array.from({ length: opts.tier === 'high' ? 16 : 10 }, () => {
            // Glints live where the frost is: near an edge.
            const edge = Math.floor(random() * 4)
            const along = random()
            const inset = rand(0, band * 0.9)
            return {
              x: edge < 2 ? along * w : edge === 2 ? inset : w - inset,
              y: edge === 0 ? inset : edge === 1 ? h - inset : along * h,
              size: rand(10, 22) * px,
              freq: rand(0.08, 0.2),
              phase: rand(0, TAU)
            }
          })
        : []
      nearRain?.resize(w, h, band)
    },
    draw(ctx, t, dt, front) {
      if (!veil) {
        veil = ctx.createLinearGradient(0, 0, 0, h * 0.6)
        veil.addColorStop(0, `rgba(22, 34, 50, ${0.32 + 0.2 * heavy})`)
        veil.addColorStop(0.5, `rgba(22, 34, 50, ${0.14 + 0.1 * heavy})`)
        veil.addColorStop(1, 'rgba(22, 34, 50, 0)')
      }
      ctx.fillStyle = veil
      ctx.fillRect(0, 0, w, h * 0.6)
      ctx.fillStyle = `rgba(150, 176, 204, ${0.03 + 0.03 * heavy})`
      ctx.fillRect(0, 0, w, h)

      const poolTop = h - poolDepth()

      // Streaks, in a frame rotated by the wind slant about the top centre.
      ctx.save()
      ctx.setTransform(
        cosS,
        sinS,
        -sinS,
        cosS,
        w / 2 - (cosS * w) / 2,
        (-sinS * w) / 2
      )
      for (let i = 0; i < streaks.length; i++) {
        const s = streaks[i]
        s.y += s.v * dt
        const screenY = sinS * (s.x - w / 2) + cosS * s.y
        if (screenY > poolTop) {
          if (random() < 0.35) {
            splash(cosS * (s.x - w / 2) - sinS * s.y + w / 2, 0.6 + 0.5 * heavy)
          }
          streaks[i] = newStreak(false)
          continue
        }
        ctx.globalAlpha = s.alpha
        ctx.drawImage(streakImg, s.x - s.width, s.y - s.len, s.width * 2, s.len)
      }
      ctx.restore()

      if (frost) {
        ctx.globalAlpha = 1
        ctx.drawImage(frost, 0, 0)
      }

      // New impacts on the pane: refill toward the target, popping in.
      const spawn = Math.min(
        beadTarget - beads.length,
        Math.ceil(dt * 40 * (0.4 + d))
      )
      for (let i = 0; i < spawn; i++) beads.push(newBead())

      for (let i = runners.length - 1; i >= 0; i--) {
        const r = runners[i]
        r.phase += dt * r.rate * TAU
        // Stick-slip: speed swings between ~0 (pinned by surface tension)
        // and vmax (released), weighted by the drop's size.
        const gait = 0.5 - 0.5 * Math.cos(r.phase)
        const v = r.vmax * gait * gait * (r.r / (5 * px))
        const dy = v * dt
        r.y += dy
        r.x = r.x0 + Math.sin((r.y * 0.02) / px + r.seed) * r.r * 0.6
        r.sinceTrail += dy
        if (r.sinceTrail > r.r * 1.2 && trail.length < TRAIL_CAP) {
          r.sinceTrail = 0
          trail.push({
            x: r.x + rand(-0.3, 0.3) * r.r,
            y: r.y - r.r * 0.9,
            r: r.r * rand(0.28, 0.45),
            age: 0,
            life: rand(1.5, 4.5)
          })
        }
        // deliberate: O(beads × runners) absorb scan per frame — ~260 × 21 at
        // most; switch to a spatial grid if either count grows past ~1000.
        for (let j = beads.length - 1; j >= 0; j--) {
          const b = beads[j]
          const dx = b.x - r.x
          const by = b.y - r.y
          const reach = r.r + b.r
          if (dx * dx + by * by < reach * reach) {
            r.r = Math.min(r.r + b.r * 0.08, 12 * px)
            beads.splice(j, 1)
          }
        }
        if (r.y + r.r * 0.5 > surface(r.x, t)) {
          splash(r.x, 1 + 0.5 * heavy)
          runners[i] = newRunner(true)
          continue
        }
        drawDrop(ctx, r.x, r.y, r.r, 1, 1 + gait * 0.3)
      }

      for (let i = trail.length - 1; i >= 0; i--) {
        const b = trail[i]
        b.age += dt
        if (b.age >= b.life) {
          trail.splice(i, 1)
          continue
        }
        drawDrop(ctx, b.x, b.y, b.r, 0.9 * (1 - b.age / b.life))
      }

      ctx.lineWidth = 1.2 * px
      for (let i = beads.length - 1; i >= 0; i--) {
        const b = beads[i]
        b.age += dt
        if (b.age >= b.life) {
          beads.splice(i, 1)
          continue
        }
        const pop = Math.min(1, b.age / 0.18)
        const grow = pop < 1 ? pop * (1.25 - 0.25 * pop) : 1
        const fade = Math.min(1, (b.life - b.age) / 6)
        drawDrop(ctx, b.x, b.y, b.r * (0.5 + 0.5 * grow), 0.95 * fade)
        // Impact ring: a quick bright circle spreading out as the drop lands.
        if (b.age < 0.4 && !isDrizzle) {
          const k = b.age / 0.4
          ctx.globalAlpha = 0.5 * (1 - k)
          ctx.strokeStyle = 'rgba(226, 242, 255, 1)'
          ctx.beginPath()
          ctx.arc(b.x, b.y, b.r * (1 + 2.2 * k), 0, TAU)
          ctx.stroke()
        }
      }

      for (let i = hail.length - 1; i >= 0; i--) {
        const p = hail[i]
        p.vy += gravity() * 0.4 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        if (!p.bounced && p.y > poolTop) {
          p.bounced = true
          p.vy = -Math.abs(p.vy) * 0.3
          p.vx *= rand(-1.5, 1.5)
          splash(p.x, 0.8)
        } else if (p.bounced && p.y > h + p.r) {
          hail[i] = newHail(false)
          continue
        }
        ctx.globalAlpha = p.bounced ? 0.7 : 0.95
        ctx.drawImage(drop, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
      }

      // The pool: rippling surface, gradient body, bright meniscus line.
      if (!poolFill) {
        poolFill = ctx.createLinearGradient(0, h - poolDepth() * 1.2, 0, h)
        poolFill.addColorStop(
          0,
          icy ? 'rgba(214, 234, 252, 0.2)' : 'rgba(166, 214, 250, 0.14)'
        )
        poolFill.addColorStop(
          1,
          icy ? 'rgba(226, 242, 255, 0.42)' : 'rgba(140, 190, 232, 0.34)'
        )
      }
      const steps = 48
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * w
        ctx.lineTo(x, surface(x, t))
      }
      ctx.lineTo(w, h)
      ctx.closePath()
      ctx.fillStyle = poolFill
      ctx.fill()
      ctx.beginPath()
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * w
        if (i === 0) ctx.moveTo(x, surface(x, t))
        else ctx.lineTo(x, surface(x, t))
      }
      ctx.strokeStyle = icy
        ? 'rgba(240, 248, 255, 0.75)'
        : 'rgba(226, 242, 255, 0.6)'
      ctx.lineWidth = (icy ? 2 : 1.6) * px
      ctx.stroke()

      ctx.lineWidth = 1.3 * px
      ctx.strokeStyle = 'rgba(226, 242, 255, 1)'
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i]
        rp.age += dt
        if (rp.age >= rp.life) {
          ripples.splice(i, 1)
          continue
        }
        const k = rp.age / rp.life
        const rx = rp.size * (0.2 + 0.8 * k)
        ctx.globalAlpha = 0.6 * (1 - k)
        ctx.beginPath()
        ctx.ellipse(rp.x, surface(rp.x, t), rx, rx * 0.22, 0, 0, TAU)
        ctx.stroke()
      }

      const g = gravity()
      for (let i = splashes.length - 1; i >= 0; i--) {
        const p = splashes[i]
        p.vy += g * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        if (p.vy > 0 && p.y > poolTop) {
          splashes.splice(i, 1)
          continue
        }
        ctx.globalAlpha = 0.85
        ctx.drawImage(dot, p.x - p.r * 2, p.y - p.r * 2, p.r * 4, p.r * 4)
      }

      if (glintImg) {
        for (const gl of glints) {
          const s = Math.pow(
            Math.max(0, Math.sin(t * gl.freq * TAU + gl.phase)),
            12
          )
          if (s < 0.03) continue
          ctx.globalAlpha = s
          const size = gl.size * (0.6 + 0.4 * s)
          ctx.drawImage(glintImg, gl.x - size / 2, gl.y - size / 2, size, size)
        }
      }
      ctx.globalAlpha = 1
      if (front && nearRain) nearRain.draw(front, dt)
    }
  }
}

export function createEffect(): BorderEffect {
  return createCanvas2dEffect(
    (o) => ({
      fps: FPS[o.tier],
      maxDpr: o.tier === 'high' ? 2 : 1,
      maxPixels: o.tier === 'high' ? 3_000_000 : 1_000_000,
      floor: 0.7,
      front: true
    }),
    rainScene
  )
}

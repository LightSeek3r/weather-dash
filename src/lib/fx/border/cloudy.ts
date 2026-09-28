/**
 * Cloudy: real cloud shapes drifting across the sky on a steady wind, in
 * three parallax layers — small, pale, slow clouds low on the far horizon;
 * big near ones higher up, moving fastest. Each cloud is pre-rendered once
 * as a sprite (a flat-based heap of soft puffs, lit from above: bright tops,
 * greyer bases), so a frame is a handful of blits.
 *
 * `conditionKey` (see types.ts) splits this one module into two readings of
 * the same scene rather than a second file: `partlyCloudy` gets fewer
 * clouds with warm sunlit tops and plenty of clear sky between them;
 * `overcast` gets more, greyer clouds under a continuous cloud deck from the
 * top of the frame (which is also what hides the sky layer's sun). `isDay`
 * swaps sunlight for cooler, dimmer moonlight.
 */
import {
  createCanvas2dEffect,
  makeSprite,
  rand,
  random,
  type Scene2d
} from './common'
import type { BorderEffect, EffectOptions } from './types'

interface Cloud {
  x: number
  y: number
  sprite: HTMLCanvasElement
  layer: number
}

interface Shade {
  top: string
  mid: string
  base: string
}

const TAU = Math.PI * 2

// Per layer (far → near): width in bands, vertical range (fraction of h),
// speed (fraction of w per second), opacity.
const LAYERS = [
  { width: [2, 3.2], y: [0.36, 0.62], speed: 1 / 400, alpha: 0.5 },
  { width: [3.5, 5.5], y: [0.12, 0.46], speed: 1 / 220, alpha: 0.7 },
  { width: [6, 9], y: [-0.08, 0.3], speed: 1 / 120, alpha: 0.82 }
]

function shadeFor(partly: boolean, day: boolean): Shade {
  if (!day) {
    return {
      top: 'rgb(150, 164, 188)',
      mid: 'rgb(104, 118, 142)',
      base: 'rgb(66, 78, 100)'
    }
  }
  return partly
    ? {
        top: 'rgb(255, 246, 230)',
        mid: 'rgb(228, 234, 242)',
        base: 'rgb(164, 178, 198)'
      }
    : {
        top: 'rgb(214, 222, 232)',
        mid: 'rgb(176, 188, 204)',
        base: 'rgb(122, 136, 156)'
      }
}

/** A cumulus: flat-bottomed row of base puffs under a dome of bigger ones. */
function cloudSprite(cw: number, ch: number, shade: Shade): HTMLCanvasElement {
  return makeSprite(cw, ch, (ctx) => {
    const puff = (x: number, y: number, r: number): void => {
      const rr = Math.max(1, Math.min(r, x, cw - x, y, ch - y))
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr)
      g.addColorStop(0, 'rgba(255, 255, 255, 1)')
      g.addColorStop(0.6, 'rgba(255, 255, 255, 0.85)')
      g.addColorStop(1, 'rgba(255, 255, 255, 0)')
      ctx.fillStyle = g
      ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2)
    }
    const baseN = 5 + Math.floor(random() * 4)
    for (let i = 0; i < baseN; i++) {
      const f = baseN === 1 ? 0.5 : i / (baseN - 1)
      puff(cw * (0.14 + 0.72 * f), ch * rand(0.66, 0.74), ch * rand(0.2, 0.28))
    }
    const domeN = 4 + Math.floor(random() * 4)
    for (let i = 0; i < domeN; i++) {
      puff(cw * rand(0.26, 0.74), ch * rand(0.36, 0.56), ch * rand(0.24, 0.36))
    }
    // Recolour the white silhouette, keeping its alpha: lit top, grey base.
    ctx.globalCompositeOperation = 'source-atop'
    const g = ctx.createLinearGradient(0, ch * 0.1, 0, ch * 0.9)
    g.addColorStop(0, shade.top)
    g.addColorStop(0.55, shade.mid)
    g.addColorStop(1, shade.base)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, cw, ch)
    ctx.globalCompositeOperation = 'source-over'
  })
}

/** Overcast deck: a tileable row of wide grey puffs (wrapped at x = 0/w). */
function deckSprite(w: number, dh: number, day: boolean): HTMLCanvasElement {
  return makeSprite(w, dh, (ctx) => {
    const rgb = day ? '150, 162, 180' : '70, 82, 104'
    const top = ctx.createLinearGradient(0, 0, 0, dh)
    top.addColorStop(0, `rgba(${rgb}, 0.7)`)
    top.addColorStop(0.5, `rgba(${rgb}, 0.35)`)
    top.addColorStop(1, `rgba(${rgb}, 0)`)
    ctx.fillStyle = top
    ctx.fillRect(0, 0, w, dh)
    const n = 18
    for (let i = 0; i < n; i++) {
      const x = (i / n) * w + rand(-0.02, 0.02) * w
      const y = dh * rand(0.25, 0.55)
      const r = dh * rand(0.3, 0.5)
      for (const ox of [x - w, x, x + w]) {
        ctx.save()
        ctx.translate(ox, y)
        ctx.scale(2.2, 1)
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
        g.addColorStop(0, `rgba(${rgb}, 0.45)`)
        g.addColorStop(1, `rgba(${rgb}, 0)`)
        ctx.fillStyle = g
        ctx.fillRect(-r, -r, r * 2, r * 2)
        ctx.restore()
      }
    }
  })
}

function cloudyScene(opts: EffectOptions): Scene2d {
  let w = 0
  let h = 0
  let band = 0
  let clouds: Cloud[] = []
  let deck: HTMLCanvasElement | null = null
  const partly = opts.conditionKey === 'partlyCloudy'
  const day = opts.isDay !== false
  const shade = shadeFor(partly, day)
  const tierScale = opts.tier === 'high' ? 1 : 0.7
  const perLayer = (partly ? [3, 3, 2] : [5, 5, 3]).map((n) =>
    Math.max(1, Math.round(n * tierScale * (0.7 + 0.3 * opts.density)))
  )
  const dim = day ? 1 : 0.75

  function makeCloud(layer: number, x?: number): Cloud {
    const L = LAYERS[layer]
    const cw = band * rand(L.width[0], L.width[1])
    const ch = cw * rand(0.42, 0.55)
    return {
      x: x ?? rand(-cw, w),
      y: h * rand(L.y[0], L.y[1]),
      sprite: cloudSprite(cw, ch, shade),
      layer
    }
  }

  return {
    resize(nw, nh, nb) {
      w = nw
      h = nh
      band = nb
      clouds = []
      perLayer.forEach((n, layer) => {
        for (let i = 0; i < n; i++) {
          // Spread each layer's clouds evenly (with jitter) across the width.
          const slot = (i + rand(0.1, 0.9)) / n
          const c = makeCloud(layer)
          c.x = slot * (w + c.sprite.width) - c.sprite.width
          clouds.push(c)
        }
      })
      deck = partly ? null : deckSprite(w, h * 0.34, day)
    },
    draw(ctx, t, dt) {
      if (deck) {
        const off = ((((t * w) / 600) % w) + w) % w
        ctx.globalAlpha = (0.55 + 0.35 * opts.density) * dim
        ctx.drawImage(deck, off - w, 0)
        ctx.drawImage(deck, off, 0)
      }
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i]
        const L = LAYERS[c.layer]
        c.x += w * L.speed * dt
        if (c.x > w) {
          clouds[i] = makeCloud(c.layer, -rand(1, 1.4) * c.sprite.width)
          continue
        }
        // Slow breathing in density, so a cloud never looks pasted on.
        const breathe =
          0.9 + 0.1 * Math.sin(t / 17 + c.y * 0.01 + c.layer * TAU * 0.3)
        ctx.globalAlpha = L.alpha * breathe * dim * (partly ? 0.9 : 1)
        ctx.drawImage(c.sprite, c.x, c.y)
      }
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
      floor: 0.85
    }),
    cloudyScene
  )
}

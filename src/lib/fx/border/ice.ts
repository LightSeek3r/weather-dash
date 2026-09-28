/**
 * The "ice" look shared by freezing rain/drizzle, snow grains and hail:
 * frost crystals grown in from the screen edges (thickest in the corners,
 * like a cold window pane) and a four-point glint sprite for sharp specular
 * sparkles. Both are pre-rendered once per resize, so the per-frame cost is
 * one blit plus a few sprite draws.
 */
import { makeSprite, rand, random } from './common'
import type { EffectOptions } from './types'

const ICY_KEYS = new Set(['freezingRain', 'freezingDrizzle', 'snowGrains'])

export function isIcy(opts: EffectOptions): boolean {
  return opts.hail === true || ICY_KEYS.has(opts.conditionKey ?? '')
}

interface Seg {
  x: number
  y: number
  a: number
  len: number
  depth: number
}

/**
 * Dendritic frost: branches grow inward from seeds on the edges, forking at
 * ±60° (ice's hexagonal habit). `reach` is how far in the frost gets, in px.
 */
export function frostLayer(
  w: number,
  h: number,
  reach: number,
  px: number,
  dense: boolean
): HTMLCanvasElement {
  return makeSprite(w, h, (ctx) => {
    // Soft rime first: whitened corners the crystals grow out of.
    for (const [cx, cy] of [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h]
    ]) {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * 1.6)
      g.addColorStop(0, 'rgba(226, 240, 255, 0.34)')
      g.addColorStop(0.45, 'rgba(214, 232, 250, 0.12)')
      g.addColorStop(1, 'rgba(214, 232, 250, 0)')
      ctx.fillStyle = g
      ctx.fillRect(cx - reach * 1.6, cy - reach * 1.6, reach * 3.2, reach * 3.2)
    }
    const band = reach * 0.5
    const edges: [number, number, number, number, number, number][] = [
      // gradient start/end, then the strip's top-left corner
      [0, 0, 0, band, 0, 0],
      [0, h, 0, h - band, 0, h - band],
      [0, 0, band, 0, 0, 0],
      [w, 0, w - band, 0, w - band, 0]
    ]
    for (const [x0, y0, x1, y1, rx, ry] of edges) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1)
      g.addColorStop(0, 'rgba(226, 240, 255, 0.14)')
      g.addColorStop(1, 'rgba(226, 240, 255, 0)')
      ctx.fillStyle = g
      const horizontal = y0 === y1
      ctx.fillRect(rx, ry, horizontal ? band : w, horizontal ? h : band)
    }

    const seeds: Seg[] = []
    const perimeter = 2 * (w + h)
    const count = Math.round((perimeter / reach) * (dense ? 5 : 3))
    for (let i = 0; i < count; i++) {
      // Bias seeds toward the corners: frost starts where the pane is coldest.
      const u = random()
      const corner = random() < 0.45
      const along = corner ? (u < 0.5 ? u * 0.3 : 1 - (1 - u) * 0.3) : u
      const side = Math.floor(random() * 4)
      let x = 0
      let y = 0
      let a = 0
      if (side === 0) [x, y, a] = [along * w, 0, Math.PI / 2]
      else if (side === 1) [x, y, a] = [along * w, h, -Math.PI / 2]
      else if (side === 2) [x, y, a] = [0, along * h, 0]
      else [x, y, a] = [w, along * h, Math.PI]
      const inCorner = Math.min(along, 1 - along) < 0.15
      seeds.push({
        x,
        y,
        a: a + rand(-0.6, 0.6),
        len: reach * (inCorner ? rand(0.35, 0.6) : rand(0.12, 0.35)),
        depth: dense ? 4 : 3
      })
    }

    ctx.lineCap = 'round'
    const stack = seeds
    let budget = dense ? 6000 : 3500
    // Segments bucketed by thickness, stroked as three paths at the end.
    const levels: number[][] = [[], [], []]
    while (stack.length && budget-- > 0) {
      const s = stack.pop() as Seg
      const x1 = s.x + Math.cos(s.a) * s.len
      const y1 = s.y + Math.sin(s.a) * s.len
      levels[Math.min(2, Math.max(0, 4 - s.depth))].push(s.x, s.y, x1, y1)
      if (s.depth <= 0 || s.len < 2 * px) continue
      // Side needles at hexagonal angles along the branch, then the tip grows on.
      const forks = 2 + Math.floor(random() * 3)
      for (let k = 1; k <= forks; k++) {
        const f = k / (forks + 1)
        const bx = s.x + (x1 - s.x) * f
        const by = s.y + (y1 - s.y) * f
        const sideSign = random() < 0.5 ? -1 : 1
        stack.push({
          x: bx,
          y: by,
          a: s.a + (sideSign * Math.PI) / 3 + rand(-0.12, 0.12),
          len: s.len * rand(0.22, 0.42) * (1 - f * 0.5),
          depth: s.depth - 2
        })
      }
      stack.push({
        x: x1,
        y: y1,
        a: s.a + rand(-0.35, 0.35),
        len: s.len * rand(0.55, 0.75),
        depth: s.depth - 1
      })
    }
    const styles: [number, string][] = [
      [1.6, 'rgba(236, 246, 255, 0.5)'],
      [1.1, 'rgba(226, 240, 255, 0.4)'],
      [0.8, 'rgba(214, 232, 250, 0.32)']
    ]
    levels.forEach((segs, i) => {
      ctx.lineWidth = styles[i][0] * px
      ctx.strokeStyle = styles[i][1]
      ctx.beginPath()
      for (let k = 0; k < segs.length; k += 4) {
        ctx.moveTo(segs[k], segs[k + 1])
        ctx.lineTo(segs[k + 2], segs[k + 3])
      }
      ctx.stroke()
    })
  })
}

/** Four-point star with a hot core — a specular glint off ice. */
export function glintSprite(size: number): HTMLCanvasElement {
  return makeSprite(size, size, (ctx) => {
    const c = size / 2
    const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.35)
    core.addColorStop(0, 'rgba(255, 255, 255, 1)')
    core.addColorStop(1, 'rgba(214, 236, 255, 0)')
    ctx.fillStyle = core
    ctx.fillRect(0, 0, size, size)
    for (const a of [0, Math.PI / 2]) {
      ctx.save()
      ctx.translate(c, c)
      ctx.rotate(a)
      const g = ctx.createLinearGradient(-c, 0, c, 0)
      g.addColorStop(0, 'rgba(226, 242, 255, 0)')
      g.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)')
      g.addColorStop(1, 'rgba(226, 242, 255, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(-c, 0)
      ctx.lineTo(0, -size * 0.035)
      ctx.lineTo(c, 0)
      ctx.lineTo(0, size * 0.035)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
  })
}

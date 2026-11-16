/**
 * Glass surfaces (current weather and 24h timeline cards, the status dot,
 * the gear/fullscreen buttons), tagged `data-fx-calm`.
 *
 * Weather FX flow freely behind them and around them — nothing quiets or
 * veils the sky near a card. The one rule is on the front layer (FX drawn
 * over the page text): a card's own shape, rounded corners included, is
 * erased from it edge to edge, so a near cloud or flake reads as passing
 * behind the card, never over its data. A plain rectangle would also erase
 * the sliver of sky outside each rounded corner and make the card look
 * square-cornered wherever a cloud crosses it.
 *
 * Text sitting straight on the sky (clock, date, tomorrow strip) has no zone:
 * it carries its own contrast (Layout.svelte's `.hero, .tm` text-shadow) and
 * FX may pass behind and in front of it.
 *
 * Rects and radii are CSS px (viewport space); callers scale to their
 * backing store.
 */

/** One corner's horizontal and vertical radius. */
export type CornerRadius = readonly [x: number, y: number]

export interface CalmZone {
  x0: number
  y0: number
  x1: number
  y1: number
  /** Top-left, top-right, bottom-right, bottom-left — as the browser renders them (percentages resolved, oversized radii scaled down). */
  radii: readonly [CornerRadius, CornerRadius, CornerRadius, CornerRadius]
}

/**
 * Front-layer cut-out growth around a panel, CSS px: covers the page's 1px
 * pixel-shift drift between re-measures. Kept at 1 because the front canvas
 * is a low-res backing store (~0.5 px per CSS px) scaled up: every CSS px of
 * margin shows as a strip of bare sky between a cloud and the card.
 */
export const CLEAR_MARGIN = 1

const SELECTOR = '[data-fx-calm]'

const CORNER_PROPS = [
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius'
] as const

/** A computed `border-*-radius` ("12px", "50%", "8px 20px") in px; `%` is relative to the box's width (x) and height (y). */
function cornerRadius(css: string, w: number, h: number): CornerRadius {
  const [a = '', b = a] = css.trim().split(/\s+/)
  const px = (part: string, basis: number): number => {
    const n = parseFloat(part)
    if (!(n > 0)) return 0
    return part.endsWith('%') ? (n / 100) * basis : n
  }
  return [px(a, w), px(b, h)]
}

/** CSS Backgrounds §5.5: when adjacent radii overrun a side, every radius shrinks by the same factor. */
function scaleToFit(
  corners: CornerRadius[],
  w: number,
  h: number
): CalmZone['radii'] {
  const [tl, tr, br, bl] = corners
  const f = Math.min(
    1,
    w / (tl[0] + tr[0]),
    w / (bl[0] + br[0]),
    h / (tl[1] + bl[1]),
    h / (tr[1] + br[1])
  )
  const s = (c: CornerRadius): CornerRadius => [c[0] * f, c[1] * f]
  return [s(tl), s(tr), s(br), s(bl)]
}

export function measureCalmZones(root: ParentNode = document): CalmZone[] {
  const out: CalmZone[] = []
  for (const el of Array.from(root.querySelectorAll(SELECTOR))) {
    const r = el.getBoundingClientRect()
    if (!(r.right > r.left) || !(r.bottom > r.top)) continue
    const style = getComputedStyle(el)
    out.push({
      x0: r.left,
      y0: r.top,
      x1: r.right,
      y1: r.bottom,
      radii: scaleToFit(
        CORNER_PROPS.map((p) => cornerRadius(style[p], r.width, r.height)),
        r.width,
        r.height
      )
    })
  }
  return out
}

/** Cheap change detection — rects rounded to whole px, so sub-pixel jitter doesn't count as a change. */
export function zonesSignature(zones: CalmZone[]): string {
  return zones
    .map(
      (z) =>
        `${Math.round(z.x0)},${Math.round(z.y0)},${Math.round(z.x1)},${Math.round(z.y1)}`
    )
    .join(';')
}

/**
 * Erases every zone's shape (plus CLEAR_MARGIN) from a front-layer canvas.
 * Edges are anti-aliased, not snapped outward to whole backing-store px: at
 * half resolution a snap would widen the gap around a card by up to 2 CSS px.
 * @param cssScale backing-store px per CSS px.
 */
export function clearZones(
  ctx: CanvasRenderingContext2D,
  zones: CalmZone[],
  cssScale: number
): void {
  if (zones.length === 0) return
  // Radii grow with the box so the margin stays an even band around the
  // curve; a square corner (0) stays square.
  const grow = (r: number): number =>
    r > 0 ? (r + CLEAR_MARGIN) * cssScale : 0
  ctx.save()
  // destination-out fill, because clearRect can only erase rectangles. It
  // erases in proportion to the source alpha, so set an opaque style rather
  // than inherit the scene's last (often translucent gradient) one.
  ctx.globalCompositeOperation = 'destination-out'
  ctx.globalAlpha = 1
  ctx.fillStyle = '#000'
  ctx.beginPath()
  for (const z of zones) {
    const x0 = (z.x0 - CLEAR_MARGIN) * cssScale
    const y0 = (z.y0 - CLEAR_MARGIN) * cssScale
    const w = (z.x1 - z.x0 + 2 * CLEAR_MARGIN) * cssScale
    const h = (z.y1 - z.y0 + 2 * CLEAR_MARGIN) * cssScale
    // Older engines lack roundRect: they get the square cut-out, which is
    // still correct, just not as pretty at the corners.
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(
        x0,
        y0,
        w,
        h,
        z.radii.map(([rx, ry]) => ({ x: grow(rx), y: grow(ry) }))
      )
    } else {
      ctx.rect(x0, y0, w, h)
    }
  }
  ctx.fill()
  ctx.restore()
}

/**
 * Calls `onChange` whenever a tagged region may have moved or resized
 * (ResizeObserver where it exists, plus once when web fonts finish loading,
 * which reflows the layout). Viewport resizes are left to the caller, which
 * already listens for them. Returns the unsubscribe.
 */
export function watchCalmZones(onChange: () => void): () => void {
  let active = true
  let ro: ResizeObserver | null = null
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => {
      if (active) onChange()
    })
    for (const el of Array.from(document.querySelectorAll(SELECTOR))) {
      ro.observe(el)
    }
  }
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  fonts?.ready
    ?.then(() => {
      if (active) onChange()
    })
    .catch(() => {})
  return () => {
    active = false
    ro?.disconnect()
    ro = null
  }
}

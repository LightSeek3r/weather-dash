/**
 * Glass surfaces (current weather and 24h timeline cards, the status dot,
 * the gear/fullscreen buttons), tagged `data-fx-calm`.
 *
 * Weather FX flow freely behind them and around them — nothing quiets or
 * veils the sky near a card. The one rule is on the front layer (FX drawn
 * over the page text): a card's own box is erased from it, edge to edge, so
 * a near cloud or flake reads as passing behind the card, never over its data.
 *
 * Text sitting straight on the sky (clock, date, tomorrow strip) has no zone:
 * it carries its own contrast (Layout.svelte's `.hero, .tm` text-shadow) and
 * FX may pass behind and in front of it.
 *
 * Rects are CSS px (viewport space); callers scale to their backing store.
 */

export interface CalmZone {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Front-layer cut-out growth around a panel, CSS px: covers sub-pixel rect rounding and the page's pixel-shift drift between re-measures. */
export const CLEAR_MARGIN = 2

const SELECTOR = '[data-fx-calm]'

export function measureCalmZones(root: ParentNode = document): CalmZone[] {
  const out: CalmZone[] = []
  for (const el of Array.from(root.querySelectorAll(SELECTOR))) {
    const r = el.getBoundingClientRect()
    if (!(r.right > r.left) || !(r.bottom > r.top)) continue
    out.push({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom })
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
 * Erases every zone (plus CLEAR_MARGIN) from a front-layer canvas.
 * @param cssScale backing-store px per CSS px.
 */
export function clearZones(
  ctx: CanvasRenderingContext2D,
  zones: CalmZone[],
  cssScale: number
): void {
  for (const z of zones) {
    const x0 = Math.floor((z.x0 - CLEAR_MARGIN) * cssScale)
    const y0 = Math.floor((z.y0 - CLEAR_MARGIN) * cssScale)
    const x1 = Math.ceil((z.x1 + CLEAR_MARGIN) * cssScale)
    const y1 = Math.ceil((z.y1 + CLEAR_MARGIN) * cssScale)
    ctx.clearRect(x0, y0, x1 - x0, y1 - y0)
  }
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

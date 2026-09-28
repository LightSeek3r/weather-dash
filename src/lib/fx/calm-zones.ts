/**
 * "Calm zones": the parts of the screen weather FX and the sky's sun/moon
 * must stay quiet behind, so nothing bright or busy ever sits under text.
 * Layout.svelte tags its regions with `data-fx-calm`:
 *
 * - `text` (hero clock/date, tomorrow strip — no glass of their own): the
 *   tight boxes of the rendered text itself get strong attenuation, easing
 *   back out over a wide, round-cornered falloff. Measured per text node
 *   via Range rects, so the empty space around a short date line stays
 *   mostly alive;
 * - `glass` (the frosted cap/timeline panels): the panel rect gets moderate
 *   attenuation, ramping *inside* the panel border so the falloff is hidden
 *   under the glass's own blur and the sky outside it isn't dented.
 *
 * Rects are CSS px (viewport space); callers scale to their backing store.
 */

export type CalmKind = 'text' | 'glass'

export interface CalmZone {
  kind: CalmKind
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Presence multiplier deep inside each kind of zone. */
export const CALM_ATTENUATION: Record<CalmKind, number> = {
  text: 0.15,
  glass: 0.5
}

/** Falloff width as a fraction of the viewport's short side. */
export const CALM_FEATHER = 0.035

// Around text, in feathers: fully calm out to PAD, then easing to 1 over RAMP.
// A long, gradual ramp rather than a flat core: over an even wash (fog, sun
// glare) anything shorter reads as a dark panel behind the text.
const TEXT_PAD = 0.3
const TEXT_RAMP = 5

const SELECTOR = '[data-fx-calm]'

function isKind(v: string | undefined): v is CalmKind {
  return v === 'text' || v === 'glass'
}

function pushRect(
  out: CalmZone[],
  kind: CalmKind,
  r: { left: number; top: number; right: number; bottom: number }
): void {
  if (!(r.right > r.left) || !(r.bottom > r.top)) return
  out.push({ kind, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom })
}

function measureText(el: Element, out: CalmZone[]): void {
  const doc = el.ownerDocument
  const range = typeof doc.createRange === 'function' ? doc.createRange() : null
  if (!range || typeof range.getClientRects !== 'function') {
    pushRect(out, 'text', el.getBoundingClientRect())
    return
  }
  const before = out.length
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue
    range.selectNodeContents(n)
    for (const r of Array.from(range.getClientRects())) pushRect(out, 'text', r)
  }
  // Icons sit in the text flow as visually as loud as the words.
  for (const icon of Array.from(el.querySelectorAll('svg, img'))) {
    pushRect(out, 'text', icon.getBoundingClientRect())
  }
  // No layout (or nothing rendered yet): the element box is the safe bound.
  if (out.length === before) pushRect(out, 'text', el.getBoundingClientRect())
}

export function measureCalmZones(root: ParentNode = document): CalmZone[] {
  const out: CalmZone[] = []
  for (const el of Array.from(root.querySelectorAll(SELECTOR))) {
    const kind = (el as HTMLElement).dataset.fxCalm
    if (!isKind(kind)) continue
    if (kind === 'glass') pushRect(out, 'glass', el.getBoundingClientRect())
    else measureText(el, out)
  }
  return out
}

/** Cheap change detection — rects rounded to whole px, so sub-pixel jitter doesn't count as a change. */
export function zonesSignature(zones: CalmZone[]): string {
  return zones
    .map(
      (z) =>
        `${z.kind[0]}${Math.round(z.x0)},${Math.round(z.y0)},${Math.round(z.x1)},${Math.round(z.y1)}`
    )
    .join(';')
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/**
 * Presence multiplier at (x, y) CSS px: 1 in open sky, down to the zone's
 * attenuation inside one. `feather` is the falloff width in CSS px.
 */
export function calmAt(
  zones: CalmZone[],
  x: number,
  y: number,
  feather: number
): number {
  let v = 1
  for (const z of zones) {
    const att = CALM_ATTENUATION[z.kind]
    let k: number
    if (z.kind === 'glass') {
      const inside = Math.min(x - z.x0, z.x1 - x, y - z.y0, z.y1 - y)
      if (inside <= 0) continue
      k = 1 - smoothstep(0, feather, inside)
    } else {
      const dx = Math.max(z.x0 - x, 0, x - z.x1)
      const dy = Math.max(z.y0 - y, 0, y - z.y1)
      const d = Math.hypot(dx, dy)
      const pad = feather * TEXT_PAD
      const end = pad + feather * TEXT_RAMP
      if (d >= end) continue
      k = smoothstep(pad, end, d)
    }
    const value = att + (1 - att) * k
    if (value < v) v = value
  }
  return v
}

/**
 * Calls `onChange` whenever a tagged region may have moved or resized
 * (ResizeObserver where it exists, plus once when web fonts finish loading,
 * which reflows the clock). Viewport resizes are left to the caller, which
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

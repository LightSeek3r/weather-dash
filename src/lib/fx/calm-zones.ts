/**
 * "Calm zones": the glass surfaces (current weather and 24h timeline
 * cards, the status dot, the gear/fullscreen buttons) that weather FX must
 * respect, tagged `data-fx-calm`.
 *
 * - Behind the page (back layer, and the sky's sun/moon) a panel gets strong
 *   attenuation, ramping *inside* its border so the falloff is hidden under
 *   the glass's own blur and the sky outside it isn't dented: the
 *   translucent glass would otherwise pass a bright sun straight through to
 *   its small secondary labels.
 * - In front of the page (front layer) a panel is cut out entirely, plus a
 *   small margin, ramping back in *outside* its border: nothing may ever
 *   paint over a card's data.
 *
 * Text sitting straight on the sky (clock, date, tomorrow strip) has no
 * zone on purpose: quieting FX around it cut visible, text-shaped holes
 * into the weather, so that text carries its own contrast (Layout.svelte's
 * `.hero, .tm` text-shadow) and FX may pass behind and in front of it.
 *
 * Rects are CSS px (viewport space); callers scale to their backing store.
 */

export interface CalmZone {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Back-layer presence multiplier deep inside a panel. */
export const CALM_ATTENUATION = 0.3

/** Falloff width as a fraction of the viewport's short side. */
export const CALM_FEATHER = 0.035

/** Front-layer cut-out margin around a panel, CSS px: covers the page's pixel-shift drift between re-measures. */
export const CLEAR_MARGIN = 8

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

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** Signed distance from (x, y) to the zone's border: positive inside. */
function inset(z: CalmZone, x: number, y: number): number {
  const inside = Math.min(x - z.x0, z.x1 - x, y - z.y0, z.y1 - y)
  if (inside >= 0) return inside
  const dx = Math.max(z.x0 - x, 0, x - z.x1)
  const dy = Math.max(z.y0 - y, 0, y - z.y1)
  return -Math.hypot(dx, dy)
}

/**
 * Back-layer presence multiplier at (x, y) CSS px: 1 in open sky and at a
 * panel's border, easing down to CALM_ATTENUATION over `feather` inside it.
 */
export function calmAt(
  zones: CalmZone[],
  x: number,
  y: number,
  feather: number
): number {
  let v = 1
  for (const z of zones) {
    const d = inset(z, x, y)
    if (d <= 0) continue
    const value = 1 - (1 - CALM_ATTENUATION) * smoothstep(0, feather, d)
    if (value < v) v = value
  }
  return v
}

/**
 * Front-layer presence multiplier at (x, y) CSS px: 0 over a panel and
 * CLEAR_MARGIN around it, easing back to 1 over `feather` outside that.
 */
export function clearAt(
  zones: CalmZone[],
  x: number,
  y: number,
  feather: number
): number {
  let v = 1
  for (const z of zones) {
    const out = -inset(z, x, y) - CLEAR_MARGIN
    if (out >= feather) continue
    const value = smoothstep(0, feather, out)
    if (value < v) v = value
  }
  return v
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

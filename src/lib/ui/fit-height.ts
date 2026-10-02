/**
 * The hero's date/meta lines and the weather card's condition lines wrap
 * differently per locale, saint, holiday and air-quality band, so no fixed
 * type size fits every day: on a long-name day the last line slid under the
 * next card. This shrinks one big element (the clock, the temperature) just
 * enough for its container's content to fit, instead of losing a line.
 * Shrinking it changes how nothing else wraps, so the measurement can't feed
 * back into itself.
 */

/** The big element stays at least this share of its design size. */
export const MIN_FIT = 0.5

/** Scale for an element `targetHeight` tall (at full size) to absorb `overflow`. */
export function shrinkFit(overflow: number, targetHeight: number): number {
  if (overflow <= 0 || targetHeight <= 0) return 1
  // +1: scrollHeight is rounded to whole pixels.
  return Math.max(MIN_FIT, 1 - (overflow + 1) / targetHeight)
}

export interface FitHeightOptions {
  /** Selector, within the container, of the element whose size `prop` scales. */
  target: string
  /** CSS custom property set on the container; the target multiplies its size by it. */
  prop: string
}

/** Svelte action. The container must have a definite height (a grid/flex cell). */
export function fitHeight(
  container: HTMLElement,
  { target, prop }: FitHeightOptions
): { destroy: () => void } {
  const update = (): void => {
    const el = container.querySelector(target)
    if (!el) return
    // Measure at full size; no paint happens between these writes and reads.
    container.style.setProperty(prop, '1')
    const overflow = container.scrollHeight - container.clientHeight
    const fit = shrinkFit(overflow, el.getBoundingClientRect().height)
    container.style.setProperty(prop, fit.toFixed(3))
  }

  const ro =
    typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
  ro?.observe(container)
  for (const child of container.children) ro?.observe(child)
  // Web fonts change line heights after first paint.
  void document.fonts?.ready.then(update)
  update()

  return {
    destroy: () => ro?.disconnect()
  }
}

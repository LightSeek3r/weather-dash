/**
 * Anti-burn-in drift for static UI (plan premortem P5: the clock's lit
 * pixels are identical 24/7). A 1px random-walk step every few minutes,
 * clamped to a small disc, so over hours every static edge is smeared
 * across a ~9x9px area instead of sitting on the same subpixels for weeks.
 *
 * - 1px steps (never a multi-pixel jump) are below what anyone notices at
 *   wall-viewing distance, so no CSS transition is needed — and integer px
 *   keeps text on whole pixels instead of blurring through subpixel frames.
 * - Random walk, not a fixed loop: a short repeating cycle would just burn
 *   in N copies of the same edge; a walk keeps wandering the whole disc.
 * - Radius 4px: similar amplitude to TV-panel "pixel orbiter" features;
 *   small enough that Layout's padding absorbs it with no edge clipping.
 *   Tune on a real OLED if it proves too little (plan open item).
 *
 * Driven by the shared scheduler's `'minute'` tick — see scheduler.ts for
 * why nothing in this app runs its own interval.
 */
import { writable, type Readable } from 'svelte/store'
import { scheduler } from './scheduler'

export const PIXEL_SHIFT_RADIUS_PX = 4
export const PIXEL_SHIFT_EVERY_MINUTES = 3

export interface PixelShiftOffset {
  x: number
  y: number
}

export interface PixelShift {
  offset: Readable<PixelShiftOffset>
  destroy(): void
}

export interface PixelShiftOptions {
  /** Injectable for deterministic tests; defaults to `Math.random`. */
  random?: () => number
}

const STEPS: readonly PixelShiftOffset[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 }
]

function withinRadius(p: PixelShiftOffset): boolean {
  return p.x * p.x + p.y * p.y <= PIXEL_SHIFT_RADIUS_PX * PIXEL_SHIFT_RADIUS_PX
}

/** One random 8-neighbour step that stays inside the disc — at least one always exists (any step back toward the centre). */
export function nextPixelShift(
  from: PixelShiftOffset,
  random: () => number = Math.random
): PixelShiftOffset {
  const candidates = STEPS.map((s) => ({
    x: from.x + s.x,
    y: from.y + s.y
  })).filter(withinRadius)
  const pick = Math.min(
    candidates.length - 1,
    Math.floor(random() * candidates.length)
  )
  return candidates[pick]
}

export function createPixelShift(options: PixelShiftOptions = {}): PixelShift {
  const random = options.random ?? Math.random
  let current: PixelShiftOffset = { x: 0, y: 0 }
  const offset = writable<PixelShiftOffset>(current)

  let minutes = 0
  let unsubscribe: (() => void) | null = scheduler.on('minute', () => {
    minutes += 1
    if (minutes < PIXEL_SHIFT_EVERY_MINUTES) return
    minutes = 0
    current = nextPixelShift(current, random)
    offset.set(current)
  })

  return {
    offset,
    destroy(): void {
      unsubscribe?.()
      unsubscribe = null
    }
  }
}

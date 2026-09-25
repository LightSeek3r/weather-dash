/**
 * Advances the active background photo on a schedule (plan decision:
 * rotation durations 1 min .. 24 h). Reuses the shared scheduler's
 * `'minute'` tick rather than a dedicated `setInterval` — this app has hit
 * real bugs before from components each running their own timer. Minute
 * resolution is coarser than every configurable duration by design: 1
 * minute is the shortest setting, so tracking elapsed whole minutes has no
 * visible imprecision at any setting.
 */
import { writable, type Readable } from 'svelte/store'
import { scheduler } from '../core/scheduler'
import type { Settings } from '../core/storage/settings'
import type { StoredPhoto } from './types'

export const ROTATION_MS: Record<
  Settings['photos']['rotationDuration'],
  number
> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '10m': 10 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '2h': 2 * 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '12h': 12 * 60 * 60_000,
  '24h': 24 * 60 * 60_000
}

const MINUTE_MS = 60_000

export interface PhotoRotation {
  /** `null` when there are no photos — caller (`Background.svelte`) falls back to the weather-sky background, already the `Layout` default. */
  current: Readable<StoredPhoto | null>
  destroy(): void
}

/** Random index in `[0, length)` that differs from `excludeIndex` when `length > 1` — avoids an immediate repeat without full Fisher-Yates reshuffling. */
function randomIndexExcluding(length: number, excludeIndex: number): number {
  if (length <= 1) return 0
  const next = Math.floor(Math.random() * length)
  return next === excludeIndex ? (next + 1) % length : next
}

export function createPhotoRotation(
  photos: StoredPhoto[],
  durationMs: number,
  shuffle: boolean
): PhotoRotation {
  // Fixed cycle order for non-shuffle mode, established once at creation —
  // stable regardless of the order the caller's array happens to be in.
  const ordered = shuffle
    ? photos
    : [...photos].sort((a, b) => a.addedAt - b.addedAt)

  let index = 0
  const state = writable<StoredPhoto | null>(ordered[0] ?? null)

  let elapsedMs = 0
  let unsubscribe: (() => void) | null = null

  // 0 or 1 photos: nothing to ever rotate to, so skip subscribing entirely
  // rather than spin a listener that would only ever re-set the same value.
  if (ordered.length > 1) {
    unsubscribe = scheduler.on('minute', () => {
      elapsedMs += MINUTE_MS
      if (elapsedMs < durationMs) return
      elapsedMs = 0

      index = shuffle
        ? randomIndexExcluding(ordered.length, index)
        : (index + 1) % ordered.length
      state.set(ordered[index])
    })
  }

  return {
    current: state,
    destroy(): void {
      unsubscribe?.()
      unsubscribe = null
    }
  }
}

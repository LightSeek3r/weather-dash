/**
 * Status pill logic — the antidote to toast spam for *stale data* (plan
 * premortem P6): a persistent, non-toast indicator like "updated 2h ago" or
 * "offline", instead of a toast firing every failed background refresh.
 */

export interface EventTargetLike {
  addEventListener(type: 'online' | 'offline', listener: () => void): void
  removeEventListener(type: 'online' | 'offline', listener: () => void): void
}

export interface NavigatorLike {
  onLine: boolean
}

/** Reads current connectivity; safe to call where `navigator` doesn't exist (SSR/tests). */
export function getOnlineStatus(nav?: NavigatorLike): boolean {
  if (nav) return nav.onLine
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

/**
 * Subscribes to online/offline transitions. Accepts an injectable target so
 * this is testable without dispatching real browser events — defaults to
 * `window`.
 */
export function subscribeOnlineStatus(
  cb: (online: boolean) => void,
  target: EventTargetLike | undefined = typeof window !== 'undefined'
    ? window
    : undefined
): () => void {
  if (!target) return () => {}

  const onOnline = () => cb(true)
  const onOffline = () => cb(false)
  target.addEventListener('online', onOnline)
  target.addEventListener('offline', onOffline)

  return () => {
    target.removeEventListener('online', onOnline)
    target.removeEventListener('offline', onOffline)
  }
}

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Pure, testable relative-time formatter. Rounding rule (consistent, always
 * floors towards the coarser unit — a stale-data indicator only needs to be
 * roughly right):
 *  - < 60s        → "just now"
 *  - < 60m        → "{n}m ago"
 *  - < 24h        → "{n}h ago"
 *  - exactly 1 day → "yesterday"
 *  - otherwise     → "{n}d ago"
 * A `date` in the future (clock skew) clamps to "just now" rather than
 * showing a negative duration.
 */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const deltaSec = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 1000)
  )

  if (deltaSec < MINUTE) return 'just now'
  if (deltaSec < HOUR) return `${Math.floor(deltaSec / MINUTE)}m ago`
  if (deltaSec < DAY) return `${Math.floor(deltaSec / HOUR)}h ago`

  const days = Math.floor(deltaSec / DAY)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

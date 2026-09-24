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

/** Locale-specific words plugged into `relativeTime` — see `lib/ui/strings.ts`. */
export interface RelativeTimeLabels {
  justNow: string
  minutesAgo: (n: number) => string
  hoursAgo: (n: number) => string
  yesterday: string
  daysAgo: (n: number) => string
}

const ENGLISH_LABELS: RelativeTimeLabels = {
  justNow: 'just now',
  minutesAgo: (n) => `${n}m ago`,
  hoursAgo: (n) => `${n}h ago`,
  yesterday: 'yesterday',
  daysAgo: (n) => `${n}d ago`
}

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
 *
 * `labels` defaults to English so every existing call site/test keeps
 * working unchanged; callers that care about the viewer's locale pass
 * `t(locale).status.relative` instead (see StatusPill.svelte).
 */
export function relativeTime(
  date: Date,
  now: Date = new Date(),
  labels: RelativeTimeLabels = ENGLISH_LABELS
): string {
  const deltaSec = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 1000)
  )

  if (deltaSec < MINUTE) return labels.justNow
  if (deltaSec < HOUR) return labels.minutesAgo(Math.floor(deltaSec / MINUTE))
  if (deltaSec < DAY) return labels.hoursAgo(Math.floor(deltaSec / HOUR))

  const days = Math.floor(deltaSec / DAY)
  if (days === 1) return labels.yesterday
  return labels.daysAgo(days)
}

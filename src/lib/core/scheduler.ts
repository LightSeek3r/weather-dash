/**
 * Single shared tick source for the whole app. Runs 24/7, so every consumer
 * subscribes here instead of running its own setInterval — one leak-prone
 * timer to reason about instead of N.
 *
 * - `second` tick: drives the clock display only.
 * - `minute` tick: drives anything that needs "now" but not sub-minute
 *   precision (status pill "updated Xm ago", pixel-shift drift).
 * - `midnight` tick: fires once when the local calendar day rolls over —
 *   explicit, not inferred from hourly refresh (see plan P7: hourly refresh
 *   alone leaves day-number/week/holiday wrong until the next refresh).
 * - `hour` tick: drives weather/AQ refetch.
 *
 * `second`/`minute` pause when the tab is hidden (`document.hidden`) to
 * avoid background battery/CPU burn on a device that's still "on" but not
 * the active tab — they catch up (fire once immediately) on visibility
 * return. `hour`/`midnight` do NOT pause: they're cheap, low-frequency, and
 * drive correctness-critical data (weather refetch, day rollover) on a
 * 24/7 wall display that's meant to already be right when glanced at, not
 * only once touched — see plan decision "live-usage fixes" (a hidden tab
 * silently freezing weather for an unbounded time was reported live).
 */

type TickKind = 'second' | 'minute' | 'hour' | 'midnight'
type Listener = (now: Date) => void

function localDateKey(d: Date): string {
  // deliberate: local calendar day, not UTC — a midnight tick must fire at
  // the *viewer's* midnight, not UTC midnight.
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export class Scheduler {
  private listeners = new Map<TickKind, Set<Listener>>([
    ['second', new Set()],
    ['minute', new Set()],
    ['hour', new Set()],
    ['midnight', new Set()]
  ])

  private timerId: ReturnType<typeof setInterval> | null = null
  private lastMinute = -1
  private lastHour = -1
  private lastDateKey = ''
  private visibilityHandler = () => this.onVisibilityChange()

  start(): void {
    if (this.timerId !== null) return // already running
    const now = new Date()
    this.lastMinute = now.getMinutes()
    this.lastHour = now.getHours()
    this.lastDateKey = localDateKey(now)
    this.timerId = setInterval(() => this.tick(), 1000)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler)
    }
  }

  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId)
      this.timerId = null
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
    }
  }

  on(kind: TickKind, fn: Listener): () => void {
    this.listeners.get(kind)!.add(fn)
    return () => this.listeners.get(kind)!.delete(fn)
  }

  private onVisibilityChange(): void {
    if (typeof document !== 'undefined' && !document.hidden) {
      // Catch up immediately on return so the clock doesn't sit stale for
      // up to a second, and any missed hour/midnight boundary is detected
      // on the next tick() below rather than waited out.
      this.tick()
    }
  }

  private tick(): void {
    const now = new Date()
    const hidden = typeof document !== 'undefined' && document.hidden

    // hour/midnight: never gated by hidden — see class doc.
    const hour = now.getHours()
    if (hour !== this.lastHour) {
      this.lastHour = hour
      this.emit('hour', now)
    }

    const dateKey = localDateKey(now)
    if (dateKey !== this.lastDateKey) {
      this.lastDateKey = dateKey
      this.emit('midnight', now)
    }

    if (hidden) return

    this.emit('second', now)

    const minute = now.getMinutes()
    if (minute !== this.lastMinute) {
      this.lastMinute = minute
      this.emit('minute', now)
    }
  }

  private emit(kind: TickKind, now: Date): void {
    for (const fn of this.listeners.get(kind)!) fn(now)
  }
}

/** App-wide singleton — see module doc for why there's only one timer. */
export const scheduler = new Scheduler()

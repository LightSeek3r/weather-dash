/**
 * The weather integration point the UI layer consumes. Reuses the app's
 * single tick source (`scheduler.on('hour'|'midnight', ...)`, plan
 * decision: hourly refresh) instead of a second timer, and the shared
 * deduped/rate-limited `toast.error` (plan premortem P6) instead of a
 * bespoke notification path.
 *
 * On a failed refresh the last-good `snapshot` is deliberately left in
 * place (only `status` flips to `'error'`) — plan premortem P6: a stale
 * reading beats a blank screen on a 24/7 unattended kiosk.
 */
import { writable, get, type Readable } from 'svelte/store'
import { settingsStore, type Settings } from '../core/storage/settings'
import { scheduler } from '../core/scheduler'
import { toast } from '../ui/toast'
import { t } from '../ui/strings'
import { fetchWeatherSnapshot, fetchAirQuality } from './openMeteo'
import { moonPhase } from './moon'
import { getCachedSnapshot, setCachedSnapshot } from './cache'
import type { WeatherSnapshot } from './types'

const STALE_AFTER_MS = 61 * 60_000
// Retry delay doubles with each consecutive failure (2, 4, 8, 16, then 30
// minutes at most): a free, community-run API that is down must not be hit
// every couple of minutes by every open dashboard.
const RETRY_BASE_MS = 2 * 60_000
const RETRY_MAX_MS = 30 * 60_000

export interface WeatherState {
  snapshot: WeatherSnapshot | null
  status: 'idle' | 'loading' | 'error'
  /** Derived from `snapshot.fetchedAt`, or `null` if never successfully fetched. */
  lastUpdated: Date | null
}

const INITIAL_STATE: WeatherState = {
  snapshot: null,
  status: 'idle',
  lastUpdated: null
}

const state = writable<WeatherState>({ ...INITIAL_STATE })
export const weatherStore: Readable<WeatherState> = state

/** Test/dev helper — resets the in-memory weather state (module-level singleton, like toast.ts's `clearAllToasts`). */
export function resetWeatherStoreForTests(): void {
  state.set({ ...INITIAL_STATE })
}

/**
 * Debug-only: substitutes a canned snapshot for `?weather=<state>` (see
 * `lib/core/debug-params.ts` + `lib/weather/debug-snapshots.ts`) instead of
 * a real fetch. Called from `App.svelte`'s `onMount` in place of
 * `initWeather()` — never both — so this never races a real fetch
 * overwriting it. Dead code in production (only reachable behind the debug
 * query param at the call site).
 */
export function setDebugWeatherSnapshot(snapshot: WeatherSnapshot): void {
  state.set({
    snapshot,
    status: 'idle',
    lastUpdated: new Date(snapshot.fetchedAt)
  })
}

function locationKey(location: Settings['location']): string | null {
  return location ? `${location.lat},${location.lon}` : null
}

/** Call once (e.g. from App.svelte's `onMount`). Returns a cleanup function that unsubscribes from settings/scheduler. */
export function initWeather(): () => void {
  // Cache paints instantly on boot, before the first fetch resolves — only
  // fills `snapshot`, never overwrites `status` (a fetch already in flight
  // may resolve `status` to 'loading'/'error' before this promise settles).
  getCachedSnapshot().then((cached) => {
    if (!cached) return
    state.update((s) =>
      s.snapshot
        ? s
        : {
            snapshot: cached,
            status: s.status,
            lastUpdated: new Date(cached.fetchedAt)
          }
    )
  })

  // Requests are numbered when they start. A response older than one that
  // already landed is dropped: after a long sleep the stalled request can
  // answer last, and its hours-old snapshot must not replace the fresh one.
  let startedSeq = 0
  let committedSeq = 0
  let inFlight = 0
  let lastAttemptAt = 0
  let consecutiveFailures = 0

  async function runFetch(
    location: NonNullable<Settings['location']>
  ): Promise<void> {
    const seq = ++startedSeq
    lastAttemptAt = Date.now()
    inFlight += 1
    state.update((s) => ({ ...s, status: 'loading' }))
    try {
      const [forecast, airQuality] = await Promise.all([
        fetchWeatherSnapshot(location.lat, location.lon),
        fetchAirQuality(location.lat, location.lon)
      ])
      if (seq < committedSeq) return
      committedSeq = seq
      consecutiveFailures = 0
      const snapshot: WeatherSnapshot = {
        ...forecast,
        location: { ...forecast.location, name: location.name },
        airQuality,
        moon: moonPhase(new Date())
      }
      state.set({
        snapshot,
        status: 'idle',
        lastUpdated: new Date(snapshot.fetchedAt)
      })
      await setCachedSnapshot(snapshot)
    } catch (err) {
      if (seq < committedSeq) return
      consecutiveFailures += 1
      console.warn('[weather] refresh failed, keeping last-good snapshot', err)
      state.update((s) => ({ ...s, status: 'error' }))
      toast.error(t(get(settingsStore).locale).weather.fetchError)
    } finally {
      inFlight -= 1
    }
  }

  // The hour tick below is a single attempt per hour. This is the safety net
  // under it: a failed attempt (typically the first one after a device wakes,
  // before the network is back) or a snapshot more than an hour old, because
  // a tick was missed, is retried on the next minute instead of waiting for
  // the following top of the hour.
  function refreshIfDue(now: Date, { force = false } = {}): void {
    const { location } = get(settingsStore)
    if (!location || inFlight > 0) return
    const wait = Math.min(
      RETRY_BASE_MS * 2 ** Math.max(0, consecutiveFailures - 1),
      RETRY_MAX_MS
    )
    if (!force && now.getTime() - lastAttemptAt < wait) return
    const fetchedAt = Date.parse(get(state).snapshot?.fetchedAt ?? '')
    const stale =
      !Number.isFinite(fetchedAt) || now.getTime() - fetchedAt >= STALE_AFTER_MS
    if (consecutiveFailures > 0 || stale) void runFetch(location)
  }

  // `settingsStore.subscribe` fires immediately with the current value —
  // that first call doubles as "do we already have a location on boot?"
  // without a separate startup fetch path.
  let initialized = false
  let lastKey: string | null = null
  const unsubscribeSettings = settingsStore.subscribe((settings) => {
    const key = locationKey(settings.location)
    if (!initialized) {
      initialized = true
      lastKey = key
      if (settings.location) void runFetch(settings.location)
      return
    }
    if (key !== lastKey) {
      lastKey = key
      if (settings.location) void runFetch(settings.location)
    }
  })

  // Refetch on every hour tick, and also on midnight — the two ticks
  // usually coincide, but subscribing to both matches the scheduler's own
  // documented contract (midnight exists precisely so day-rollover-
  // sensitive data, like `tomorrow`, isn't left waiting on the coarser
  // hourly cadence) and is what actually makes `tomorrow` catch up the
  // instant local midnight ticks even if an hour tick were ever missed.
  // scheduler.ts's `tick()` passes the *same* Date instance to both the
  // `hour` and `midnight` emit when they coincide (real local midnight) —
  // comparing timestamps collapses that into a single fetch, not two.
  let lastRefetchTick = -1
  function refetchIfLocated(now: Date): void {
    if (now.getTime() === lastRefetchTick) return
    lastRefetchTick = now.getTime()
    const { location } = get(settingsStore)
    if (location) void runFetch(location)
  }
  const unsubscribeHour = scheduler.on('hour', refetchIfLocated)
  const unsubscribeMidnight = scheduler.on('midnight', refetchIfLocated)
  const unsubscribeMinute = scheduler.on('minute', (now) => refreshIfDue(now))

  // The network coming back is the moment a failed attempt can succeed.
  const onOnline = (): void => refreshIfDue(new Date(), { force: true })
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline)

  return () => {
    unsubscribeSettings()
    unsubscribeHour()
    unsubscribeMidnight()
    unsubscribeMinute()
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline)
    }
  }
}

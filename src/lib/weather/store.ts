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

  async function runFetch(
    location: NonNullable<Settings['location']>
  ): Promise<void> {
    state.update((s) => ({ ...s, status: 'loading' }))
    try {
      const [forecast, airQuality] = await Promise.all([
        fetchWeatherSnapshot(location.lat, location.lon),
        fetchAirQuality(location.lat, location.lon)
      ])
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
      console.warn('[weather] refresh failed, keeping last-good snapshot', err)
      state.update((s) => ({ ...s, status: 'error' }))
      toast.error(t(get(settingsStore).locale).weather.fetchError)
    }
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

  return () => {
    unsubscribeSettings()
    unsubscribeHour()
    unsubscribeMidnight()
  }
}

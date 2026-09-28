import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('../../../src/lib/weather/openMeteo', () => ({
  fetchWeatherSnapshot: vi.fn(),
  fetchAirQuality: vi.fn()
}))
vi.mock('../../../src/lib/weather/cache', () => ({
  getCachedSnapshot: vi.fn(),
  setCachedSnapshot: vi.fn()
}))
vi.mock('../../../src/lib/ui/toast', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), dismiss: vi.fn() }
}))

import {
  fetchWeatherSnapshot,
  fetchAirQuality
} from '../../../src/lib/weather/openMeteo'
import {
  getCachedSnapshot,
  setCachedSnapshot
} from '../../../src/lib/weather/cache'
import { toast } from '../../../src/lib/ui/toast'
import {
  initWeather,
  weatherStore,
  resetWeatherStoreForTests,
  setDebugWeatherSnapshot
} from '../../../src/lib/weather/store'
import {
  settingsStore,
  defaultSettings
} from '../../../src/lib/core/storage/settings'
import { scheduler } from '../../../src/lib/core/scheduler'
import type { WeatherSnapshot } from '../../../src/lib/weather/types'

function makeSnapshot(
  overrides: Partial<WeatherSnapshot> = {}
): WeatherSnapshot {
  return {
    fetchedAt: '2026-09-24T17:30:00.000Z',
    location: { lat: 50.85, lon: 4.35, name: '', timezone: 'Europe/Brussels' },
    current: {
      time: '2026-09-24T17:30',
      temperature: 20,
      feelsLike: 18,
      humidity: 40,
      uvIndex: 1,
      isDay: true,
      weatherCode: 3,
      windSpeedKmh: 10,
      windGustsKmh: 15,
      windDirectionDeg: 180,
      precipitationMm: 0,
      precipitationProbability: 0
    },
    hourly: [],
    today: {
      date: '2026-09-24',
      weatherCode: 3,
      tempMin: 15,
      tempMax: 20,
      precipitationProbability: 0,
      windSpeedKmh: 10,
      sunrise: '2026-09-24T07:31',
      sunset: '2026-09-24T19:36'
    },
    tomorrow: {
      date: '2026-09-25',
      weatherCode: 3,
      tempMin: 14,
      tempMax: 22,
      precipitationProbability: 0,
      windSpeedKmh: 10,
      sunrise: '2026-09-25T07:33',
      sunset: '2026-09-25T19:34'
    },
    airQuality: null,
    moon: { fraction: 0.1, labelKey: 'waxingCrescent' },
    ...overrides
  }
}

const BRUSSELS = { lat: 50.85, lon: 4.35, name: 'Brussels' }

describe('weather store', () => {
  let cleanup: (() => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T10:00:00'))
    settingsStore.set(defaultSettings()) // location: null
    resetWeatherStoreForTests() // module-level singleton — see store.ts
    vi.mocked(getCachedSnapshot).mockResolvedValue(null)
    vi.mocked(setCachedSnapshot).mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    scheduler.stop()
    vi.useRealTimers()
  })

  it('(a) does not fetch while location is null', async () => {
    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchWeatherSnapshot).not.toHaveBeenCalled()
    const state = get(weatherStore)
    expect(state.status).toBe('idle')
    expect(state.snapshot).toBeNull()
  })

  it('(b) fetches once a location is set', async () => {
    vi.mocked(fetchWeatherSnapshot).mockResolvedValue(makeSnapshot())
    vi.mocked(fetchAirQuality).mockResolvedValue(null)

    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchWeatherSnapshot).not.toHaveBeenCalled()

    settingsStore.update((s) => ({ ...s, location: BRUSSELS }))
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchWeatherSnapshot).toHaveBeenCalledTimes(1)
    expect(fetchWeatherSnapshot).toHaveBeenCalledWith(
      BRUSSELS.lat,
      BRUSSELS.lon
    )
    const state = get(weatherStore)
    expect(state.status).toBe('idle')
    expect(state.snapshot?.location.name).toBe('Brussels')
    expect(state.lastUpdated).toBeInstanceOf(Date)
  })

  it('(c) refetches on the scheduler hour tick', async () => {
    vi.setSystemTime(new Date('2026-09-24T17:59:58'))
    vi.mocked(fetchWeatherSnapshot).mockResolvedValue(makeSnapshot())
    vi.mocked(fetchAirQuality).mockResolvedValue(null)
    settingsStore.set({ ...defaultSettings(), location: BRUSSELS })

    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchWeatherSnapshot).toHaveBeenCalledTimes(1)

    scheduler.start()
    await vi.advanceTimersByTimeAsync(4000) // crosses the 18:00:00 hour boundary

    expect(fetchWeatherSnapshot).toHaveBeenCalledTimes(2)
  })

  it('(c2) refetches on the scheduler midnight tick', async () => {
    vi.setSystemTime(new Date('2026-09-24T23:59:58'))
    vi.mocked(fetchWeatherSnapshot).mockResolvedValue(makeSnapshot())
    vi.mocked(fetchAirQuality).mockResolvedValue(null)
    settingsStore.set({ ...defaultSettings(), location: BRUSSELS })

    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchWeatherSnapshot).toHaveBeenCalledTimes(1)

    scheduler.start()
    await vi.advanceTimersByTimeAsync(4000) // crosses into 2026-09-25

    // hour and midnight coincide here, but both are subscribed — must not
    // double-fetch on the same tick() call.
    expect(fetchWeatherSnapshot).toHaveBeenCalledTimes(2)
  })

  it('(c3) still refetches on the hour tick while the document is hidden', async () => {
    vi.setSystemTime(new Date('2026-09-24T17:59:58'))
    vi.mocked(fetchWeatherSnapshot).mockResolvedValue(makeSnapshot())
    vi.mocked(fetchAirQuality).mockResolvedValue(null)
    settingsStore.set({ ...defaultSettings(), location: BRUSSELS })

    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchWeatherSnapshot).toHaveBeenCalledTimes(1)

    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true
    })
    scheduler.start()
    await vi.advanceTimersByTimeAsync(4000) // crosses 18:00:00 while hidden

    expect(fetchWeatherSnapshot).toHaveBeenCalledTimes(2)
    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true
    })
  })

  it('(d) keeps the previous snapshot and toasts on a failed refetch', async () => {
    const goodSnapshot = makeSnapshot()
    vi.mocked(fetchWeatherSnapshot)
      .mockResolvedValueOnce(goodSnapshot)
      .mockRejectedValueOnce(new Error('boom'))
    vi.mocked(fetchAirQuality).mockResolvedValue(null)

    settingsStore.set({ ...defaultSettings(), location: BRUSSELS })
    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)
    expect(get(weatherStore).snapshot?.fetchedAt).toBe(goodSnapshot.fetchedAt)

    // Location change triggers a second fetch, which this time rejects.
    settingsStore.update((s) => ({
      ...s,
      location: { lat: 10, lon: 10, name: 'Elsewhere' }
    }))
    await vi.advanceTimersByTimeAsync(0)

    const state = get(weatherStore)
    expect(state.status).toBe('error')
    // Stale-but-shown (plan P6): last-good snapshot is untouched, not cleared.
    expect(state.snapshot?.fetchedAt).toBe(goodSnapshot.fetchedAt)
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('(e) reads the cache on init and writes it on a successful fetch', async () => {
    const cached = makeSnapshot({ fetchedAt: '2026-09-01T00:00:00.000Z' })
    vi.mocked(getCachedSnapshot).mockResolvedValue(cached)
    vi.mocked(fetchWeatherSnapshot).mockResolvedValue(makeSnapshot())
    vi.mocked(fetchAirQuality).mockResolvedValue(null)

    cleanup = initWeather() // no location yet
    await vi.advanceTimersByTimeAsync(0)

    expect(getCachedSnapshot).toHaveBeenCalledTimes(1)
    expect(get(weatherStore).snapshot?.fetchedAt).toBe(cached.fetchedAt)
    expect(get(weatherStore).status).toBe('idle')
    expect(setCachedSnapshot).not.toHaveBeenCalled()

    settingsStore.update((s) => ({ ...s, location: BRUSSELS }))
    await vi.advanceTimersByTimeAsync(0)

    expect(setCachedSnapshot).toHaveBeenCalledTimes(1)
    expect(get(weatherStore).snapshot?.fetchedAt).not.toBe(cached.fetchedAt)
  })

  it('refetches when location changes to a different lat/lon', async () => {
    vi.mocked(fetchWeatherSnapshot).mockResolvedValue(makeSnapshot())
    vi.mocked(fetchAirQuality).mockResolvedValue(null)
    settingsStore.set({ ...defaultSettings(), location: BRUSSELS })

    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchWeatherSnapshot).toHaveBeenCalledTimes(1)

    settingsStore.update((s) => ({
      ...s,
      location: { lat: 48.85, lon: 2.35, name: 'Paris' }
    }))
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchWeatherSnapshot).toHaveBeenCalledTimes(2)
    expect(fetchWeatherSnapshot).toHaveBeenLastCalledWith(48.85, 2.35)
  })

  // Debug-only path (see lib/core/debug-params.ts `?weather=`) — a direct
  // store write, never combined with initWeather()'s real fetch.
  it('setDebugWeatherSnapshot sets the snapshot/status/lastUpdated directly, with no fetch involved', () => {
    const snapshot = makeSnapshot({ fetchedAt: '2026-01-15T15:00:00.000Z' })

    setDebugWeatherSnapshot(snapshot)

    const state = get(weatherStore)
    expect(state.snapshot).toBe(snapshot)
    expect(state.status).toBe('idle')
    expect(state.lastUpdated).toEqual(new Date(snapshot.fetchedAt))
    expect(fetchWeatherSnapshot).not.toHaveBeenCalled()
    expect(fetchAirQuality).not.toHaveBeenCalled()
  })
})

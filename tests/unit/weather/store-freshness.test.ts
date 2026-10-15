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
import {
  initWeather,
  weatherStore,
  resetWeatherStoreForTests
} from '../../../src/lib/weather/store'
import {
  settingsStore,
  defaultSettings
} from '../../../src/lib/core/storage/settings'
import { scheduler } from '../../../src/lib/core/scheduler'
import type { WeatherSnapshot } from '../../../src/lib/weather/types'

const BRUSSELS = { lat: 50.85, lon: 4.35, name: 'Brussels' }

function snapshot(fetchedAt: string, temperature: number): WeatherSnapshot {
  return {
    fetchedAt,
    location: { lat: 50.85, lon: 4.35, name: '', timezone: 'Europe/Brussels' },
    current: {
      time: '2026-09-24T17:30',
      temperature,
      feelsLike: temperature,
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
    moon: { fraction: 0.1, labelKey: 'waxingCrescent' }
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('weather store freshness', () => {
  let cleanup: (() => void) | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T10:20:00'))
    settingsStore.set({ ...defaultSettings(), location: BRUSSELS })
    resetWeatherStoreForTests()
    vi.mocked(getCachedSnapshot).mockResolvedValue(null)
    vi.mocked(setCachedSnapshot).mockResolvedValue(undefined)
    vi.mocked(fetchAirQuality).mockResolvedValue(null)
  })

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    scheduler.stop()
    vi.useRealTimers()
  })

  it('never lets a slow, older response overwrite a newer snapshot', async () => {
    vi.setSystemTime(new Date('2026-09-24T17:59:58'))
    // The 17:59 request stalls (device asleep, flaky network) ...
    const stalled = deferred<WeatherSnapshot>()
    vi.mocked(fetchWeatherSnapshot)
      .mockReturnValueOnce(stalled.promise)
      .mockResolvedValueOnce(snapshot('2026-09-24T16:00:01.000Z', 21))

    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchWeatherSnapshot).toHaveBeenCalledTimes(1)

    // ... the 18:00 tick fetches fresh data ...
    scheduler.start()
    await vi.advanceTimersByTimeAsync(4000)
    expect(get(weatherStore).snapshot?.current.temperature).toBe(21)

    // ... and the old request finally answers, hours of data behind.
    stalled.resolve(snapshot('2026-09-24T13:00:00.000Z', 14))
    await vi.advanceTimersByTimeAsync(0)

    expect(get(weatherStore).snapshot?.current.temperature).toBe(21)
  })

  it('retries within minutes after a failed fetch instead of waiting for the next hour', async () => {
    vi.mocked(fetchWeatherSnapshot)
      .mockRejectedValueOnce(new Error('network not ready after wake'))
      .mockResolvedValueOnce(snapshot(new Date().toISOString(), 19))

    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)
    expect(get(weatherStore).status).toBe('error')

    scheduler.start()
    await vi.advanceTimersByTimeAsync(3 * 60_000) // 10:20 to 10:23, no hour boundary

    expect(fetchWeatherSnapshot).toHaveBeenCalledTimes(2)
    expect(get(weatherStore).status).toBe('idle')
    expect(get(weatherStore).snapshot?.current.temperature).toBe(19)
  })

  it('does not hammer the API while it keeps failing', async () => {
    vi.mocked(fetchWeatherSnapshot).mockRejectedValue(new Error('offline'))

    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)
    scheduler.start()
    await vi.advanceTimersByTimeAsync(10 * 60_000)

    // boot + one retry every two minutes at most
    expect(
      vi.mocked(fetchWeatherSnapshot).mock.calls.length
    ).toBeLessThanOrEqual(7)
    expect(vi.mocked(fetchWeatherSnapshot).mock.calls.length).toBeGreaterThan(2)
  })

  it('backs off while the API stays down: two hours of failure is a handful of attempts, not sixty', async () => {
    vi.mocked(fetchWeatherSnapshot).mockRejectedValue(new Error('api down'))

    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)
    scheduler.start()
    await vi.advanceTimersByTimeAsync(2 * 60 * 60_000) // 10:20 to 12:20

    const calls = vi.mocked(fetchWeatherSnapshot).mock.calls.length
    expect(calls).toBeLessThanOrEqual(10) // 2-minute retries would be about 60
    expect(calls).toBeGreaterThanOrEqual(5) // but it never gives up for good
  })

  it('goes back to normal pace once a retry succeeds', async () => {
    vi.mocked(fetchWeatherSnapshot)
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('still down'))
      .mockImplementation(async () => snapshot(new Date().toISOString(), 17))

    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)
    scheduler.start()
    await vi.advanceTimersByTimeAsync(10 * 60_000) // 10:20 to 10:30

    const calls = vi.mocked(fetchWeatherSnapshot).mock.calls.length
    expect(calls).toBe(3) // boot, +2 min, +6 min (succeeds), then quiet
    expect(get(weatherStore).status).toBe('idle')
  })

  it('refetches when the snapshot it holds is older than an hour, whatever ticked', async () => {
    // A snapshot cached hours ago, and a boot fetch that cannot complete.
    vi.mocked(getCachedSnapshot).mockResolvedValue(
      snapshot('2026-09-24T05:00:00.000Z', 10)
    )
    vi.mocked(fetchWeatherSnapshot)
      .mockRejectedValueOnce(new Error('offline at boot'))
      .mockResolvedValue(snapshot(new Date().toISOString(), 18))

    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)
    expect(get(weatherStore).snapshot?.current.temperature).toBe(10)

    scheduler.start()
    await vi.advanceTimersByTimeAsync(2 * 60_000)

    expect(get(weatherStore).snapshot?.current.temperature).toBe(18)
  })

  it('stops retrying once a fetch has succeeded and the snapshot is fresh', async () => {
    vi.setSystemTime(new Date('2026-09-24T17:59:58'))
    vi.mocked(fetchWeatherSnapshot).mockImplementation(async () =>
      snapshot(new Date().toISOString(), 20)
    )

    cleanup = initWeather()
    await vi.advanceTimersByTimeAsync(0)
    scheduler.start()
    await vi.advanceTimersByTimeAsync(30 * 60_000) // 17:59 to 18:29, one hour tick inside

    expect(fetchWeatherSnapshot).toHaveBeenCalledTimes(2) // boot + the 18:00 tick
  })
})

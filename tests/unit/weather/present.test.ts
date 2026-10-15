import { describe, it, expect } from 'vitest'
import { presentSnapshot } from '../../../src/lib/weather/present'
import type {
  HourlyPoint,
  WeatherSnapshot
} from '../../../src/lib/weather/types'

// Winter in Brussels: sun up 08:00 to 16:59 (hourly is_day samples).
function wall(hoursFromMidnight: number): string {
  const d = new Date(Date.UTC(2026, 0, 15, hoursFromMidnight))
  return d.toISOString().slice(0, 16) // offset-less, like Open-Meteo's timezone=auto
}

function hourlyFrom(startHour: number, count: number): HourlyPoint[] {
  return Array.from({ length: count }, (_, i) => {
    const h = startHour + i
    const hourOfDay = h % 24
    return {
      time: wall(h),
      temperature: h, // distinct per hour so the tests can tell them apart
      weatherCode: hourOfDay < 8 ? 3 : hourOfDay < 12 ? 0 : 61,
      isDay: hourOfDay >= 8 && hourOfDay < 17,
      precipitationProbability: hourOfDay,
      precipitationMm: 0,
      windSpeedKmh: 10 + (h % 24)
    }
  })
}

function snapshotFetchedAt(hour: number): WeatherSnapshot {
  const hourly = hourlyFrom(hour, 16 * 24 - hour)
  const first = hourly[0]
  return {
    fetchedAt: new Date(Date.UTC(2026, 0, 15, hour - 1, 10)).toISOString(),
    location: {
      lat: 50.85,
      lon: 4.35,
      name: 'Brussels',
      timezone: 'Europe/Brussels'
    },
    current: {
      time: first.time,
      temperature: first.temperature,
      feelsLike: first.temperature - 2,
      humidity: 80,
      uvIndex: 0,
      isDay: first.isDay,
      weatherCode: first.weatherCode,
      windSpeedKmh: first.windSpeedKmh,
      windGustsKmh: 30,
      windDirectionDeg: 200,
      precipitationMm: 0,
      precipitationProbability: first.precipitationProbability
    },
    hourly,
    today: {
      date: '2026-01-15',
      weatherCode: 3,
      tempMin: 1,
      tempMax: 9,
      precipitationProbability: 20,
      windSpeedKmh: 15,
      sunrise: '2026-01-15T08:20',
      sunset: '2026-01-15T16:55'
    },
    tomorrow: {
      date: '2026-01-16',
      weatherCode: 3,
      tempMin: 1,
      tempMax: 9,
      precipitationProbability: 20,
      windSpeedKmh: 15,
      sunrise: '2026-01-16T08:19',
      sunset: '2026-01-16T16:56'
    },
    airQuality: null,
    moon: { fraction: 0.1, labelKey: 'waxingCrescent' }
  }
}

// 07:37 UTC is 08:37 in Brussels in January.
const EIGHT_THIRTY_SEVEN = new Date('2026-01-15T07:37:00Z')
// 19:15 UTC is 20:15 in Brussels.
const EIGHT_FIFTEEN_PM = new Date('2026-01-15T19:15:00Z')

describe('presentSnapshot', () => {
  it('starts the hourly strip at the current hour, not at the hour of the fetch', () => {
    const stale = snapshotFetchedAt(4) // fetched at 04:10, strip starts at 04:00
    const present = presentSnapshot(stale, EIGHT_THIRTY_SEVEN)

    expect(present.hourly[0].time).toBe(wall(8))
    expect(present.hourly).toHaveLength(stale.hourly.length - 4)
  })

  it('takes the sky from the present hour when the snapshot is hours old', () => {
    const stale = snapshotFetchedAt(15) // fetched at 15:10: sunny day
    expect(stale.current.isDay).toBe(true)
    expect(stale.current.weatherCode).toBe(61)

    const present = presentSnapshot(stale, EIGHT_FIFTEEN_PM)

    expect(present.current.isDay).toBe(false) // 20:00 is night in January
    expect(present.current.weatherCode).toBe(61)
    expect(present.current.temperature).toBe(20)
    expect(present.current.time).toBe(wall(20))
  })

  it('keeps the exact reading of a fresh snapshot untouched', () => {
    const fresh = snapshotFetchedAt(8)
    fresh.current = {
      ...fresh.current,
      temperature: 5.4,
      time: '2026-01-15T08:30'
    }

    const present = presentSnapshot(fresh, EIGHT_THIRTY_SEVEN)

    expect(present.current).toBe(fresh.current)
    expect(present.hourly).toBe(fresh.hourly)
  })

  it('leaves the snapshot alone once the forecast range has run out', () => {
    const tiny = snapshotFetchedAt(4)
    tiny.hourly = tiny.hourly.slice(0, 3) // 04:00 to 06:00 only

    expect(presentSnapshot(tiny, EIGHT_THIRTY_SEVEN)).toBe(tiny)
  })

  it('follows absolute timestamps too (debug snapshots carry an offset)', () => {
    const stale = snapshotFetchedAt(4)
    stale.hourly = stale.hourly.map((p) => ({
      ...p,
      time: `${p.time}:00.000Z`
    }))
    stale.current = { ...stale.current, time: `${stale.current.time}:00.000Z` }

    // The offset-carrying times are UTC, so 07:37Z is hour 07 for them.
    const present = presentSnapshot(stale, EIGHT_THIRTY_SEVEN)

    expect(present.hourly[0].time).toBe(`${wall(7)}:00.000Z`)
  })
})

/**
 * The weather as it is *now*, whatever the age of the snapshot behind it.
 *
 * A snapshot is fixed at fetch time: `current` is the reading of that
 * moment and `hourly` starts at that hour. Rendered as is, a snapshot that
 * is a few hours old (a missed refresh, a device that slept) leaves the
 * sunny daytime sky up at night and a strip that starts hours in the past.
 * But the snapshot already holds the whole forecast range hour by hour, so
 * the present can be read off it with the clock: the strip starts at the
 * location's current hour, and when `current` is from an earlier hour its
 * sky-driving fields come from the matching hourly point.
 */
import { derived, type Readable } from 'svelte/store'
import { minuteClock } from '../core/minute-clock'
import { weatherStore } from './store'
import { locationNow } from './celestialPosition'
import type { WeatherSnapshot } from './types'

export function presentSnapshot(
  snapshot: WeatherSnapshot,
  now: Date
): WeatherSnapshot {
  const { hourly } = snapshot
  if (hourly.length === 0) return snapshot

  const hourStart = locationNow(now, snapshot.location.timezone, hourly[0].time)
  hourStart.setMinutes(0, 0, 0)
  const from = hourly.findIndex(
    (p) => Date.parse(p.time) >= hourStart.getTime()
  )
  // from === 0: the snapshot's own first hour is the present one, its
  // `current` is the exact reading. -1: the forecast range has run out, show
  // what there is rather than nothing.
  if (from <= 0) return snapshot

  const point = hourly[from]
  const old = snapshot.current
  return {
    ...snapshot,
    current: {
      ...old,
      time: point.time,
      temperature: point.temperature,
      // keeps the gap between air temperature and how it feels
      feelsLike: point.temperature + (old.feelsLike - old.temperature),
      isDay: point.isDay,
      weatherCode: point.weatherCode,
      uvIndex: point.isDay ? old.uvIndex : 0,
      windSpeedKmh: point.windSpeedKmh,
      precipitationMm: point.precipitationMm,
      precipitationProbability: point.precipitationProbability
    },
    hourly: hourly.slice(from)
  }
}

let memo: {
  source: WeatherSnapshot
  firstHour: string
  result: WeatherSnapshot
} | null = null

/** Same snapshot, same present hour: hand back the same object, so a minute tick does not re-render consumers. */
function presentMemoized(
  snapshot: WeatherSnapshot,
  now: Date
): WeatherSnapshot {
  const result = presentSnapshot(snapshot, now)
  const firstHour = result.hourly[0]?.time ?? ''
  if (memo && memo.source === snapshot && memo.firstHour === firstHour) {
    return memo.result
  }
  memo = { source: snapshot, firstHour, result }
  return result
}

export const presentWeather: Readable<WeatherSnapshot | null> = derived(
  [weatherStore, minuteClock],
  ([$weather, $now]) =>
    $weather.snapshot ? presentMemoized($weather.snapshot, $now) : null
)

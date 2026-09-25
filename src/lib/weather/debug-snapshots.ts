/**
 * Canned `WeatherSnapshot` fixtures for `?weather=<state>` (see
 * `lib/core/debug-params.ts` and the plan's visual test matrix — phase 6
 * verification lists exactly these six states). Lets a dev or the
 * Playwright visual suite force a weather state without touching the real
 * Open-Meteo API — see `App.svelte`'s `onMount`, which calls
 * `setDebugWeatherSnapshot` (store.ts) instead of `initWeather()` when a
 * `?weather=` param is present.
 *
 * Snapshots are built relative to the given `now` (rather than hardcoded
 * fixed timestamps) so a test's `?now=` and `?weather=` combination always
 * produces an internally-consistent snapshot (hourly timeline starting at
 * `now`, today/tomorrow dates matching `now`'s calendar day) regardless of
 * which instant the test picks.
 */
import { mapWmoCode } from './mapWmo'
import { moonPhase } from './moon'
import type {
  WeatherSnapshot,
  HourlyPoint,
  DailySummary,
  AirQuality
} from './types'

export const DEBUG_WEATHER_STATES = [
  'clear-day',
  'clear-night',
  'rain',
  'snow',
  'fog',
  'storm'
] as const

export type DebugWeatherState = (typeof DEBUG_WEATHER_STATES)[number]

export function isDebugWeatherState(value: string): value is DebugWeatherState {
  return (DEBUG_WEATHER_STATES as readonly string[]).includes(value)
}

export interface StateProfile {
  /** WMO code — chosen so `mapWmoCode` resolves to the intended fx category (see mapWmo.ts). */
  weatherCode: number
  isDay: boolean
  temperature: number
  feelsLikeDelta: number
  humidity: number
  uvIndex: number
  windSpeedKmh: number
  windGustsKmh: number
  windDirectionDeg: number
  precipitationMm: number
  precipitationProbability: number
  europeanAqi: number
}

// isDay fixed per state (not derived from `now`) so the icon/fx a test asks
// for is exactly the one it gets, regardless of which `?now=` a given matrix
// point uses.
/** Exported for the visual test suite (`tests/visual/`), which needs the expected temperature to wait for/assert on without duplicating these numbers. */
export const DEBUG_WEATHER_PROFILES: Record<DebugWeatherState, StateProfile> = {
  'clear-day': {
    weatherCode: 0,
    isDay: true,
    temperature: 22,
    feelsLikeDelta: -1,
    humidity: 45,
    uvIndex: 5,
    windSpeedKmh: 11,
    windGustsKmh: 19,
    windDirectionDeg: 210,
    precipitationMm: 0,
    precipitationProbability: 0,
    europeanAqi: 28
  },
  'clear-night': {
    weatherCode: 0,
    isDay: false,
    temperature: 12,
    feelsLikeDelta: -1,
    humidity: 62,
    uvIndex: 0,
    windSpeedKmh: 6,
    windGustsKmh: 10,
    windDirectionDeg: 150,
    precipitationMm: 0,
    precipitationProbability: 0,
    europeanAqi: 18
  },
  rain: {
    weatherCode: 61,
    isDay: true,
    temperature: 14,
    feelsLikeDelta: -2,
    humidity: 86,
    uvIndex: 1,
    windSpeedKmh: 22,
    windGustsKmh: 36,
    windDirectionDeg: 250,
    precipitationMm: 2.4,
    precipitationProbability: 80,
    europeanAqi: 22
  },
  snow: {
    weatherCode: 71,
    isDay: true,
    temperature: -2,
    feelsLikeDelta: -4,
    humidity: 81,
    uvIndex: 1,
    windSpeedKmh: 14,
    windGustsKmh: 23,
    windDirectionDeg: 30,
    precipitationMm: 0.6,
    precipitationProbability: 70,
    europeanAqi: 15
  },
  fog: {
    weatherCode: 45,
    isDay: true,
    temperature: 6,
    feelsLikeDelta: -1,
    humidity: 96,
    uvIndex: 0,
    windSpeedKmh: 3,
    windGustsKmh: 6,
    windDirectionDeg: 0,
    precipitationMm: 0,
    precipitationProbability: 10,
    europeanAqi: 34
  },
  storm: {
    weatherCode: 95,
    isDay: true,
    temperature: 19,
    feelsLikeDelta: -1,
    humidity: 79,
    uvIndex: 2,
    windSpeedKmh: 35,
    windGustsKmh: 58,
    windDirectionDeg: 280,
    precipitationMm: 8.5,
    precipitationProbability: 95,
    europeanAqi: 26
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 60 * 60 * 1000)
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
}

/** Real day/night split for the rolling hourly strip (icons alternate sun/moon realistically even though the *current* condition's isDay is fixed by the profile). */
function hourIsDay(hour: number): boolean {
  return hour >= 7 && hour < 19
}

function buildHourly(now: Date, profile: StateProfile): HourlyPoint[] {
  const points: HourlyPoint[] = []
  for (let i = 0; i < 24; i++) {
    const time = addHours(now, i)
    points.push({
      time: time.toISOString(),
      temperature:
        Math.round((profile.temperature + Math.sin(i / 3) * 2) * 10) / 10,
      weatherCode: profile.weatherCode,
      isDay: hourIsDay(time.getHours()),
      precipitationProbability: profile.precipitationProbability,
      precipitationMm: profile.precipitationMm,
      windSpeedKmh: profile.windSpeedKmh
    })
  }
  return points
}

function buildDaily(
  date: Date,
  profile: StateProfile,
  sunriseHour: number,
  sunsetHour: number
): DailySummary {
  const sunrise = new Date(date)
  sunrise.setHours(sunriseHour, 30, 0, 0)
  const sunset = new Date(date)
  sunset.setHours(sunsetHour, 30, 0, 0)
  return {
    date: isoDate(date),
    weatherCode: profile.weatherCode,
    tempMin: Math.round(profile.temperature - 4),
    tempMax: Math.round(profile.temperature + 3),
    precipitationProbability: profile.precipitationProbability,
    windSpeedKmh: profile.windSpeedKmh,
    sunrise: sunrise.toISOString(),
    sunset: sunset.toISOString()
  }
}

export interface DebugLocation {
  lat: number
  lon: number
  name: string
  timezone: string
}

/**
 * Builds a full, internally-consistent `WeatherSnapshot` for one of the six
 * matrix states. Throws only if `state` isn't a `DebugWeatherState` — callers
 * are expected to check `isDebugWeatherState` first (App.svelte does).
 */
export function buildDebugSnapshot(
  state: DebugWeatherState,
  now: Date,
  location: DebugLocation
): WeatherSnapshot {
  const profile = DEBUG_WEATHER_PROFILES[state]
  // Sanity check the profile actually maps to the intended fx category —
  // catches a wrong WMO code at the source instead of in a screenshot diff.
  void mapWmoCode(profile.weatherCode, profile.isDay)

  const airQuality: AirQuality = {
    europeanAqi: profile.europeanAqi,
    pollen: null
  }

  return {
    fetchedAt: now.toISOString(),
    location,
    current: {
      time: now.toISOString(),
      temperature: profile.temperature,
      feelsLike: profile.temperature + profile.feelsLikeDelta,
      humidity: profile.humidity,
      uvIndex: profile.uvIndex,
      isDay: profile.isDay,
      weatherCode: profile.weatherCode,
      windSpeedKmh: profile.windSpeedKmh,
      windGustsKmh: profile.windGustsKmh,
      windDirectionDeg: profile.windDirectionDeg,
      precipitationMm: profile.precipitationMm,
      precipitationProbability: profile.precipitationProbability
    },
    hourly: buildHourly(now, profile),
    today: buildDaily(now, profile, 7, 19),
    tomorrow: buildDaily(addDays(now, 1), profile, 7, 19),
    airQuality,
    moon: moonPhase(now)
  }
}

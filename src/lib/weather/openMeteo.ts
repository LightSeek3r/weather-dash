/**
 * Typed Open-Meteo adapters. Public, free, no API key. Real `fetch`, no
 * client library (see `.claude/rules/dependencies.md` — nothing there covers
 * a weather HTTP client, and a hand-rolled typed fetch is a few lines).
 *
 * Three independent hosts/endpoints, confirmed live against real responses
 * while building this adapter (see `tests/fixtures/open-meteo/*.json`,
 * recorded for Brussels 50.85,4.35):
 *  - forecast:   https://api.open-meteo.com/v1/forecast
 *  - air quality: https://air-quality-api.open-meteo.com/v1/air-quality
 *  - geocoding:   https://geocoding-api.open-meteo.com/v1/search
 *
 * `fetchWeatherSnapshot`/`geocode` throw `WeatherFetchError` on network/HTTP
 * failure so the store layer can catch it and toast (plan P6: surface
 * failure, don't blank the screen). `fetchAirQuality` is the one exception —
 * per the `WeatherSnapshot.airQuality` contract it must never block
 * current/hourly/tomorrow, so it swallows its own errors and resolves to
 * `null` instead of throwing.
 */
import type {
  AirQuality,
  CurrentConditions,
  DailySummary,
  GeocodeResult,
  HourlyPoint,
  WeatherSnapshot
} from './types'
import { moonPhase } from './moon'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'

const CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'uv_index',
  'is_day',
  'weather_code',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'precipitation',
  'precipitation_probability'
].join(',')

const HOURLY_FIELDS = [
  'temperature_2m',
  'weather_code',
  'is_day',
  'precipitation_probability',
  'precipitation',
  'wind_speed_10m'
].join(',')

const DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'sunrise',
  'sunset'
].join(',')

export class WeatherFetchError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message)
    this.name = 'WeatherFetchError'
  }
}

// --- Raw Open-Meteo response shapes ----------------------------------------
// Open-Meteo returns `is_day` as 0|1, not a JSON boolean — every raw shape
// below reflects the real recorded response, not a guess.

interface RawCurrent {
  time: string
  temperature_2m: number
  apparent_temperature: number
  relative_humidity_2m: number
  uv_index: number
  is_day: 0 | 1
  weather_code: number
  wind_speed_10m: number
  wind_gusts_10m: number
  wind_direction_10m: number
  precipitation: number
  precipitation_probability: number
}

interface RawHourly {
  time: string[]
  temperature_2m: number[]
  weather_code: number[]
  is_day: (0 | 1)[]
  precipitation_probability: number[]
  precipitation: number[]
  wind_speed_10m: number[]
}

interface RawDaily {
  time: string[]
  weather_code: number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  precipitation_probability_max: number[]
  wind_speed_10m_max: number[]
  sunrise: string[]
  sunset: string[]
}

interface RawForecastResponse {
  timezone: string
  current: RawCurrent
  hourly: RawHourly
  daily: RawDaily
}

interface RawAirQualityCurrent {
  european_aqi: number | null
  alder_pollen?: number | null
  birch_pollen?: number | null
  grass_pollen?: number | null
  mugwort_pollen?: number | null
  olive_pollen?: number | null
  ragweed_pollen?: number | null
}

interface RawAirQualityResponse {
  current: RawAirQualityCurrent
}

interface RawGeocodeResult {
  latitude: number
  longitude: number
  name: string
  country?: string
  country_code?: string
  admin1?: string
  timezone: string
}

interface RawGeocodeResponse {
  results?: RawGeocodeResult[]
}

function mapCurrent(raw: RawCurrent): CurrentConditions {
  return {
    time: raw.time,
    temperature: raw.temperature_2m,
    feelsLike: raw.apparent_temperature,
    humidity: raw.relative_humidity_2m,
    uvIndex: raw.uv_index,
    isDay: raw.is_day === 1,
    weatherCode: raw.weather_code,
    windSpeedKmh: raw.wind_speed_10m,
    windGustsKmh: raw.wind_gusts_10m,
    windDirectionDeg: raw.wind_direction_10m,
    precipitationMm: raw.precipitation,
    precipitationProbability: raw.precipitation_probability
  }
}

/** Every hourly entry from the current hour onward (Open-Meteo's hourly array starts at 00:00 today, so "current hour" is a slice, not index 0) — the full `forecast_days` range, not just the first 24h. */
function mapHourly(raw: RawHourly, currentTime: string): HourlyPoint[] {
  const hourPrefix = currentTime.slice(0, 13) // "YYYY-MM-DDTHH"
  const startIndex = raw.time.findIndex((t) => t.startsWith(hourPrefix))
  const from = startIndex === -1 ? 0 : startIndex

  const points: HourlyPoint[] = []
  for (let i = from; i < raw.time.length; i++) {
    points.push({
      time: raw.time[i],
      temperature: raw.temperature_2m[i],
      weatherCode: raw.weather_code[i],
      isDay: raw.is_day[i] === 1,
      precipitationProbability: raw.precipitation_probability[i],
      precipitationMm: raw.precipitation[i],
      windSpeedKmh: raw.wind_speed_10m[i]
    })
  }
  return points
}

function mapDaily(raw: RawDaily, index: number): DailySummary {
  return {
    date: raw.time[index],
    weatherCode: raw.weather_code[index],
    tempMin: raw.temperature_2m_min[index],
    tempMax: raw.temperature_2m_max[index],
    precipitationProbability: raw.precipitation_probability_max[index],
    windSpeedKmh: raw.wind_speed_10m_max[index],
    sunrise: raw.sunrise[index],
    sunset: raw.sunset[index]
  }
}

/**
 * Fetches current/hourly/daily forecast for one location and maps it to a
 * `WeatherSnapshot`. `airQuality` is always `null` here (that's a separate
 * non-blocking fetch, see `fetchAirQuality`) and `moon` is a placeholder
 * computed from the response's own `current.time` — `store.ts` overwrites
 * both with the results of `fetchAirQuality`/`moonPhase(now)` once combined,
 * per the store's fetch-composition contract.
 */
export async function fetchWeatherSnapshot(
  lat: number,
  lon: number
): Promise<WeatherSnapshot> {
  const url = new URL(FORECAST_URL)
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('current', CURRENT_FIELDS)
  url.searchParams.set('hourly', HOURLY_FIELDS)
  url.searchParams.set('daily', DAILY_FIELDS)
  url.searchParams.set('timezone', 'auto')
  // 16 is Open-Meteo's documented max for the standard forecast endpoint —
  // the timeline UI scrolls through however much of that it actually returns.
  url.searchParams.set('forecast_days', '16')

  let response: Response
  try {
    response = await fetch(url.toString())
  } catch (err) {
    throw new WeatherFetchError('Failed to reach Open-Meteo forecast API', err)
  }
  if (!response.ok) {
    throw new WeatherFetchError(
      `Open-Meteo forecast API returned ${response.status}`
    )
  }

  let raw: RawForecastResponse
  try {
    raw = (await response.json()) as RawForecastResponse
  } catch (err) {
    throw new WeatherFetchError(
      'Open-Meteo forecast response was not valid JSON',
      err
    )
  }

  const current = mapCurrent(raw.current)

  return {
    fetchedAt: new Date().toISOString(),
    location: { lat, lon, name: '', timezone: raw.timezone },
    current,
    hourly: mapHourly(raw.hourly, current.time),
    today: mapDaily(raw.daily, 0),
    tomorrow: mapDaily(raw.daily, 1),
    airQuality: null,
    moon: moonPhase(new Date())
  }
}

function buildPollen(raw: RawAirQualityCurrent): AirQuality['pollen'] {
  const entries: [
    keyof NonNullable<AirQuality['pollen']>,
    number | null | undefined
  ][] = [
    ['alder', raw.alder_pollen],
    ['birch', raw.birch_pollen],
    ['grass', raw.grass_pollen],
    ['mugwort', raw.mugwort_pollen],
    ['olive', raw.olive_pollen],
    ['ragweed', raw.ragweed_pollen]
  ]

  const pollen: NonNullable<AirQuality['pollen']> = {}
  for (const [key, value] of entries) {
    if (value !== null && value !== undefined) pollen[key] = value
  }

  return Object.keys(pollen).length > 0 ? pollen : null
}

/**
 * Separate call to the air-quality API. Explicitly non-blocking per the
 * `WeatherSnapshot.airQuality` contract: any failure (network, HTTP, bad
 * JSON) resolves to `null` rather than throwing — the caller decides how to
 * surface a missing air-quality reading, but it must never fail the whole
 * weather fetch.
 */
export async function fetchAirQuality(
  lat: number,
  lon: number
): Promise<AirQuality | null> {
  try {
    const url = new URL(AIR_QUALITY_URL)
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set(
      'current',
      'european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen'
    )

    const response = await fetch(url.toString())
    if (!response.ok) return null

    const raw = (await response.json()) as RawAirQualityResponse
    return {
      europeanAqi: raw.current.european_aqi ?? null,
      pollen: buildPollen(raw.current)
    }
  } catch {
    return null
  }
}

/**
 * Geocodes a free-text query (city name, etc) to up to 6 candidate
 * locations. An aborted `signal` rejects with the fetch's own AbortError,
 * not a WeatherFetchError, so callers can tell "superseded" from "failed".
 */
export async function geocode(
  query: string,
  { language = 'en', signal }: { language?: string; signal?: AbortSignal } = {}
): Promise<GeocodeResult[]> {
  const url = new URL(GEOCODING_URL)
  url.searchParams.set('name', query)
  url.searchParams.set('count', '6')
  url.searchParams.set('language', language)
  url.searchParams.set('format', 'json')

  let response: Response
  try {
    response = await fetch(url.toString(), { signal })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new WeatherFetchError('Failed to reach Open-Meteo geocoding API', err)
  }
  if (!response.ok) {
    throw new WeatherFetchError(
      `Open-Meteo geocoding API returned ${response.status}`
    )
  }

  let raw: RawGeocodeResponse
  try {
    raw = (await response.json()) as RawGeocodeResponse
  } catch (err) {
    throw new WeatherFetchError(
      'Open-Meteo geocoding response was not valid JSON',
      err
    )
  }

  return (raw.results ?? []).map((r) => ({
    lat: r.latitude,
    lon: r.longitude,
    name: r.country ? `${r.name}, ${r.country}` : r.name,
    timezone: r.timezone,
    countryCode: r.country_code ?? '',
    region: r.admin1 ?? ''
  }))
}

/**
 * Weather domain types — the shared contract between the Open-Meteo adapter
 * (`openMeteo.ts`), the pure mappers (`mapWmo.ts`, `beaufort.ts`, `moon.ts`),
 * the cache (`cache.ts`) and the reactive store (`store.ts`) that the UI
 * layer consumes. Temperatures are always °C and wind always km/h here —
 * unit conversion for display (settings `weather.tempUnit`/`windUnit`) is a
 * presentation concern, not a data-shape concern, so it happens at the edge
 * (components), not in this module.
 */

export interface CurrentConditions {
  /** ISO, local to the location's timezone (Open-Meteo `timezone=auto`). */
  time: string
  /** °C always — unit conversion happens at display time. */
  temperature: number
  feelsLike: number
  /** 0-100 */
  humidity: number
  uvIndex: number
  isDay: boolean
  /** Raw WMO code — see `mapWmo.ts` for the icon/fx/label mapping. */
  weatherCode: number
  windSpeedKmh: number
  windGustsKmh: number
  /** 0-360, meteorological (0/360 = from the north). */
  windDirectionDeg: number
  precipitationMm: number
  /** 0-100 */
  precipitationProbability: number
}

export interface HourlyPoint {
  /** ISO */
  time: string
  temperature: number
  weatherCode: number
  isDay: boolean
  precipitationProbability: number
  precipitationMm: number
  windSpeedKmh: number
}

export interface DailySummary {
  /** YYYY-MM-DD */
  date: string
  weatherCode: number
  tempMin: number
  tempMax: number
  precipitationProbability: number
  windSpeedKmh: number
  /** ISO */
  sunrise: string
  /** ISO */
  sunset: string
}

export interface AirQuality {
  europeanAqi: number | null
  /** Pollen fields are Europe-only — `null` outside Europe, not an error. */
  pollen: Partial<
    Record<
      'alder' | 'birch' | 'grass' | 'mugwort' | 'olive' | 'ragweed',
      number
    >
  > | null
}

export type MoonPhaseKey =
  | 'newMoon'
  | 'waxingCrescent'
  | 'firstQuarter'
  | 'waxingGibbous'
  | 'fullMoon'
  | 'waningGibbous'
  | 'lastQuarter'
  | 'waningCrescent'

export interface MoonPhase {
  /** 0-1, 0 = new, 0.5 = full */
  fraction: number
  labelKey: MoonPhaseKey
}

export interface WeatherSnapshot {
  /** ISO */
  fetchedAt: string
  location: { lat: number; lon: number; name: string; timezone: string }
  current: CurrentConditions
  /** Rolling next 24h starting at current.time */
  hourly: HourlyPoint[]
  /** Today's sunrise/sunset live here */
  today: DailySummary
  tomorrow: DailySummary
  /** `null` ONLY if that sub-fetch failed — must never block current/hourly/tomorrow */
  airQuality: AirQuality | null
  moon: MoonPhase
}

export interface GeocodeResult {
  lat: number
  lon: number
  /** Display name, e.g. "Brussels, Belgium" */
  name: string
  /** IANA tz, e.g. "Europe/Brussels" */
  timezone: string
}

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  fetchWeatherSnapshot,
  fetchAirQuality,
  geocode,
  WeatherFetchError
} from '../../../src/lib/weather/openMeteo'
import forecastFixture from '../../fixtures/open-meteo/forecast-brussels.json'
import airQualityFixture from '../../fixtures/open-meteo/air-quality-brussels.json'

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body
  } as Response)
}

describe('fetchWeatherSnapshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps the recorded Brussels forecast fixture into a WeatherSnapshot shape', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(forecastFixture))

    const snapshot = await fetchWeatherSnapshot(50.85, 4.35)

    expect(snapshot.location.lat).toBe(50.85)
    expect(snapshot.location.lon).toBe(4.35)
    expect(snapshot.location.timezone).toBe('Europe/Brussels')

    expect(snapshot.current).toEqual({
      time: '2026-09-24T17:30',
      temperature: 20.4,
      feelsLike: 18.3,
      humidity: 37,
      uvIndex: 1.55,
      isDay: true,
      weatherCode: 3,
      windSpeedKmh: 6.5,
      windGustsKmh: 18.4,
      windDirectionDeg: 6,
      precipitationMm: 0,
      precipitationProbability: 0
    })

    // "current hour" of the fixture is 17:00; forecast_days=2 gives 48
    // hourly entries, so the rolling window is a slice, not index 0.
    expect(snapshot.hourly).toHaveLength(24)
    expect(snapshot.hourly[0].time).toBe('2026-09-24T17:00')
    expect(
      snapshot.hourly.every((p) => typeof p.temperature === 'number')
    ).toBe(true)

    expect(snapshot.today).toEqual({
      date: '2026-09-24',
      weatherCode: 3,
      tempMin: 14.9,
      tempMax: 20.5,
      precipitationProbability: 0,
      windSpeedKmh: 14.4,
      sunrise: '2026-09-24T07:31',
      sunset: '2026-09-24T19:36'
    })
    expect(snapshot.tomorrow.date).toBe('2026-09-25')
    expect(snapshot.tomorrow.tempMax).toBe(25.4)

    // Non-blocking pieces are the caller's (store.ts) job to fill in.
    expect(snapshot.airQuality).toBeNull()
    expect(snapshot.moon).toBeDefined()
  })

  it('throws WeatherFetchError on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    await expect(fetchWeatherSnapshot(50.85, 4.35)).rejects.toBeInstanceOf(
      WeatherFetchError
    )
  })

  it('throws WeatherFetchError on a non-200 response', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({}, false, 500))
    await expect(fetchWeatherSnapshot(50.85, 4.35)).rejects.toBeInstanceOf(
      WeatherFetchError
    )
  })
})

describe('fetchAirQuality', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps the recorded Brussels air-quality fixture', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(airQualityFixture))

    const result = await fetchAirQuality(50.85, 4.35)

    // The recorded fixture has every pollen field present (Brussels is in
    // Europe), including exact-zero readings — those are real "0" values,
    // not absent fields, so they stay in the mapped object.
    expect(result).toEqual({
      europeanAqi: 33,
      pollen: {
        alder: 0,
        birch: 0,
        grass: 0.1,
        mugwort: 0.1,
        olive: 0,
        ragweed: 0
      }
    })
  })

  it('resolves to null (never throws) on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const result = await fetchAirQuality(50.85, 4.35)
    expect(result).toBeNull()
  })

  it('resolves to null (never throws) on a non-200 response', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({}, false, 500))
    const result = await fetchAirQuality(50.85, 4.35)
    expect(result).toBeNull()
  })

  it('treats a response with no pollen fields as pollen: null (non-Europe)', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ current: { european_aqi: 42 } }))
    const result = await fetchAirQuality(50.85, 4.35)
    expect(result).toEqual({ europeanAqi: 42, pollen: null })
  })
})

describe('geocode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps geocoding results to GeocodeResult[]', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce({
        results: [
          {
            latitude: 50.85045,
            longitude: 4.34878,
            name: 'Brussels',
            country: 'Belgium',
            country_code: 'BE',
            timezone: 'Europe/Brussels'
          }
        ]
      })
    )

    const results = await geocode('Brussels')
    expect(results).toEqual([
      {
        lat: 50.85045,
        lon: 4.34878,
        name: 'Brussels, Belgium',
        timezone: 'Europe/Brussels',
        countryCode: 'BE'
      }
    ])
  })

  it('returns [] when the API has no matches', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({}))
    expect(await geocode('zzzznotarealplace')).toEqual([])
  })

  it('throws WeatherFetchError on a non-200 response', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({}, false, 500))
    await expect(geocode('Brussels')).rejects.toBeInstanceOf(WeatherFetchError)
  })
})

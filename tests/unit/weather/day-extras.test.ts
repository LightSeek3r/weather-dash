import { describe, it, expect, vi, afterEach } from 'vitest'
import { get } from 'svelte/store'
import { remainingDayRange } from '../../../src/lib/weather/todayRange'
import { europeanAqiBand } from '../../../src/lib/weather/aqi'
import { reverseGeocode } from '../../../src/lib/weather/reverseGeocode'
import { nameUnnamedLocation } from '../../../src/lib/weather/locationName'
import {
  settingsStore,
  defaultSettings
} from '../../../src/lib/core/storage/settings'
import type { HourlyPoint } from '../../../src/lib/weather/types'

function hour(time: string, temperature: number): HourlyPoint {
  return {
    time,
    temperature,
    weatherCode: 0,
    isDay: true,
    precipitationProbability: 0,
    precipitationMm: 0,
    windSpeedKmh: 0
  }
}

describe('remainingDayRange', () => {
  const today = { date: '2026-10-02' } as Parameters<
    typeof remainingDayRange
  >[0]['today']

  it('spans the current reading and the rest of today, not tomorrow', () => {
    const range = remainingDayRange({
      current: { temperature: 14.2 } as never,
      today,
      hourly: [
        hour('2026-10-02T15:00', 14),
        hour('2026-10-02T17:00', 16.5),
        hour('2026-10-02T23:00', 9),
        hour('2026-10-03T03:00', 4),
        hour('2026-10-03T14:00', 25)
      ]
    })
    expect(range).toEqual({ min: 9, max: 16.5 })
  })

  it('includes the current reading when it is the extreme', () => {
    expect(
      remainingDayRange({
        current: { temperature: 20 } as never,
        today,
        hourly: [hour('2026-10-02T23:00', 12)]
      })
    ).toEqual({ min: 12, max: 20 })
  })

  it('collapses to the current reading late in the day', () => {
    expect(
      remainingDayRange({
        current: { temperature: 8 } as never,
        today,
        hourly: [hour('2026-10-03T00:00', 7)]
      })
    ).toEqual({ min: 8, max: 8 })
  })
})

describe('europeanAqiBand', () => {
  it('maps the EEA band edges', () => {
    expect(europeanAqiBand(0)).toBe('good')
    expect(europeanAqiBand(20)).toBe('good')
    expect(europeanAqiBand(21)).toBe('fair')
    expect(europeanAqiBand(40)).toBe('fair')
    expect(europeanAqiBand(55)).toBe('moderate')
    expect(europeanAqiBand(80)).toBe('poor')
    expect(europeanAqiBand(100)).toBe('veryPoor')
    expect(europeanAqiBand(101)).toBe('extremelyPoor')
  })
})

describe('reverseGeocode', () => {
  function fakeFetch(res: Response | Error, seen?: string[]): typeof fetch {
    return (async (url: string) => {
      seen?.push(url)
      if (res instanceof Error) throw res
      return res
    }) as typeof fetch
  }

  it('names the city with its country and uppercases the country code', async () => {
    const seen: string[] = []
    const res = Response.json({
      address: { city: 'Bruxelles', country: 'Belgique', country_code: 'be' }
    })
    expect(
      await reverseGeocode(50.85, 4.35, 'fr-FR', fakeFetch(res, seen))
    ).toEqual({
      name: 'Bruxelles, Belgique',
      countryCode: 'BE'
    })
    const url = new URL(seen[0])
    expect(url.hostname).toBe('nominatim.openstreetmap.org')
    expect(url.searchParams.get('accept-language')).toBe('fr-FR')
    expect(url.searchParams.get('zoom')).toBe('10')
  })

  it('falls back to town/village when there is no city', async () => {
    const res = Response.json({
      address: { village: 'Durbuy', country_code: 'be' }
    })
    expect((await reverseGeocode(50, 5, 'en', fakeFetch(res)))?.name).toBe(
      'Durbuy'
    )
  })

  it('null on no address, HTTP error and network error', async () => {
    expect(
      await reverseGeocode(
        0,
        0,
        'en',
        fakeFetch(Response.json({ error: 'Unable to geocode' }))
      )
    ).toBeNull()
    expect(
      await reverseGeocode(
        0,
        0,
        'en',
        fakeFetch(new Response('', { status: 429 }))
      )
    ).toBeNull()
    expect(
      await reverseGeocode(0, 0, 'en', fakeFetch(new TypeError('offline')))
    ).toBeNull()
  })
})

describe('nameUnnamedLocation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    settingsStore.set(defaultSettings())
  })

  function stubNominatim(): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(async () =>
      Response.json({
        address: { city: 'Lyon', country: 'France', country_code: 'fr' }
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('renames a placeholder saved in any language and sets the holiday country', async () => {
    stubNominatim()
    settingsStore.set({
      ...defaultSettings(),
      location: { lat: 45.76, lon: 4.84, name: 'Position actuelle' },
      holidays: {
        ...defaultSettings().holidays,
        baseCountry: 'BE',
        baseRegion: 'VLG'
      }
    })
    await nameUnnamedLocation(true)
    const s = get(settingsStore)
    expect(s.location?.name).toBe('Lyon, France')
    expect(s.holidays.baseCountry).toBe('FR')
    expect(s.holidays.baseRegion).toBeNull()
  })

  it('leaves holidays alone for the boot-time backfill', async () => {
    stubNominatim()
    settingsStore.set({
      ...defaultSettings(),
      location: { lat: 45.76, lon: 4.84, name: 'Current location' },
      holidays: { ...defaultSettings().holidays, baseCountry: 'BE' }
    })
    await nameUnnamedLocation(false)
    expect(get(settingsStore).holidays.baseCountry).toBe('BE')
  })

  it('never looks up a real name', async () => {
    const fetchMock = stubNominatim()
    settingsStore.set({
      ...defaultSettings(),
      location: { lat: 1, lon: 2, name: 'Brussels, Belgium' }
    })
    await nameUnnamedLocation(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

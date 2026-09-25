import { describe, it, expect } from 'vitest'
import {
  DEBUG_WEATHER_STATES,
  DEBUG_WEATHER_PROFILES,
  buildDebugSnapshot,
  isDebugWeatherState
} from '../../../src/lib/weather/debug-snapshots'
import { mapWmoCode } from '../../../src/lib/weather/mapWmo'

const LOCATION = {
  lat: 50.85,
  lon: 4.35,
  name: 'Brussels',
  timezone: 'Europe/Brussels'
}
const NOW = new Date('2026-01-15T15:00:00.000Z')

describe('isDebugWeatherState', () => {
  it('accepts exactly the six plan-listed states', () => {
    expect(DEBUG_WEATHER_STATES).toEqual([
      'clear-day',
      'clear-night',
      'rain',
      'snow',
      'fog',
      'storm'
    ])
    for (const state of DEBUG_WEATHER_STATES) {
      expect(isDebugWeatherState(state)).toBe(true)
    }
  })

  it('rejects anything else', () => {
    expect(isDebugWeatherState('sunny')).toBe(false)
    expect(isDebugWeatherState('')).toBe(false)
  })
})

describe('buildDebugSnapshot', () => {
  for (const state of DEBUG_WEATHER_STATES) {
    it(`${state}: weatherCode/isDay maps to the intended fx category`, () => {
      const snapshot = buildDebugSnapshot(state, NOW, LOCATION)
      const visual = mapWmoCode(
        snapshot.current.weatherCode,
        snapshot.current.isDay
      )
      const expectedFx =
        state === 'clear-day' || state === 'clear-night'
          ? 'clear'
          : state === 'rain'
            ? 'rain'
            : state
      expect(visual.fx).toBe(expectedFx)
    })

    it(`${state}: is internally consistent with the given "now"`, () => {
      const snapshot = buildDebugSnapshot(state, NOW, LOCATION)
      expect(snapshot.fetchedAt).toBe(NOW.toISOString())
      expect(snapshot.hourly).toHaveLength(24)
      expect(snapshot.hourly[0].time).toBe(NOW.toISOString())
      expect(snapshot.today.date).toBe('2026-01-15')
      expect(snapshot.tomorrow.date).toBe('2026-01-16')
      expect(snapshot.location).toEqual(LOCATION)
    })
  }

  it('clear-day is daytime and clear-night is nighttime, regardless of "now"', () => {
    const day = buildDebugSnapshot('clear-day', NOW, LOCATION)
    const night = buildDebugSnapshot('clear-night', NOW, LOCATION)
    expect(day.current.isDay).toBe(true)
    expect(night.current.isDay).toBe(false)
  })

  it('every profile temperature matches what the visual suite waits for', () => {
    for (const state of DEBUG_WEATHER_STATES) {
      const snapshot = buildDebugSnapshot(state, NOW, LOCATION)
      expect(snapshot.current.temperature).toBe(
        DEBUG_WEATHER_PROFILES[state].temperature
      )
    }
  })
})

import { describe, it, expect } from 'vitest'
import { mapWmoCode } from '../../../src/lib/weather/mapWmo'

describe('mapWmoCode', () => {
  it('maps clear sky (0)', () => {
    expect(mapWmoCode(0, true)).toEqual({
      icon: 'i-sun',
      fx: 'clear',
      conditionKey: 'clearSky'
    })
    expect(mapWmoCode(0, false)).toEqual({
      icon: 'i-moon',
      fx: 'clear',
      conditionKey: 'clearSky'
    })
  })

  it('maps mainly clear (1)', () => {
    expect(mapWmoCode(1, true)).toEqual({
      icon: 'i-sun',
      fx: 'clear',
      conditionKey: 'mainlyClear'
    })
    expect(mapWmoCode(1, false).icon).toBe('i-moon')
  })

  it('maps partly cloudy (2)', () => {
    expect(mapWmoCode(2, true)).toEqual({
      icon: 'i-partly',
      fx: 'cloudy',
      conditionKey: 'partlyCloudy'
    })
    expect(mapWmoCode(2, false)).toEqual({
      icon: 'i-moon-cloud',
      fx: 'cloudy',
      conditionKey: 'partlyCloudy'
    })
  })

  it('maps overcast (3)', () => {
    expect(mapWmoCode(3, true)).toEqual({
      icon: 'i-cloudy',
      fx: 'cloudy',
      conditionKey: 'overcast'
    })
  })

  it('maps fog (45, 48)', () => {
    for (const code of [45, 48]) {
      expect(mapWmoCode(code, true)).toEqual({
        icon: 'i-fog',
        fx: 'fog',
        conditionKey: 'fog'
      })
    }
  })

  it('maps drizzle intensities (51, 53, 55)', () => {
    expect(mapWmoCode(51, true)).toEqual({
      icon: 'i-rain',
      fx: 'drizzle',
      conditionKey: 'drizzle',
      intensity: 'light'
    })
    expect(mapWmoCode(53, true).intensity).toBe('moderate')
    expect(mapWmoCode(55, true).intensity).toBe('heavy')
  })

  it('maps freezing drizzle (56, 57)', () => {
    expect(mapWmoCode(56, true)).toEqual({
      icon: 'i-rain',
      fx: 'drizzle',
      conditionKey: 'freezingDrizzle',
      intensity: 'light'
    })
    expect(mapWmoCode(57, true).intensity).toBe('heavy')
  })

  it('maps rain intensities (61, 63, 65)', () => {
    expect(mapWmoCode(61, true)).toEqual({
      icon: 'i-rain',
      fx: 'rain',
      conditionKey: 'rain',
      intensity: 'light'
    })
    expect(mapWmoCode(63, true).intensity).toBe('moderate')
    expect(mapWmoCode(65, true).intensity).toBe('heavy')
  })

  it('maps freezing rain (66, 67)', () => {
    expect(mapWmoCode(66, true)).toEqual({
      icon: 'i-rain',
      fx: 'rain',
      conditionKey: 'freezingRain',
      intensity: 'light'
    })
    expect(mapWmoCode(67, true).intensity).toBe('heavy')
  })

  it('maps snow intensities (71, 73, 75)', () => {
    expect(mapWmoCode(71, true)).toEqual({
      icon: 'i-snow',
      fx: 'snow',
      conditionKey: 'snow',
      intensity: 'light'
    })
    expect(mapWmoCode(73, true).intensity).toBe('moderate')
    expect(mapWmoCode(75, true).intensity).toBe('heavy')
  })

  it('maps snow grains (77) without an intensity', () => {
    expect(mapWmoCode(77, true)).toEqual({
      icon: 'i-snow',
      fx: 'snow',
      conditionKey: 'snowGrains'
    })
  })

  it('maps rain showers (80, 81, 82)', () => {
    expect(mapWmoCode(80, true)).toEqual({
      icon: 'i-rain',
      fx: 'rain',
      conditionKey: 'rainShowers',
      intensity: 'light'
    })
    expect(mapWmoCode(81, true).intensity).toBe('moderate')
    expect(mapWmoCode(82, true).intensity).toBe('heavy')
  })

  it('maps snow showers (85, 86)', () => {
    expect(mapWmoCode(85, true)).toEqual({
      icon: 'i-snow',
      fx: 'snow',
      conditionKey: 'snowShowers',
      intensity: 'light'
    })
    expect(mapWmoCode(86, true).intensity).toBe('heavy')
  })

  it('maps thunderstorm (95 no hail, 96/99 with hail)', () => {
    expect(mapWmoCode(95, true)).toEqual({
      icon: 'i-storm',
      fx: 'storm',
      conditionKey: 'thunderstorm',
      hail: false
    })
    expect(mapWmoCode(96, true)).toEqual({
      icon: 'i-storm',
      fx: 'storm',
      conditionKey: 'thunderstorm',
      hail: true
    })
    expect(mapWmoCode(99, true)).toEqual({
      icon: 'i-storm',
      fx: 'storm',
      conditionKey: 'thunderstorm',
      hail: true
    })
  })

  it('falls back to overcast/cloudy for unknown codes rather than throwing', () => {
    expect(mapWmoCode(-1, true)).toEqual({
      icon: 'i-cloudy',
      fx: 'cloudy',
      conditionKey: 'overcast'
    })
    expect(mapWmoCode(1234, false)).toEqual({
      icon: 'i-cloudy',
      fx: 'cloudy',
      conditionKey: 'overcast'
    })
  })
})

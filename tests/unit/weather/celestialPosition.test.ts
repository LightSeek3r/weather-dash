import { describe, it, expect } from 'vitest'
import {
  DEFAULT_ARC,
  arcForLatitude,
  arcPosition,
  celestialPosition,
  celestialVisibility,
  celestialWindow,
  clamp01,
  locationNow,
  transitFraction,
  type ArcBox
} from '../../../src/lib/weather/celestialPosition'

const TODAY = {
  sunrise: '2026-01-15T07:30:00.000Z',
  sunset: '2026-01-15T19:30:00.000Z'
}
const TOMORROW = {
  sunrise: '2026-01-16T07:32:00.000Z',
  sunset: '2026-01-16T19:31:00.000Z'
}
const at = (iso: string): Date => new Date(iso)
const BOX: ArcBox = { rise: 0.1, set: 0.9, bottom: 0.9, arcHeight: 0.8 }

describe('clamp01 / transitFraction', () => {
  it('clamps outside the window and interpolates inside it', () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(1.5)).toBe(1)
    expect(transitFraction(50, 0, 100)).toBe(0.5)
    expect(transitFraction(-10, 0, 100)).toBe(0)
    expect(transitFraction(250, 0, 100)).toBe(1)
  })

  it('returns 0 for an empty or inverted window rather than NaN/Infinity', () => {
    expect(transitFraction(5, 10, 10)).toBe(0)
    expect(transitFraction(5, 10, 0)).toBe(0)
  })
})

describe('arcPosition', () => {
  it('rises at the left (east, facing south), peaks mid-screen, sets at the right (west)', () => {
    expect(arcPosition(0, BOX)).toEqual({ x: 0.1, y: 0.9 })
    const noon = arcPosition(0.5, BOX)
    expect(noon.x).toBeCloseTo(0.5, 10)
    expect(noon.y).toBeCloseTo(0.1, 10)
    const set = arcPosition(1, BOX)
    expect(set.x).toBeCloseTo(0.9, 10)
    expect(set.y).toBeCloseTo(0.9, 10)
  })

  it('follows y = bottom - sin(fraction*pi) * arcHeight', () => {
    const p = arcPosition(0.25, BOX)
    expect(p.x).toBeCloseTo(0.1 + 0.25 * 0.8, 10)
    expect(p.y).toBeCloseTo(0.9 - Math.sin(Math.PI / 4) * 0.8, 10)
  })

  it('clamps fractions outside 0..1 to the horizon points', () => {
    expect(arcPosition(-1, BOX)).toEqual(arcPosition(0, BOX))
    expect(arcPosition(2, BOX)).toEqual(arcPosition(1, BOX))
  })

  it('keeps the default arc fully on screen', () => {
    for (let f = 0; f <= 1; f += 0.05) {
      const p = arcPosition(f, DEFAULT_ARC)
      expect(p.x).toBeGreaterThan(0)
      expect(p.x).toBeLessThan(1)
      expect(p.y).toBeGreaterThan(0)
      expect(p.y).toBeLessThan(1)
    }
  })
})

describe('celestialWindow', () => {
  it('is the sun between sunrise and sunset', () => {
    const w = celestialWindow(at('2026-01-15T12:00:00Z'), TODAY, TOMORROW)
    expect(w).toEqual({
      body: 'sun',
      start: Date.parse(TODAY.sunrise),
      end: Date.parse(TODAY.sunset)
    })
  })

  it('is the moon from sunset to the next sunrise', () => {
    const w = celestialWindow(at('2026-01-15T22:00:00Z'), TODAY, TOMORROW)
    expect(w).toEqual({
      body: 'moon',
      start: Date.parse(TODAY.sunset),
      end: Date.parse(TOMORROW.sunrise)
    })
  })

  it('before sunrise, opens the moon window at yesterday-ish (sunset - 24h)', () => {
    const w = celestialWindow(at('2026-01-15T03:00:00Z'), TODAY, TOMORROW)
    expect(w?.body).toBe('moon')
    expect(w?.start).toBe(Date.parse(TODAY.sunset) - 24 * 3600 * 1000)
    expect(w?.end).toBe(Date.parse(TODAY.sunrise))
  })

  it('falls back to sunrise + 24h without a usable tomorrow', () => {
    const w = celestialWindow(at('2026-01-15T22:00:00Z'), TODAY)
    expect(w?.end).toBe(Date.parse(TODAY.sunrise) + 24 * 3600 * 1000)
  })

  it('shifts a snapshot that went stale past tomorrow by whole days', () => {
    // Two days later at 12:00: still "midday sun", not a moon stuck at the horizon.
    const w = celestialWindow(at('2026-01-17T12:00:00Z'), TODAY, TOMORROW)
    expect(w?.body).toBe('sun')
    expect(w?.start).toBe(Date.parse('2026-01-17T07:30:00Z'))
    expect(w?.end).toBe(Date.parse('2026-01-17T19:30:00Z'))
  })

  it('returns null for unparsable or inverted times', () => {
    expect(
      celestialWindow(at('2026-01-15T12:00:00Z'), {
        sunrise: 'nope',
        sunset: TODAY.sunset
      })
    ).toBeNull()
    expect(
      celestialWindow(at('2026-01-15T12:00:00Z'), {
        sunrise: TODAY.sunset,
        sunset: TODAY.sunrise
      })
    ).toBeNull()
  })
})

describe('celestialPosition', () => {
  it('puts the sun at the top of the arc at solar noon', () => {
    const p = celestialPosition(
      at('2026-01-15T13:30:00Z'),
      TODAY,
      TOMORROW,
      BOX
    )
    expect(p?.body).toBe('sun')
    expect(p?.fraction).toBeCloseTo(0.5, 10)
    expect(p?.x).toBeCloseTo(0.5, 10)
    expect(p?.y).toBeCloseTo(0.1, 10)
  })

  it('puts the afternoon sun west of centre at a known fraction', () => {
    // 15:00 is 7.5h into a 12h day.
    const p = celestialPosition(
      at('2026-01-15T15:00:00Z'),
      TODAY,
      TOMORROW,
      BOX
    )
    expect(p?.fraction).toBeCloseTo(0.625, 10)
    expect(p?.x).toBeCloseTo(0.1 + 0.625 * 0.8, 10)
    expect(p?.y).toBeCloseTo(0.9 - Math.sin(0.625 * Math.PI) * 0.8, 10)
  })

  it('sits on the east horizon exactly at sunrise and the west at sunset', () => {
    const rise = celestialPosition(at(TODAY.sunrise), TODAY, TOMORROW, BOX)
    expect(rise).toMatchObject({ body: 'sun', fraction: 0, x: 0.1, y: 0.9 })
    const set = celestialPosition(at(TODAY.sunset), TODAY, TOMORROW, BOX)
    expect(set?.body).toBe('sun')
    expect(set?.fraction).toBe(1)
    expect(set?.x).toBeCloseTo(0.9, 10)
  })

  it('tracks the moon through the night (21:00 is low in the east)', () => {
    const p = celestialPosition(
      at('2026-01-15T21:00:00Z'),
      TODAY,
      TOMORROW,
      BOX
    )
    expect(p?.body).toBe('moon')
    // 1.5h into a 12h02m night.
    expect(p?.fraction).toBeCloseTo(90 / 722, 6)
    expect(p?.x).toBeLessThan(0.25)
    expect(p?.y).toBeGreaterThan(0.5)
  })
})

describe('arcForLatitude', () => {
  it('keeps the northern arc and mirrors it south of the equator', () => {
    expect(arcForLatitude(50.85, BOX)).toBe(BOX)
    expect(arcForLatitude(0, BOX)).toBe(BOX)
    const south = arcForLatitude(-33.9, BOX)
    expect(arcPosition(0, south).x).toBeCloseTo(0.9, 10)
    expect(arcPosition(1, south).x).toBeCloseTo(0.1, 10)
    expect(arcPosition(0.5, south)).toEqual(arcPosition(0.5, BOX))
  })
})

describe('celestialVisibility', () => {
  it('is full on clear skies and fades with heavier weather', () => {
    expect(celestialVisibility('clear')).toBe(1)
    const partly = celestialVisibility('cloudy', 'partlyCloudy')
    const overcast = celestialVisibility('cloudy', 'overcast')
    expect(partly).toBeGreaterThan(overcast)
    expect(celestialVisibility('rain')).toBeLessThan(overcast)
    expect(celestialVisibility('storm')).toBeLessThan(
      celestialVisibility('rain')
    )
  })
})

describe('locationNow', () => {
  it("reads the location's wall clock the way offset-less API times are parsed", () => {
    // 03:00 UTC is noon in Tokyo, whatever zone the test runner is in.
    const now = at('2026-09-28T03:00:00Z')
    const shifted = locationNow(now, 'Asia/Tokyo', '2026-09-28T05:30')
    expect(shifted.getTime()).toBe(Date.parse('2026-09-28T12:00:00'))
    // So a Tokyo noon sits mid-arc against Tokyo's own sunrise/sunset.
    const pos = celestialPosition(shifted, {
      sunrise: '2026-09-28T05:30',
      sunset: '2026-09-28T18:30'
    })
    expect(pos?.body).toBe('sun')
    expect(pos?.fraction).toBeCloseTo(0.5, 5)
  })

  it('passes absolute times and unknown zones through unchanged', () => {
    const now = at('2026-09-28T03:00:00Z')
    expect(locationNow(now, 'Asia/Tokyo', TODAY.sunrise)).toBe(now)
    expect(locationNow(now, 'Not/AZone', '2026-09-28T05:30')).toBe(now)
  })
})

import { describe, it, expect } from 'vitest'
import { isNightMode, parseTimeOfDay } from '../../../src/lib/core/night-mode'

function at(hhmm: string, seconds = 0): Date {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2026, 8, 25, h, m, seconds)
}

describe('parseTimeOfDay', () => {
  it('parses valid HH:MM into minutes since midnight', () => {
    expect(parseTimeOfDay('00:00')).toBe(0)
    expect(parseTimeOfDay('07:30')).toBe(450)
    expect(parseTimeOfDay('23:59')).toBe(1439)
  })

  it('returns null for malformed input instead of throwing', () => {
    for (const bad of ['', '24:00', '12:60', 'noon', '7', '07-00', '1:2']) {
      expect(parseTimeOfDay(bad)).toBeNull()
    }
    expect(parseTimeOfDay(undefined)).toBeNull()
    expect(parseTimeOfDay(null)).toBeNull()
    expect(parseTimeOfDay(730)).toBeNull()
  })
})

describe('isNightMode — overnight wraparound (22:00 -> 07:00)', () => {
  const night = (d: Date) => isNightMode(d, '22:00', '07:00')

  it('is night late evening, around midnight and early morning', () => {
    expect(night(at('23:15'))).toBe(true)
    expect(night(at('00:00'))).toBe(true)
    expect(night(at('03:30'))).toBe(true)
    expect(night(at('06:59', 59))).toBe(true)
  })

  it('is day between end and start', () => {
    expect(night(at('07:01'))).toBe(false)
    expect(night(at('12:00'))).toBe(false)
    expect(night(at('21:59', 59))).toBe(false)
  })

  it('start boundary is inside, end boundary is outside', () => {
    expect(night(at('22:00'))).toBe(true)
    expect(night(at('07:00'))).toBe(false)
  })
})

describe('isNightMode — same-day window (13:00 -> 15:00)', () => {
  const night = (d: Date) => isNightMode(d, '13:00', '15:00')

  it('is night only inside the window', () => {
    expect(night(at('12:59'))).toBe(false)
    expect(night(at('14:00'))).toBe(true)
    expect(night(at('15:01'))).toBe(false)
    expect(night(at('00:00'))).toBe(false)
  })

  it('start boundary is inside, end boundary is outside', () => {
    expect(night(at('13:00'))).toBe(true)
    expect(night(at('15:00'))).toBe(false)
  })
})

describe('isNightMode — degenerate and malformed schedules', () => {
  it('start === end is an empty window (never night)', () => {
    for (const time of ['00:00', '08:00', '08:01', '23:59']) {
      expect(isNightMode(at(time), '08:00', '08:00')).toBe(false)
    }
  })

  it('malformed start or end falls back to day without throwing', () => {
    expect(isNightMode(at('23:00'), 'garbage', '07:00')).toBe(false)
    expect(isNightMode(at('03:00'), '22:00', '25:00')).toBe(false)
    expect(
      isNightMode(at('03:00'), undefined as unknown as string, '07:00')
    ).toBe(false)
  })
})

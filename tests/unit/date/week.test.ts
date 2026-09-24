import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { dayOfYear, isoWeek } from '../../../src/lib/date/week'

// Force a DST-observing zone so the "DST transition day" case below is
// meaningful regardless of the machine/CI running the suite. Node re-reads
// process.env.TZ per Date computation (verified empirically), so this takes
// effect immediately without needing to restart the process.
const originalTz = process.env.TZ
beforeAll(() => {
  process.env.TZ = 'Europe/Brussels'
})
afterAll(() => {
  process.env.TZ = originalTz
})

describe('dayOfYear', () => {
  it('returns the correct ordinal for a normal day', () => {
    // Thursday 24 September 2026 — matches the mockup placeholder "day 267/365".
    expect(dayOfYear(new Date(2026, 8, 24))).toBe(267)
  })

  it('returns 365 for Dec 31 of a non-leap year', () => {
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365)
  })

  it('returns 366 for Dec 31 of a leap year', () => {
    expect(dayOfYear(new Date(2028, 11, 31))).toBe(366)
  })

  it('is correct across a spring-forward DST transition (Europe/Brussels)', () => {
    // 2027-03-28 is the last Sunday of March: EU clocks jump 02:00 -> 03:00.
    expect(dayOfYear(new Date(2027, 2, 28))).toBe(87)
  })

  it('is correct across a fall-back DST transition (Europe/Brussels)', () => {
    // 2026-10-25 is the last Sunday of October: EU clocks fall back 03:00 -> 02:00.
    expect(dayOfYear(new Date(2026, 9, 25))).toBe(298)
  })
})

describe('isoWeek', () => {
  it('returns the correct ISO week for a normal day', () => {
    // Thursday 24 September 2026 — matches the mockup placeholder "week 39".
    expect(isoWeek(new Date(2026, 8, 24))).toBe(39)
  })

  it('assigns Jan 1 to the previous ISO week-year when it falls before the first Thursday', () => {
    // 2027-01-01 is a Friday, so it belongs to ISO week 53 of 2026, not week 1 of 2027.
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53)
  })

  it('is correct on a DST-transition day', () => {
    // 2027-03-28 (spring-forward Sunday) falls in ISO week 12.
    expect(isoWeek(new Date(2027, 2, 28))).toBe(12)
  })
})

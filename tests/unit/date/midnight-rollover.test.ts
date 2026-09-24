/**
 * Plan premortem P7: date-derived data must actually change at local
 * midnight, not wait for the next hourly refresh. These are pure
 * functions, so unlike `tests/unit/scheduler.test.ts` (which drives a real
 * timer loop) there's no fake clock to install here — just two plain
 * `Date`s straddling a real local midnight, fed straight into the
 * functions under test.
 */
import { describe, it, expect } from 'vitest'
import { getSaintOfDay } from '../../../src/lib/date/saints'
import { getTodayHolidays } from '../../../src/lib/date/holidays'

const justBeforeMidnight = new Date(2025, 11, 31, 23, 59, 59) // Dec 31, 23:59:59
const justAfterMidnight = new Date(2026, 0, 1, 0, 0, 1) // Jan 1, 00:00:01

describe('midnight rollover', () => {
  it('getSaintOfDay flips at local midnight (roman-catholic)', () => {
    const before = getSaintOfDay(justBeforeMidnight, 'roman-catholic')
    const after = getSaintOfDay(justAfterMidnight, 'roman-catholic')
    expect(before).toBe('St. Sylvester I')
    expect(after).toBe('Mary, Mother of God')
    expect(before).not.toBe(after)
  })

  it('getSaintOfDay flips at local midnight (french-civil)', () => {
    const before = getSaintOfDay(justBeforeMidnight, 'french-civil')
    const after = getSaintOfDay(justAfterMidnight, 'french-civil')
    expect(before).toBe('Sylvestre')
    expect(after).toBe("Jour de l'An")
    expect(before).not.toBe(after)
  })

  it("getTodayHolidays flips at local midnight: France's New Year's Day applies Jan 1 but not Dec 31", () => {
    const settings = {
      baseCountry: 'FR',
      baseRegion: null,
      extraCountries: [],
      disabledHolidayIds: []
    }

    const before = getTodayHolidays(justBeforeMidnight, settings, 'fr')
    const after = getTodayHolidays(justAfterMidnight, settings, 'fr')

    expect(before.some((h) => h.name === 'Nouvel An')).toBe(false)
    expect(after.some((h) => h.name === 'Nouvel An')).toBe(true)
  })
})

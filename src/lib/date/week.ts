/**
 * Pure date-math helpers. No `Date.now()` calls, no side effects — every
 * caller passes the `Date` in, so these are trivially unit-testable at
 * midnight/DST/leap-year boundaries (see plan P7).
 *
 * Both functions build local-midnight `Date`s (via the `(y, m, d)`
 * constructor) and round the millisecond difference to the nearest day.
 * A local midnight timestamp already bakes in whatever UTC offset applies
 * on that specific calendar date, so a DST transition between two dates
 * shows up as a ±1h drift in the raw difference — rounding absorbs that
 * instead of silently producing an off-by-one day.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

function localMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** 1-based day of year: Jan 1 -> 1, Dec 31 -> 365 or 366 in a leap year. */
export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1)
  const target = localMidnight(date)
  return Math.round((target.getTime() - start.getTime()) / MS_PER_DAY) + 1
}

/**
 * ISO-8601 week number (1-53). Follows the standard rule: week 1 is the
 * week containing the year's first Thursday, so early-January dates can
 * belong to the previous year's week 53 (e.g. 2027-01-01 is week 53 of
 * ISO week-year 2026) and late-December dates can belong to next year's
 * week 1. This returns only the week number, not the ISO week-year.
 */
export function isoWeek(date: Date): number {
  const d = localMidnight(date)
  const isoDayNum = d.getDay() || 7 // Sunday (0) -> 7, so Mon=1..Sun=7
  d.setDate(d.getDate() + 4 - isoDayNum) // shift to this week's Thursday
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const daysSinceYearStart = Math.round(
    (d.getTime() - yearStart.getTime()) / MS_PER_DAY
  )
  return Math.ceil((daysSinceYearStart + 1) / 7)
}

import type { MoonPhase, MoonPhaseKey } from './types'

/**
 * Standard synodic-month approximation — decorative UI element, not
 * ephemeris-precision. Reference new moon epoch: 2000-01-06 18:14 UTC, a
 * commonly cited reference new moon; period: 29.53058867 days (mean
 * synodic month).
 */
const REFERENCE_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0)
const SYNODIC_MONTH_DAYS = 29.53058867
const MS_PER_DAY = 24 * 60 * 60 * 1000

// 8 equal-width buckets around the cycle, centered on the named phase (e.g.
// "new moon" covers the fraction range straddling 0/1, not just fraction===0).
const BUCKETS: { max: number; key: MoonPhaseKey }[] = [
  { max: 0.0625, key: 'newMoon' },
  { max: 0.1875, key: 'waxingCrescent' },
  { max: 0.3125, key: 'firstQuarter' },
  { max: 0.4375, key: 'waxingGibbous' },
  { max: 0.5625, key: 'fullMoon' },
  { max: 0.6875, key: 'waningGibbous' },
  { max: 0.8125, key: 'lastQuarter' },
  { max: 0.9375, key: 'waningCrescent' },
  { max: 1, key: 'newMoon' }
]

function bucketFor(fraction: number): MoonPhaseKey {
  for (const bucket of BUCKETS) {
    if (fraction < bucket.max) return bucket.key
  }
  return 'newMoon'
}

/** `date` -> moon phase. 0/0.5-cycle fraction, 0 = new, 0.5 = full. */
export function moonPhase(date: Date): MoonPhase {
  const daysSinceReference =
    (date.getTime() - REFERENCE_NEW_MOON_UTC) / MS_PER_DAY
  const cycles = daysSinceReference / SYNODIC_MONTH_DAYS
  // JS `%` can return negative for dates before the epoch — normalize into [0, 1).
  const fraction = ((cycles % 1) + 1) % 1

  return { fraction, labelKey: bucketFor(fraction) }
}

/**
 * Approximate visible illumination, 0-100 — same decorative-cosine model
 * amateur moon-phase widgets use (0%/100% at new/full, smooth in between),
 * not a real ephemeris illuminated-fraction calculation.
 */
export function illuminationPercent(fraction: number): number {
  return Math.round(((1 - Math.cos(2 * Math.PI * fraction)) / 2) * 100)
}

/**
 * Days until `fraction` next reaches `target` (0 = new, 0.5 = full),
 * wrapping forward through the cycle — 0 when already at `target`.
 */
export function daysUntilPhase(fraction: number, target: number): number {
  const remaining = (((target - fraction) % 1) + 1) % 1
  return remaining * SYNODIC_MONTH_DAYS
}

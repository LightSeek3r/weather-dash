import { describe, it, expect } from 'vitest'
import { moonPhase } from '../../../src/lib/weather/moon'
import type { MoonPhaseKey } from '../../../src/lib/weather/types'

// Mirrors the reference epoch/period in moon.ts — a decorative, non-ephemeris
// approximation, so the test verifies internal bucket consistency (8-way,
// monotonic through a cycle) rather than pinning to an external ephemeris.
const REFERENCE_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0)
const SYNODIC_MONTH_DAYS = 29.53058867
const MS_PER_DAY = 24 * 60 * 60 * 1000

function dateAtFraction(fraction: number): Date {
  return new Date(
    REFERENCE_NEW_MOON_UTC + fraction * SYNODIC_MONTH_DAYS * MS_PER_DAY
  )
}

const EXPECTED_ORDER: MoonPhaseKey[] = [
  'newMoon',
  'waxingCrescent',
  'firstQuarter',
  'waxingGibbous',
  'fullMoon',
  'waningGibbous',
  'lastQuarter',
  'waningCrescent'
]

describe('moonPhase', () => {
  it('returns newMoon (fraction ~0) at the reference epoch', () => {
    const result = moonPhase(new Date(REFERENCE_NEW_MOON_UTC))
    expect(result.fraction).toBeCloseTo(0, 5)
    expect(result.labelKey).toBe('newMoon')
  })

  it('returns fullMoon at half a synodic month after the epoch', () => {
    const result = moonPhase(dateAtFraction(0.5))
    expect(result.fraction).toBeCloseTo(0.5, 5)
    expect(result.labelKey).toBe('fullMoon')
  })

  it('returns firstQuarter around fraction 0.25 and lastQuarter around 0.75', () => {
    expect(moonPhase(dateAtFraction(0.25)).labelKey).toBe('firstQuarter')
    expect(moonPhase(dateAtFraction(0.75)).labelKey).toBe('lastQuarter')
  })

  it('walks through all 8 buckets in order exactly once per cycle', () => {
    // Sample the center of each 1/8 segment, safely away from bucket
    // boundaries, and confirm the 8-way bucketing is monotonic/consistent.
    const observed = EXPECTED_ORDER.map((_, i) => {
      const fraction = i / 8 + 0.03
      return moonPhase(dateAtFraction(fraction)).labelKey
    })
    expect(observed).toEqual(EXPECTED_ORDER)
  })

  it('wraps fraction into [0, 1) for dates before the reference epoch', () => {
    const result = moonPhase(dateAtFraction(-0.25))
    expect(result.fraction).toBeGreaterThanOrEqual(0)
    expect(result.fraction).toBeLessThan(1)
    // -0.25 cycles wraps to 0.75 -> lastQuarter
    expect(result.labelKey).toBe('lastQuarter')
  })

  it('is consistent across many cycles (multi-year date)', () => {
    // ~10 years later — same bucket logic should hold regardless of how many
    // whole synodic months have elapsed.
    const farFuture = dateAtFraction(120.5)
    const result = moonPhase(farFuture)
    expect(result.fraction).toBeCloseTo(0.5, 4)
    expect(result.labelKey).toBe('fullMoon')
  })
})

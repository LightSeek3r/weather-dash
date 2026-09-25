import { describe, it, expect } from 'vitest'
import { getSaintOfDay } from '../../../src/lib/date/saints'
import romanCatholic from '../../../src/lib/date/data/saints/roman-catholic.json'
import romanCatholicFr from '../../../src/lib/date/data/saints/roman-catholic.fr.json'
import frenchCivil from '../../../src/lib/date/data/saints/french-civil.json'

describe('getSaintOfDay', () => {
  it('looks up a known date for roman-catholic', () => {
    expect(getSaintOfDay(new Date(2026, 0, 1), 'roman-catholic')).toBe(
      'Mary, Mother of God'
    )
    expect(getSaintOfDay(new Date(2026, 11, 25), 'roman-catholic')).toBe(
      'Nativity of the Lord'
    )
  })

  it('looks up a known date for french-civil', () => {
    expect(getSaintOfDay(new Date(2026, 0, 3), 'french-civil')).toBe(
      'Geneviève'
    )
    expect(getSaintOfDay(new Date(2026, 10, 11), 'french-civil')).toBe(
      'Armistice 1918'
    )
  })

  it('looks up local getMonth/getDate, not UTC', () => {
    // A local date constructed with (y, m, d) has no UTC ambiguity to begin
    // with, but this proves the function reads the local calendar fields
    // rather than calling toISOString()/getUTCDate() internally.
    const date = new Date(2026, 6, 21) // local July 21
    expect(date.getMonth()).toBe(6)
    expect(date.getDate()).toBe(21)
    expect(getSaintOfDay(date, 'french-civil')).toBe('Victor')
  })

  it('resolves Feb 29 in a leap year for both traditions', () => {
    expect(getSaintOfDay(new Date(2028, 1, 29), 'roman-catholic')).toBe(
      'St. Auguste Chapdelaine'
    )
    expect(getSaintOfDay(new Date(2028, 1, 29), 'french-civil')).toBe('Auguste')
  })

  it('returns null (never throws) for an unrecognized tradition string', () => {
    expect(
      getSaintOfDay(
        new Date(2026, 0, 1),
        'not-a-real-tradition' as unknown as Parameters<typeof getSaintOfDay>[1]
      )
    ).toBeNull()
  })

  it('every dataset entry is a non-empty string (data integrity)', () => {
    for (const value of Object.values(romanCatholic)) {
      expect(typeof value).toBe('string')
      expect((value as string).length).toBeGreaterThan(0)
    }
    for (const value of Object.values(frenchCivil)) {
      expect(typeof value).toBe('string')
      expect((value as string).length).toBeGreaterThan(0)
    }
    expect(Object.keys(romanCatholic)).toHaveLength(366)
    expect(Object.keys(frenchCivil)).toHaveLength(366)
  })

  it('reads the French roman-catholic edition for the fr locale', () => {
    const date = new Date(2026, 8, 24)
    expect(getSaintOfDay(date, 'roman-catholic', 'fr')).toBe(
      'Notre-Dame de la Merci'
    )
    expect(getSaintOfDay(date, 'roman-catholic', 'en')).toBe(
      'Our Lady of Ransom'
    )
  })

  it('falls back to the base dataset for a locale with no edition', () => {
    expect(getSaintOfDay(new Date(2026, 8, 24), 'roman-catholic', 'de')).toBe(
      'Our Lady of Ransom'
    )
    expect(getSaintOfDay(new Date(2026, 0, 3), 'french-civil', 'en')).toBe(
      'Geneviève'
    )
  })

  it('the French edition translates every entry, in the same key order', () => {
    expect(Object.keys(romanCatholicFr)).toEqual(Object.keys(romanCatholic))
    for (const value of Object.values(romanCatholicFr)) {
      expect((value as string).length).toBeGreaterThan(0)
    }
  })
})

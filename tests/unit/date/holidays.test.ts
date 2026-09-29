import { describe, it, expect } from 'vitest'
import {
  countryDisplayName,
  countryEntry,
  getHolidaysForDate,
  getRegions,
  getSupportedCountries,
  getHolidaysForDateAndSettings,
  getYearHolidays,
  parseCountryEntry,
  regionDisplayName
} from '../../../src/lib/date/holidays'

describe('getHolidaysForDate', () => {
  it("finds Belgium's Independence Day on July 21 and not on adjacent days", () => {
    const onDay = getHolidaysForDate(new Date(2026, 6, 21), 'BE', null, 'fr')
    expect(onDay.some((h) => h.name === 'Fête nationale')).toBe(true)

    const before = getHolidaysForDate(new Date(2026, 6, 20), 'BE', null, 'fr')
    const after = getHolidaysForDate(new Date(2026, 6, 22), 'BE', null, 'fr')
    expect(before.some((h) => h.name === 'Fête nationale')).toBe(false)
    expect(after.some((h) => h.name === 'Fête nationale')).toBe(false)
  })

  it("finds France's Bastille Day on July 14 and not on adjacent days", () => {
    const onDay = getHolidaysForDate(new Date(2026, 6, 14), 'FR', null, 'fr')
    expect(onDay.some((h) => h.name === 'Fête Nationale de la France')).toBe(
      true
    )

    const before = getHolidaysForDate(new Date(2026, 6, 13), 'FR', null, 'fr')
    const after = getHolidaysForDate(new Date(2026, 6, 15), 'FR', null, 'fr')
    expect(before).toHaveLength(0)
    expect(after).toHaveLength(0)
  })

  it('resolves a moving/computed date correctly: Easter Monday (BE, 2026-04-06)', () => {
    // Confirmed against the library itself before writing this test:
    // Easter Sunday 2026-04-05 (rule "easter") and Easter Monday
    // 2026-04-06 (rule "easter 1") are both real BE holidays this year.
    const easterMonday = getHolidaysForDate(
      new Date(2026, 3, 6),
      'BE',
      null,
      'fr'
    )
    expect(easterMonday.some((h) => h.name === 'Lundi de Pâques')).toBe(true)

    // The day after has no holiday at all — proves the library actually
    // computed Easter's date for this year rather than matching a fixed
    // MM-DD that happened to line up.
    const dayAfter = getHolidaysForDate(new Date(2026, 3, 7), 'BE', null, 'fr')
    expect(dayAfter).toHaveLength(0)
  })

  it('id is stable for the same holiday across two different years', () => {
    const y2026 = getHolidaysForDate(new Date(2026, 6, 21), 'BE', null, 'fr')
    const y2027 = getHolidaysForDate(new Date(2027, 6, 21), 'BE', null, 'fr')
    const id2026 = y2026.find((h) => h.name === 'Fête nationale')?.id
    const id2027 = y2027.find((h) => h.name === 'Fête nationale')?.id
    expect(id2026).toBeDefined()
    expect(id2026).toBe(id2027)

    // Same holds for a computed (Easter-relative) date across years.
    const easter2026 = getYearHolidays(2026, 'BE', null, 'fr').find(
      (h) => h.name === 'Lundi de Pâques'
    )?.id
    const easter2027 = getYearHolidays(2027, 'BE', null, 'fr').find(
      (h) => h.name === 'Lundi de Pâques'
    )?.id
    expect(easter2026).toBeDefined()
    expect(easter2026).toBe(easter2027)
  })

  it('never throws on an unrecognized country code, resolves to []', () => {
    expect(
      getHolidaysForDate(new Date(2026, 6, 21), 'NOT_A_COUNTRY', null, 'en')
    ).toEqual([])
  })
})

describe('getHolidaysForDateAndSettings', () => {
  const now = new Date(2026, 6, 21) // July 21 — BE national day, FR nothing

  it('unions holidays across baseCountry and every extraCountries entry', () => {
    const result = getHolidaysForDateAndSettings(
      now,
      {
        baseCountry: 'BE',
        baseRegion: null,
        extraCountries: ['FR'],
        disabledHolidayIds: []
      },
      'fr'
    )
    // BE's national day on this date; FR has nothing on July 21, so the
    // union should be exactly BE's holiday(s) for the day.
    expect(result.some((h) => h.name === 'Fête nationale')).toBe(true)
    expect(result.every((h) => h.countryCode === 'BE')).toBe(true)
  })

  it('adding France as an extra country surfaces its July 14 holiday too', () => {
    const bastilleDay = new Date(2026, 6, 14)
    const result = getHolidaysForDateAndSettings(
      bastilleDay,
      {
        baseCountry: 'BE',
        baseRegion: null,
        extraCountries: ['FR'],
        disabledHolidayIds: []
      },
      'fr'
    )
    expect(result.some((h) => h.name === 'Fête Nationale de la France')).toBe(
      true
    )
    expect(result.some((h) => h.countryCode === 'FR')).toBe(true)
  })

  it('dedupes when baseCountry and extraCountries overlap', () => {
    const result = getHolidaysForDateAndSettings(
      now,
      {
        baseCountry: 'BE',
        baseRegion: null,
        extraCountries: ['BE'],
        disabledHolidayIds: []
      },
      'fr'
    )
    const nationalDayEntries = result.filter((h) => h.name === 'Fête nationale')
    expect(nationalDayEntries).toHaveLength(1)
  })

  it('filters out anything whose id is in disabledHolidayIds', () => {
    const withoutFilter = getHolidaysForDateAndSettings(
      now,
      {
        baseCountry: 'BE',
        baseRegion: null,
        extraCountries: [],
        disabledHolidayIds: []
      },
      'fr'
    )
    const nationalDayId = withoutFilter.find(
      (h) => h.name === 'Fête nationale'
    )?.id
    expect(nationalDayId).toBeDefined()

    const withFilter = getHolidaysForDateAndSettings(
      now,
      {
        baseCountry: 'BE',
        baseRegion: null,
        extraCountries: [],
        disabledHolidayIds: [nationalDayId as string]
      },
      'fr'
    )
    expect(withFilter.some((h) => h.name === 'Fête nationale')).toBe(false)
  })
})

describe('getYearHolidays', () => {
  it('returns the full list of a country/region holidays for a year', () => {
    const result = getYearHolidays(2026, 'FR', null, 'fr')
    expect(result.length).toBeGreaterThan(5)
    expect(result.some((h) => h.name === 'Fête Nationale de la France')).toBe(
      true
    )
  })
})

describe('extra country regions', () => {
  const settings = (extraCountries: string[]) => ({
    baseCountry: 'BE',
    baseRegion: null,
    extraCountries,
    disabledHolidayIds: []
  })
  // Jeûne genevois: Geneva only, the Thursday after the first Sunday of September.
  const jeuneGenevois = new Date(2026, 8, 10)

  it('round-trips country and region through one entry', () => {
    expect(parseCountryEntry(countryEntry('CH', 'GE'))).toEqual({
      country: 'CH',
      region: 'GE'
    })
    expect(parseCountryEntry('CH')).toEqual({ country: 'CH', region: null })
  })

  it("queries an extra country's region, not just its national holidays", () => {
    expect(
      getHolidaysForDateAndSettings(
        jeuneGenevois,
        settings(['CH-GE']),
        'fr'
      ).map((h) => h.name)
    ).toContain('Jeûne Genevois')
    expect(
      getHolidaysForDateAndSettings(jeuneGenevois, settings(['CH']), 'fr')
    ).toEqual([])
  })
})

describe('country and region pickers', () => {
  it('names countries in the requested language, sorted by that name', () => {
    const fr = getSupportedCountries('fr')
    expect(fr.find((c) => c.code === 'CH')?.name).toBe('Suisse')
    const names = fr.map((c) => c.name)
    expect(names).toEqual([...names].sort(new Intl.Collator('fr').compare))
  })

  it('sorts regions by name', () => {
    const names = getRegions('CH', 'fr').map((r) => r.name)
    expect(names.length).toBeGreaterThan(20)
    expect(names).toEqual([...names].sort(new Intl.Collator('fr').compare))
  })

  it('countryDisplayName matches the same name getSupportedCountries uses', () => {
    expect(countryDisplayName('CH', 'fr')).toBe('Suisse')
  })

  it('regionDisplayName matches the same name getRegions uses, and falls back to the raw code when unknown', () => {
    const geneva = getRegions('CH', 'fr').find((r) => r.code === 'GE')
    expect(geneva).toBeDefined()
    expect(regionDisplayName('CH', 'GE', 'fr')).toBe(geneva?.name)
    expect(regionDisplayName('CH', 'NOT_A_REGION', 'fr')).toBe('NOT_A_REGION')
  })
})

describe('HolidayInfo.regionCode', () => {
  it('carries the region a holiday was looked up with, and null for a country-wide lookup', () => {
    const geneva = getHolidaysForDate(
      new Date(2026, 8, 10),
      'CH',
      'GE',
      'fr'
    ).find((h) => h.name === 'Jeûne Genevois')
    expect(geneva?.regionCode).toBe('GE')

    const belgium = getHolidaysForDate(new Date(2026, 6, 21), 'BE', null, 'fr')
    expect(belgium.every((h) => h.regionCode === null)).toBe(true)
  })
})

/**
 * Thin wrapper around `date-holidays` (offline, multi-country/region,
 * multilingual — see `.claude/rules/dependencies.md`). Everything here is a
 * pure function of its arguments: no `Date.now()`, no module-level Holidays
 * instance kept across calls, so callers (and tests) fully control the
 * clock/locale/country inputs (plan P7: pure date module, fixed-clock tests).
 *
 * `date-holidays`'s own `languages` option takes ISO 639-1 codes directly —
 * confirmed against the installed v3.37.0 (`new Holidays('BE', undefined,
 * { languages: ['nl'] })` returns the Dutch-translated name where a
 * translation exists) — which happens to line up with this app's 7 locale
 * codes (`en/fr/nl/de/es/it/pt`), so no mapping table is needed. Where the
 * library has no translation for the requested language it silently falls
 * back to the country's own default language rather than throwing or
 * returning English — verified with an unsupported code (`'xx'`) against a
 * real BE holiday, which came back in French (Belgium's data default). That
 * fallback behaviour is the library's, not something built on top here.
 */
import Holidays from 'date-holidays'
import type { HolidaysTypes } from 'date-holidays'

export interface HolidayInfo {
  /**
   * Stable across years (and across locale changes) because it's derived
   * from the library's internal `rule` string (e.g. `"07-21"`, `"easter 1"`)
   * rather than the display name, which is translated and therefore not a
   * safe identity key — the settings UI persists a user's per-holiday
   * disable choice by this id across both year rollover and locale changes.
   */
  id: string
  /** In the requested language where the library has a translation, else its own default. */
  name: string
  countryCode: string
  /** The region this holiday's country/region entry was looked up with — `null` for a country-wide (no region) lookup. */
  regionCode: string | null
  type: HolidaysTypes.HolidayType
}

export interface CountryOption {
  code: string
  name: string
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toHolidayInfo(
  holiday: HolidaysTypes.Holiday,
  countryCode: string,
  regionCode: string | null
): HolidayInfo {
  const key = slugify(holiday.rule || holiday.name)
  return {
    id: `${countryCode}:${key}`,
    name: holiday.name,
    countryCode,
    regionCode,
    type: holiday.type
  }
}

function localDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Raw `date-holidays` records for a country/region/year, in `language`.
 * Never throws — an unrecognized country/region code (e.g. stale settings
 * data) resolves to `[]` rather than crashing the kiosk, same "never crash
 * on bad data" spirit as `storage/settings.ts`'s `migrate()`.
 */
function rawYearHolidays(
  year: number,
  countryCode: string,
  regionCode: string | null,
  language: string
): HolidaysTypes.Holiday[] {
  try {
    // The 3-arg (country, state, opts) and 1-arg-plus-opts (country, opts)
    // overloads both exist, but there's no overload for an *optional*
    // state — so the call branches on whether a region was requested
    // instead of passing `regionCode ?? undefined` positionally.
    const hd = regionCode
      ? new Holidays(countryCode, regionCode, { languages: [language] })
      : new Holidays(countryCode, { languages: [language] })
    return hd.getHolidays(year, language)
  } catch (err) {
    console.warn(
      `[holidays] failed to load holidays for ${countryCode}/${regionCode ?? '-'}`,
      err
    )
    return []
  }
}

/** All of a country/region's holidays for `year`, in `language`. */
export function getYearHolidays(
  year: number,
  countryCode: string,
  regionCode: string | null,
  language: string
): HolidayInfo[] {
  return rawYearHolidays(year, countryCode, regionCode, language).map((h) =>
    toHolidayInfo(h, countryCode, regionCode)
  )
}

/** Holidays landing on the given calendar date (compared in local time, not UTC). */
export function getHolidaysForDate(
  date: Date,
  countryCode: string,
  regionCode: string | null,
  language: string
): HolidayInfo[] {
  const targetKey = localDateKey(date)
  return rawYearHolidays(date.getFullYear(), countryCode, regionCode, language)
    .filter((h) => h.date.slice(0, 10) === targetKey)
    .map((h) => toHolidayInfo(h, countryCode, regionCode))
}

/**
 * An `extraCountries` entry: a country code, or `CC-REGION` (ISO 3166-2
 * style, e.g. `CH-GE`) when a region was picked. Country codes never contain
 * a dash, so plain entries saved before regions existed parse unchanged.
 */
export function parseCountryEntry(entry: string): {
  country: string
  region: string | null
} {
  const dash = entry.indexOf('-')
  return dash < 0
    ? { country: entry, region: null }
    : { country: entry.slice(0, dash), region: entry.slice(dash + 1) }
}

export function countryEntry(country: string, region: string | null): string {
  return region ? `${country}-${region}` : country
}

export interface TodayHolidaysSettings {
  baseCountry: string
  baseRegion: string | null
  extraCountries: string[]
  disabledHolidayIds: string[]
}

/**
 * Union of `date`'s holidays from `baseCountry`+`baseRegion` and every
 * `extraCountries` entry (see `parseCountryEntry`), deduped by id, with
 * anything in `disabledHolidayIds` filtered out. `date` need not be "today" —
 * `Tomorrow.svelte` calls this the same way `DateLine.svelte` does, one day
 * ahead.
 */
export function getHolidaysForDateAndSettings(
  date: Date,
  settings: TodayHolidaysSettings,
  language: string
): HolidayInfo[] {
  const all = [
    ...getHolidaysForDate(
      date,
      settings.baseCountry,
      settings.baseRegion,
      language
    ),
    ...settings.extraCountries.flatMap((entry) => {
      const { country, region } = parseCountryEntry(entry)
      return getHolidaysForDate(date, country, region, language)
    })
  ]

  const seen = new Set<string>()
  const deduped: HolidayInfo[] = []
  for (const holiday of all) {
    if (seen.has(holiday.id)) continue
    seen.add(holiday.id)
    deduped.push(holiday)
  }

  return deduped.filter((h) => !settings.disabledHolidayIds.includes(h.id))
}

function byName(options: CountryOption[], language: string): CountryOption[] {
  const collator = new Intl.Collator(language)
  return options.sort((a, b) => collator.compare(a.name, b.name))
}

function regionNames(language: string): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([language], {
      type: 'region',
      fallback: 'none'
    })
  } catch {
    return null
  }
}

/**
 * A single country's display name in `language` — `Intl.DisplayNames` where
 * it has one, else the library's own (English) name, same fallback
 * `getSupportedCountries` applies per-entry below.
 */
export function countryDisplayName(
  countryCode: string,
  language = 'en'
): string {
  const fallback = new Holidays().getCountries('en')[countryCode] ?? countryCode
  return regionNames(language)?.of(countryCode) ?? fallback
}

/**
 * Every country `date-holidays` has data for, named in `language` and sorted
 * by that name. Names come from `Intl.DisplayNames`: the library's own list
 * mixes English with native-script names ("Հայաստան"), which sorts into
 * nonsense. Builds its own single `Holidays()` instance rather than calling
 * `countryDisplayName` per entry — that would create one per country (~200)
 * just for the fallback name.
 */
export function getSupportedCountries(language = 'en'): CountryOption[] {
  const names = regionNames(language)
  return byName(
    Object.entries(new Holidays().getCountries('en')).map(([code, name]) => ({
      code,
      name: names?.of(code) ?? name
    })),
    language
  )
}

/**
 * A country's first-level subdivisions (`date-holidays` calls this "state",
 * ISO 3166-2), named in `language` where the library has a translation and
 * sorted by name. This app's settings only carry one region per country, so
 * a country's rare second-level "region" subdivisions aren't exposed here.
 * Returns `[]` for a country with no subdivisions in the library's data.
 */
export function getRegions(
  countryCode: string,
  language = 'en'
): CountryOption[] {
  try {
    const hd = new Holidays()
    return byName(
      Object.entries(hd.getStates(countryCode, language)).map(
        ([code, name]) => ({ code, name })
      ),
      language
    )
  } catch (err) {
    console.warn(`[holidays] failed to load regions for ${countryCode}`, err)
    return []
  }
}

/**
 * A single region's display name within `countryCode`, in `language` where
 * `date-holidays` has a translation — falls back to the raw `regionCode`
 * (e.g. `getRegions` returning `[]` for a country with no subdivision data).
 */
export function regionDisplayName(
  countryCode: string,
  regionCode: string,
  language = 'en'
): string {
  return (
    getRegions(countryCode, language).find((r) => r.code === regionCode)
      ?.name ?? regionCode
  )
}

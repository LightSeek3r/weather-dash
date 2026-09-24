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
  countryCode: string
): HolidayInfo {
  const key = slugify(holiday.rule || holiday.name)
  return {
    id: `${countryCode}:${key}`,
    name: holiday.name,
    countryCode,
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
    toHolidayInfo(h, countryCode)
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
    .map((h) => toHolidayInfo(h, countryCode))
}

export interface TodayHolidaysSettings {
  baseCountry: string
  baseRegion: string | null
  extraCountries: string[]
  disabledHolidayIds: string[]
}

/**
 * Union of today's holidays from `baseCountry`+`baseRegion` and every
 * `extraCountries` entry (extra countries have no region of their own in
 * the settings schema, so they're queried nationwide), deduped by id, with
 * anything in `disabledHolidayIds` filtered out.
 */
export function getTodayHolidays(
  now: Date,
  settings: TodayHolidaysSettings,
  language: string
): HolidayInfo[] {
  const all = [
    ...getHolidaysForDate(
      now,
      settings.baseCountry,
      settings.baseRegion,
      language
    ),
    ...settings.extraCountries.flatMap((cc) =>
      getHolidaysForDate(now, cc, null, language)
    )
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

/** Every country `date-holidays` has data for, named in English (this signature takes no language — the settings UI's country picker list is locale-stable by design). */
export function getSupportedCountries(): CountryOption[] {
  const hd = new Holidays()
  return Object.entries(hd.getCountries('en')).map(([code, name]) => ({
    code,
    name
  }))
}

/**
 * A country's first-level subdivisions (`date-holidays` calls this "state",
 * ISO 3166-2) — this app's settings schema only has one region field, so a
 * country's rare second-level "region" subdivisions aren't exposed here.
 * Returns `[]` for a country with no subdivisions in the library's data.
 */
export function getRegions(countryCode: string): CountryOption[] {
  try {
    const hd = new Holidays()
    return Object.entries(hd.getStates(countryCode, 'en')).map(
      ([code, name]) => ({ code, name })
    )
  } catch (err) {
    console.warn(`[holidays] failed to load regions for ${countryCode}`, err)
    return []
  }
}

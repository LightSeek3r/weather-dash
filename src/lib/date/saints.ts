/**
 * Static saint-of-the-day lookup. Bundled JSON, not an API — there is no
 * saints API, and this is a decorative wall-display label, not a liturgical
 * reference (see plan premortem P11). The French civil calendar's names ARE
 * French given names, so it has no other editions. The Roman Catholic set is
 * written in English, with per-locale editions where one exists; a locale
 * without one falls back to English. An edition must translate every entry
 * (saints.test.ts checks key parity): translating only some entries would be
 * worse than translating none.
 */
import romanCatholic from './data/saints/roman-catholic.json'
import romanCatholicFr from './data/saints/roman-catholic.fr.json'
import frenchCivil from './data/saints/french-civil.json'
import type { Locale } from '../core/storage/settings'

export type SaintTradition = 'roman-catholic' | 'french-civil'

const DATASETS: Record<SaintTradition, Record<string, string>> = {
  'roman-catholic': romanCatholic,
  'french-civil': frenchCivil
}

const EDITIONS: Partial<
  Record<SaintTradition, Partial<Record<Locale, Record<string, string>>>>
> = {
  'roman-catholic': { fr: romanCatholicFr }
}

/**
 * Looks up by local `MM-DD` (not UTC), matching `week.ts`'s `localMidnight`
 * pattern of always reading local getMonth/getDate off the passed-in `Date`.
 * Returns `null` for an unrecognized tradition string rather than throwing —
 * defensive against bad/legacy settings data, same "never crash" spirit as
 * `storage/settings.ts`'s `migrate()`, even though the settings schema's
 * picklist shouldn't normally allow this.
 */
export function getSaintOfDay(
  date: Date,
  tradition: SaintTradition,
  locale?: Locale
): string | null {
  const dataset =
    (locale && EDITIONS[tradition]?.[locale]) || DATASETS[tradition]
  if (!dataset) return null

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return dataset[`${month}-${day}`] ?? null
}

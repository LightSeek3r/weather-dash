/**
 * Static saint-of-the-day lookup. Bundled JSON, not an API — there is no
 * saints API, and this is a decorative wall-display label, not a liturgical
 * reference (see plan premortem P11). Each dataset is monolingual by
 * design: the French civil calendar's names ARE French given names, and the
 * Roman Catholic set here uses common English-language saint names — do NOT
 * add per-locale translations of these names, that's explicitly out of
 * scope (flagged in the plan as a later concern, if ever). Translating only
 * some entries would be worse than translating none.
 */
import romanCatholic from './data/saints/roman-catholic.json'
import frenchCivil from './data/saints/french-civil.json'

export type SaintTradition = 'roman-catholic' | 'french-civil'

const DATASETS: Record<SaintTradition, Record<string, string>> = {
  'roman-catholic': romanCatholic,
  'french-civil': frenchCivil
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
  tradition: SaintTradition
): string | null {
  const dataset = DATASETS[tradition]
  if (!dataset) return null

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return dataset[`${month}-${day}`] ?? null
}

/**
 * `date-holidays` bundles one monolithic all-countries dataset
 * (`src/data.js`, ~790KB uncompressed — confirmed by reading the installed
 * package: it has no per-country lazy entry point, only a whole-module `.`
 * or `./data` export) and pulled the app's main Rollup chunk from ~209KB to
 * ~1.62MB precached once `holidays.ts` started being imported (see plan
 * phase 6 note). Dynamic-importing the wrapper here keeps that dependency
 * graph out of the eagerly-parsed app bundle — Rollup puts it in its own
 * chunk, fetched in parallel without blocking first paint, and this module
 * caches the one in-flight import so every caller (DateLine, SettingsSheet)
 * shares a single fetch per session instead of re-triggering it.
 *
 * This does NOT shrink the PWA's total precached bytes — the service worker
 * still precaches every chunk for offline use regardless of how it's
 * loaded — it only removes the dependency from the *eager* bundle and the
 * Rollup ">500KB chunk" build warning.
 */
export type HolidaysModule = typeof import('./holidays')

let modulePromise: Promise<HolidaysModule> | null = null

export function loadHolidays(): Promise<HolidaysModule> {
  if (!modulePromise) modulePromise = import('./holidays')
  return modulePromise
}

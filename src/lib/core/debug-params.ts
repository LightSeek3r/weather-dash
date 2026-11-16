/**
 * Debug-only URL query params (plan architecture sketch: "Debug URL params
 * (dev + tests): `?freeze=1`, `?weather=rain|snow|fog|clear-night…`,
 * `?now=ISO`"). Used both by real devs poking at the live app and by the
 * Playwright visual-matrix suite (`tests/visual/`) to get deterministic
 * screenshots — see plan premortem P8.
 *
 * Deliberately read-only/pure here: this module only parses
 * `URLSearchParams`, it never links itself into the UI or advertises these
 * params anywhere, so a normal user URL can never trigger anything by
 * accident (worst case, an unrecognised `?weather=` value is ignored).
 */

export interface DebugParams {
  /**
   * `true` for `?freeze=1` (or whenever `now` is present — see below). When
   * frozen, `main.ts` skips `scheduler.start()` so every scheduler-driven
   * "now" in the app stays exactly at `now` below, and adds a global
   * animation/transition kill-switch class to `<html>` for clean
   * screenshots (see `app.css`).
   */
  freeze: boolean
  /**
   * The fixed instant to freeze at, from `?now=<ISO>`. `null` unless
   * `freeze` is true. If `freeze=1` is set without an explicit `?now`, this
   * defaults to the real wall-clock instant at the moment the params were
   * read (a fixed "now" with a running clock doesn't make sense, so `?now`
   * alone also implies `freeze`).
   */
  now: Date | null
  /**
   * Raw `?weather=` value (e.g. `clear-day`, `rain`, `snow`...) — validated
   * against the known set by the caller (`lib/weather/debug-snapshots.ts`),
   * not here, so this module stays a dumb string-in/struct-out parser.
   */
  weather: string | null
  /** `?update=1`: behave as if a newer app version is waiting (shows the reload invitation). */
  update: boolean
}

/** Pure parse — never touches `window` itself, so it's trivially unit-testable with any query string. */
export function readDebugParams(search: string): DebugParams {
  const params = new URLSearchParams(search)

  const weather = params.get('weather')

  let explicitNow: Date | null = null
  const rawNow = params.get('now')
  if (rawNow) {
    const parsed = new Date(rawNow)
    if (!Number.isNaN(parsed.getTime())) explicitNow = parsed
  }

  const freeze = params.get('freeze') === '1' || explicitNow !== null
  const now = freeze ? (explicitNow ?? new Date()) : null

  return { freeze, now, weather, update: params.get('update') === '1' }
}

/**
 * Parsed once at module load from the real page URL — every component that
 * needs to know "are we frozen, and at what instant" imports this rather
 * than re-parsing `location.search` itself. `typeof window` guard keeps this
 * module SSR/Vitest(node)-safe.
 */
export const debugParams: DebugParams = readDebugParams(
  typeof window !== 'undefined' ? window.location.search : ''
)

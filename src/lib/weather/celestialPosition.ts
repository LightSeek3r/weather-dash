/**
 * Where the sun or moon sits in the dashboard's sky, from data the weather
 * snapshot already carries (sunrise/sunset) — no ephemeris. Deliberately a
 * decorative model, not astronomy:
 *
 * - the sun transits from today's sunrise to today's sunset;
 * - the moon is simplified to "the whole night is its transit": from the
 *   previous sunset to the next sunrise, whatever its real rise/set times;
 * - the path is a half-sine arc across the viewport. Facing the equator —
 *   south in the northern hemisphere — east is on the left, so the body
 *   rises at the left edge and sets at the right; the southern hemisphere
 *   (facing north) sees that mirrored (`arcForLatitude`).
 *
 * Positions are normalized viewport fractions (0..1, y down), so callers
 * scale them to whatever surface they draw on.
 */
import type { FxCategory, ConditionKey } from './mapWmo'

export type CelestialBody = 'sun' | 'moon'

export interface ArcBox {
  /** x where the body rises (east). */
  rise: number
  /** x where the body sets (west). */
  set: number
  /** y of the horizon, at both rise and set. */
  bottom: number
  /** How far above `bottom` the arc peaks at mid-transit. */
  arcHeight: number
}

export interface CelestialPoint {
  x: number
  y: number
}

export interface CelestialPosition extends CelestialPoint {
  body: CelestialBody
  /** 0 at rise, 0.5 at the top of the arc, 1 at set. */
  fraction: number
}

export interface SunTimes {
  /** ISO */
  sunrise: string
  /** ISO */
  sunset: string
}

// Horizon a little above the bottom edge and the peak a little below the
// top, so the disc never half-leaves the screen at rise/set or noon.
export const DEFAULT_ARC: ArcBox = {
  rise: 0.08,
  set: 0.92,
  bottom: 0.9,
  arcHeight: 0.78
}

/** The arc as seen facing the equator from `lat`: mirrored south of it. */
export function arcForLatitude(lat: number, box: ArcBox = DEFAULT_ARC): ArcBox {
  return lat < 0 ? { ...box, rise: box.set, set: box.rise } : box
}

const DAY_MS = 24 * 60 * 60 * 1000

export function clamp01(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 1 : v
}

/** How far `now` is through [start, end], clamped to 0..1 (0 for an empty or inverted window). */
export function transitFraction(
  now: number,
  start: number,
  end: number
): number {
  if (!(end > start)) return 0
  return clamp01((now - start) / (end - start))
}

/** Transit fraction → normalized viewport point on the rise → set arc. */
export function arcPosition(
  fraction: number,
  box: ArcBox = DEFAULT_ARC
): CelestialPoint {
  const f = clamp01(fraction)
  return {
    x: box.rise + f * (box.set - box.rise),
    y: box.bottom - Math.sin(f * Math.PI) * box.arcHeight
  }
}

export interface CelestialWindow {
  body: CelestialBody
  /** epoch ms */
  start: number
  /** epoch ms */
  end: number
}

/**
 * Which body is up at `now`, and its rise/set window. Before today's
 * sunrise the moon's window opens at the previous sunset, approximated as
 * today's sunset minus 24h (the snapshot has no "yesterday"). A snapshot
 * that has gone stale past tomorrow's sunrise (refreshes failing for a day
 * or more) is shifted forward by whole days rather than pinning the body at
 * the horizon. `null` when the times don't parse.
 */
export function celestialWindow(
  now: Date,
  today: SunTimes,
  tomorrow?: SunTimes
): CelestialWindow | null {
  const t = now.getTime()
  let sunrise = Date.parse(today.sunrise)
  let sunset = Date.parse(today.sunset)
  if (!Number.isFinite(t) || !Number.isFinite(sunrise)) return null
  if (!Number.isFinite(sunset) || sunset <= sunrise) return null
  const parsedNext = tomorrow ? Date.parse(tomorrow.sunrise) : NaN
  let nextSunrise =
    Number.isFinite(parsedNext) && parsedNext > sunset
      ? parsedNext
      : sunrise + DAY_MS

  if (t >= nextSunrise) {
    const shift = Math.floor((t - sunrise) / DAY_MS) * DAY_MS
    sunrise += shift
    sunset += shift
    nextSunrise = sunrise + DAY_MS
  }

  if (t < sunrise) return { body: 'moon', start: sunset - DAY_MS, end: sunrise }
  if (t <= sunset) return { body: 'sun', start: sunrise, end: sunset }
  return { body: 'moon', start: sunset, end: nextSunrise }
}

const HAS_OFFSET = /(?:[zZ]|[+-]\d\d:?\d\d)$/

/**
 * `now` re-expressed so it compares correctly against `sample`-style times.
 * Open-Meteo (`timezone=auto`) sends offset-less local times for the
 * *location*, which Date.parse reads in the *device's* zone; parsing the
 * location's wall clock the same way puts both on one footing, whatever
 * the device is set to. Times that carry an offset (and an unknown zone)
 * are already absolute and pass through.
 */
export function locationNow(now: Date, timeZone: string, sample: string): Date {
  if (HAS_OFFSET.test(sample)) return now
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).formatToParts(now)
    const get = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((p) => p.type === type)?.value ?? '00'
    const wall = Date.parse(
      `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
    )
    return Number.isFinite(wall) ? new Date(wall) : now
  } catch {
    return now
  }
}

export function celestialPosition(
  now: Date,
  today: SunTimes,
  tomorrow?: SunTimes,
  box: ArcBox = DEFAULT_ARC
): CelestialPosition | null {
  const win = celestialWindow(now, today, tomorrow)
  if (!win) return null
  const fraction = transitFraction(now.getTime(), win.start, win.end)
  return { body: win.body, fraction, ...arcPosition(fraction, box) }
}

/**
 * How much of the disc shows through the weather, 0..1. The FX layer above
 * it already veils the sky for most of these; this keeps the disc itself
 * from reading as a crisp shape behind a cloud deck or rain.
 */
export function celestialVisibility(
  fx: FxCategory,
  conditionKey?: ConditionKey
): number {
  switch (fx) {
    case 'clear':
      return 1
    case 'cloudy':
      return conditionKey === 'partlyCloudy' ? 0.75 : 0.3
    case 'fog':
      return 0.3
    case 'drizzle':
      return 0.35
    case 'snow':
      return 0.25
    case 'rain':
      return 0.2
    case 'storm':
      return 0.08
  }
}

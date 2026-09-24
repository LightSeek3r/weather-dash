/**
 * Pure wind-direction helper. Not part of the parallel agent's adapter
 * contract (types.ts/mapWmo.ts/beaufort.ts/moon.ts/store.ts) — a standalone
 * addition, so it's safe from being overwritten by their real implementation.
 */

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

/** 8-point compass letter for a meteorological direction in degrees (0-360, 0/360 = from the north). */
export function compassDirection(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360
  const index = Math.round(normalized / 45) % COMPASS_POINTS.length
  return COMPASS_POINTS[index]
}

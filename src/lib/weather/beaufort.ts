/**
 * Standard Beaufort wind scale, km/h -> force 0-12. Pure lookup, no i18n:
 * the plan's chosen display is a bare number ("Wind · force 4"), not a
 * translated descriptive name like "light breeze".
 */

// Upper bound (inclusive, km/h) for forces 0-11; anything above the last
// entry is force 12.
const UPPER_BOUND_KMH = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117]

export function beaufortForce(kmh: number): number {
  if (kmh < 0) return 0
  for (let force = 0; force < UPPER_BOUND_KMH.length; force++) {
    if (kmh <= UPPER_BOUND_KMH[force]) return force
  }
  return 12
}

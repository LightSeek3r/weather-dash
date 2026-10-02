import type { WeatherSnapshot } from './types'

/**
 * Lowest/highest temperature from the current reading to the end of the
 * location's own calendar day. `hourly` and `today.date` share one clock
 * (the location's local time from Open-Meteo, UTC in debug snapshots), so a
 * date-prefix match needs no timezone math.
 */
export function remainingDayRange(
  snapshot: Pick<WeatherSnapshot, 'current' | 'hourly' | 'today'>
): { min: number; max: number } {
  let min = snapshot.current.temperature
  let max = min
  for (const point of snapshot.hourly) {
    if (!point.time.startsWith(snapshot.today.date)) break
    if (point.temperature < min) min = point.temperature
    if (point.temperature > max) max = point.temperature
  }
  return { min, max }
}

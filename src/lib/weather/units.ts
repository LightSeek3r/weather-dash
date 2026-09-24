/**
 * Pure unit-conversion helpers for weather display. Snapshot data from
 * `openMeteo.ts` is always °C/km/h (see types.ts) — conversion to the user's
 * `settingsStore.weather.tempUnit` choice is a presentation concern, so it
 * lives here (reusable logic) rather than inline in each component.
 */
import type { Settings } from '../core/storage/settings'

export function celsiusToFahrenheit(celsius: number): number {
  return (celsius * 9) / 5 + 32
}

export function displayTemperature(
  celsius: number,
  unit: Settings['weather']['tempUnit']
): number {
  return unit === 'F' ? celsiusToFahrenheit(celsius) : celsius
}

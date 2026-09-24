/**
 * Last-good `WeatherSnapshot` persistence via `idb-keyval` (approved dep,
 * see `.claude/rules/dependencies.md`). This is what lets the app paint
 * last-known weather instantly on boot before the first fetch resolves, and
 * keeps showing something if a later fetch fails (plan premortem P6:
 * stale-but-shown beats blank).
 */
import { get, set } from 'idb-keyval'
import type { WeatherSnapshot } from './types'

const CACHE_KEY = 'wall-dashboard:weather:v1'

export async function getCachedSnapshot(): Promise<WeatherSnapshot | null> {
  try {
    const value = await get<WeatherSnapshot>(CACHE_KEY)
    return value ?? null
  } catch (err) {
    console.warn('[weather] could not read cached snapshot', err)
    return null
  }
}

export async function setCachedSnapshot(
  snapshot: WeatherSnapshot
): Promise<void> {
  try {
    await set(CACHE_KEY, snapshot)
  } catch (err) {
    console.warn('[weather] could not persist snapshot to cache', err)
  }
}

/**
 * Client for `functions/api/geo.ts`. Resolves to null on any failure —
 * including the dev server and non-Pages hosts, where `/api/geo` falls
 * through to index.html and fails JSON/shape validation — so callers only
 * ever branch on "got a position or not".
 */
export interface ApproxLocation {
  lat: number
  lon: number
  city: string | null
}

const TIMEOUT_MS = 8000

function isCoord(x: unknown, limit: number): x is number {
  return typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= limit
}

export async function fetchApproxLocation(
  fetchImpl: typeof fetch = fetch
): Promise<ApproxLocation | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetchImpl('/api/geo', { signal: controller.signal })
    if (!res.ok) return null
    const body: unknown = await res.json()
    if (typeof body !== 'object' || body === null) return null
    const { lat, lon, city } = body as Record<string, unknown>
    if (!isCoord(lat, 90) || !isCoord(lon, 180)) return null
    return { lat, lon, city: typeof city === 'string' && city ? city : null }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

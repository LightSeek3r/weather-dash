/**
 * GPS fixes carry only coordinates (Open-Meteo has no reverse geocoding), so
 * the city name comes from OpenStreetMap's Nominatim — one request per
 * "use my location" press, well inside its 1 req/s usage policy. ODbL
 * attribution is in the settings sheet. Resolves to null on any failure:
 * the caller keeps its placeholder name.
 */
const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'
const TIMEOUT_MS = 8000

export interface ReversePlace {
  /** "City, Country", the same shape `geocode()` stores for a searched city. */
  name: string
  /** ISO 3166-1 alpha-2, uppercase, or '' when unknown. */
  countryCode: string
}

interface RawAddress {
  city?: string
  town?: string
  village?: string
  municipality?: string
  county?: string
  country?: string
  country_code?: string
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  language: string,
  fetchImpl: typeof fetch = fetch
): Promise<ReversePlace | null> {
  const url = new URL(REVERSE_URL)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  // City level; finer zooms return a street or building name.
  url.searchParams.set('zoom', '10')
  url.searchParams.set('accept-language', language)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetchImpl(url.toString(), { signal: controller.signal })
    if (!res.ok) return null
    const body = (await res.json()) as { address?: RawAddress }
    const a = body.address
    const city =
      a?.city ?? a?.town ?? a?.village ?? a?.municipality ?? a?.county
    if (!a || !city) return null
    return {
      name: a.country ? `${city}, ${a.country}` : city,
      countryCode: (a.country_code ?? '').toUpperCase()
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

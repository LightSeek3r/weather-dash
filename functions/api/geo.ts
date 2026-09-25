/**
 * Cloudflare Pages Function: approximate position from the edge's own IP
 * geolocation (`request.cf`). Fallback for the settings sheet when the
 * browser Geolocation API can't get a fix (typically a desktop with the OS
 * location service off) — same origin, no third-party service, no key.
 */
interface CfGeo {
  latitude?: string
  longitude?: string
  city?: string
  country?: string
}

const HEADERS = { 'cache-control': 'private, no-store' }

export function onRequestGet({
  request
}: {
  request: Request & { cf?: CfGeo }
}): Response {
  const cf = request.cf ?? {}
  const lat = cf.latitude ? Number(cf.latitude) : NaN
  const lon = cf.longitude ? Number(cf.longitude) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json(
      { error: 'unavailable' },
      { status: 404, headers: HEADERS }
    )
  }
  return Response.json(
    { lat, lon, city: cf.city ?? null, country: cf.country ?? null },
    { headers: HEADERS }
  )
}

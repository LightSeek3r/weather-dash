import { describe, it, expect } from 'vitest'
import { fetchApproxLocation } from '../../../src/lib/weather/approxLocation'
import { onRequestGet } from '../../../functions/api/geo'

function fakeFetch(res: Response | Error): typeof fetch {
  return (async () => {
    if (res instanceof Error) throw res
    return res
  }) as typeof fetch
}

describe('fetchApproxLocation', () => {
  it('returns coordinates and city from /api/geo', async () => {
    const res = Response.json({ lat: 47.37, lon: 8.54, city: 'Zurich' })
    expect(await fetchApproxLocation(fakeFetch(res))).toEqual({
      lat: 47.37,
      lon: 8.54,
      city: 'Zurich'
    })
  })

  it('null city when the edge has none', async () => {
    const res = Response.json({ lat: 1, lon: 2, city: null })
    expect((await fetchApproxLocation(fakeFetch(res)))?.city).toBeNull()
  })

  it('null on SPA fallback HTML (dev server / non-Pages host)', async () => {
    const res = new Response('<!doctype html><html></html>', {
      headers: { 'content-type': 'text/html' }
    })
    expect(await fetchApproxLocation(fakeFetch(res))).toBeNull()
  })

  it('null on HTTP error, network error and out-of-range coordinates', async () => {
    expect(
      await fetchApproxLocation(fakeFetch(new Response('', { status: 404 })))
    ).toBeNull()
    expect(
      await fetchApproxLocation(fakeFetch(new TypeError('offline')))
    ).toBeNull()
    expect(
      await fetchApproxLocation(fakeFetch(Response.json({ lat: 91, lon: 0 })))
    ).toBeNull()
  })
})

describe('functions/api/geo', () => {
  function call(cf?: Record<string, string>): Response {
    const request = Object.assign(new Request('https://x/api/geo'), { cf })
    return onRequestGet({ request })
  }

  it('maps request.cf to numeric coordinates, uncached', async () => {
    const res = call({
      latitude: '47.37',
      longitude: '8.54',
      city: 'Zurich',
      country: 'CH'
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(await res.json()).toEqual({
      lat: 47.37,
      lon: 8.54,
      city: 'Zurich',
      country: 'CH'
    })
  })

  it('404 when the edge has no position', () => {
    expect(call().status).toBe(404)
    expect(call({ latitude: '', longitude: '' }).status).toBe(404)
  })
})

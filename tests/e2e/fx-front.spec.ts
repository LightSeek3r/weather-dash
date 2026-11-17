import { test, expect, type Page } from '@playwright/test'

/**
 * Weather FX around the text that sits straight on the sky: no calm zone
 * may quiet them there (a quieter zone reads as a mask behind the clock),
 * and the front layer that lets a few rays/flakes/streaks cross the text
 * must stay fully transparent over the glass cards.
 */

const STORAGE_KEY = 'wall-dashboard:settings:v1'

const SETTINGS = {
  version: 2,
  locale: 'en',
  clock: { format: '24h', showSeconds: false },
  location: { lat: 50.85, lon: 4.35, name: 'Brussels, Belgium' },
  weather: { tempUnit: 'C', windUnit: 'kmh', showBeaufort: true },
  holidays: {
    baseCountry: 'BE',
    baseRegion: null,
    extraCountries: [],
    disabledHolidayIds: []
  },
  saints: { tradition: 'roman-catholic', enabled: true },
  nightMode: { start: '23:59', end: '00:00' },
  fullscreenScene: { intervalSeconds: 1800, durationSeconds: 20 },
  photos: {
    rotationDuration: '10m',
    dimOpacity: 0.55,
    blurPx: 0,
    shuffle: false
  },
  reducedMotion: 'off',
  fxQuality: 'high'
}

const CASES = [
  {
    weather: 'clear-day',
    now: '2026-01-15T10:00:00',
    width: 1440,
    height: 900
  },
  {
    weather: 'clear-day',
    now: '2026-01-15T15:00:00',
    width: 820,
    height: 1180
  },
  { weather: 'snow', now: '2026-01-15T12:00:00', width: 1440, height: 900 },
  { weather: 'storm', now: '2026-01-15T12:00:00', width: 1440, height: 900 }
]

async function open(page: Page, c: (typeof CASES)[number]) {
  await page.setViewportSize({ width: c.width, height: c.height })
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [STORAGE_KEY, JSON.stringify(SETTINGS)]
  )
  await page.goto(`/?now=${c.now}&weather=${c.weather}`)
  await page.locator('.start-overlay__dismiss').click()
  await expect(page.locator('.border-fx--front canvas')).toHaveCount(1)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
}

for (const c of CASES) {
  test(`${c.weather} ${c.width}x${c.height}: FX cross the text, never the cards`, async ({
    page
  }) => {
    await open(page, c)

    await expect(
      page.locator('.hero[data-fx-calm], .tm[data-fx-calm]')
    ).toHaveCount(0)

    const { overCards, elsewhere } = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '.border-fx--front canvas'
      )!
      const ctx = canvas.getContext('2d')!
      const k = canvas.width / innerWidth
      const maxAlpha = (x: number, y: number, w: number, h: number): number => {
        const d = ctx.getImageData(
          Math.round(x * k),
          Math.round(y * k),
          Math.max(1, Math.round(w * k)),
          Math.max(1, Math.round(h * k))
        ).data
        let m = 0
        for (let i = 3; i < d.length; i += 4) if (d[i] > m) m = d[i]
        return m
      }
      // The edge pixel of the cut-out is anti-aliased (a card edge rarely
      // sits on a whole backing-store pixel), so probe 2px inside the card.
      const EDGE = 2
      let overCards = 0
      for (const el of document.querySelectorAll('.cap, .tl')) {
        const r = el.getBoundingClientRect()
        // The cut-out follows the card's rounded corners, so the slivers of
        // sky outside them may carry FX: probe the two bands that stay
        // inside the shape.
        const rad = Math.min(
          parseFloat(getComputedStyle(el).borderTopLeftRadius),
          r.width / 2,
          r.height / 2
        )
        overCards = Math.max(
          overCards,
          maxAlpha(
            r.left + rad,
            r.top + EDGE,
            r.width - 2 * rad,
            r.height - 2 * EDGE
          ),
          maxAlpha(
            r.left + EDGE,
            r.top + rad,
            r.width - 2 * EDGE,
            r.height - 2 * rad
          )
        )
      }
      return { overCards, elsewhere: maxAlpha(0, 0, innerWidth, innerHeight) }
    })
    expect(overCards).toBe(0)
    expect(elsewhere).toBeGreaterThan(0)
  })
}

// The front layer is erased with the card's real shape. Squared off, the
// cut-out also removes the sliver of sky outside each rounded corner, and a
// near cloud crossing a card then shows it with square corners. The cut-out
// is exercised on a solid canvas (the real front layer only has FX where a
// wisp or flake happens to be) with the page's real cards and radii.
test('the front-layer cut-out follows the cards rounded corners', async ({
  page
}) => {
  await open(page, CASES[0])

  const probes = await page.evaluate(async () => {
    const { measureCalmZones, clearZones } =
      await import('/src/lib/fx/calm-zones.ts')
    const canvas = document.createElement('canvas')
    canvas.width = innerWidth
    canvas.height = innerHeight
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    clearZones(ctx, measureCalmZones(document), 1)
    const alphaAt = (x: number, y: number): number =>
      ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3]

    return Array.from(document.querySelectorAll('.cap, .tl')).map((el) => {
      const r = el.getBoundingClientRect()
      const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius)
      const d = 0.2 * rad
      return {
        rad,
        centre: alphaAt((r.left + r.right) / 2, (r.top + r.bottom) / 2),
        // just inside the straight edges
        edges: [
          alphaAt(r.left + 3, (r.top + r.bottom) / 2),
          alphaAt(r.right - 3, (r.top + r.bottom) / 2),
          alphaAt((r.left + r.right) / 2, r.top + 3),
          alphaAt((r.left + r.right) / 2, r.bottom - 3)
        ],
        // the sliver of sky outside each rounded corner
        slivers: [
          alphaAt(r.left + d, r.top + d),
          alphaAt(r.right - d, r.top + d),
          alphaAt(r.right - d, r.bottom - d),
          alphaAt(r.left + d, r.bottom - d)
        ]
      }
    })
  })

  expect(probes).toHaveLength(2)
  for (const p of probes) {
    expect(p.rad).toBeGreaterThan(8) // the cards really are rounded
    expect(p.centre).toBe(0)
    expect(p.edges).toEqual([0, 0, 0, 0])
    expect(p.slivers).toEqual([255, 255, 255, 255])
  }
})

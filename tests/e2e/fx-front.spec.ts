import { test, expect } from '@playwright/test'

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

for (const c of CASES) {
  test(`${c.weather} ${c.width}x${c.height}: FX cross the text, never the cards`, async ({
    page
  }) => {
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
      let overCards = 0
      for (const el of document.querySelectorAll('.cap, .tl')) {
        const r = el.getBoundingClientRect()
        overCards = Math.max(
          overCards,
          maxAlpha(r.left, r.top, r.width, r.height)
        )
      }
      return { overCards, elsewhere: maxAlpha(0, 0, innerWidth, innerHeight) }
    })
    expect(overCards).toBe(0)
    expect(elsewhere).toBeGreaterThan(0)
  })
}

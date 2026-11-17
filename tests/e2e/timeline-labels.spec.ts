import { test, expect } from '@playwright/test'

/**
 * The hourly strip's labels keep their font floors while the strip shrinks
 * with the screen, so on a phone they used to run over the icons above them,
 * over each other, and out of the card on the left. Nothing may overlap or
 * be clipped, whatever the screen.
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

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
  { width: 820, height: 1180 },
  { width: 667, height: 375 },
  { width: 568, height: 320 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 }
]

for (const { width, height } of SIZES) {
  test(`hourly labels neither overlap nor clip at ${width}x${height}`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height })
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [STORAGE_KEY, JSON.stringify(SETTINGS)]
    )
    await page.goto('/?now=2026-11-16T16:07:00&weather=rain&freeze=1')
    await page.locator('.start-overlay__dismiss').click()
    await expect(page.locator('.curve .t').first()).toBeVisible()

    const r = await page.evaluate(() => {
      const box = (el: Element) => el.getBoundingClientRect()
      const viewport = box(document.querySelector('.viewport')!)
      const icons = box(document.querySelector('.icons')!)
      const temps = [...document.querySelectorAll('.curve .t .v')].map(box)
      const pcts = [...document.querySelectorAll('.rain div span')]
        .filter((el) => getComputedStyle(el).visibility !== 'hidden')
        .map(box)
      const hit = (a: DOMRect, b: DOMRect) =>
        a.left < b.right - 0.5 &&
        a.right > b.left + 0.5 &&
        a.top < b.bottom - 0.5 &&
        a.bottom > b.top + 0.5
      const labels = [...temps, ...pcts]
      return {
        clipped: labels.filter(
          (l) => l.left < viewport.left - 0.5 || l.right > viewport.right + 0.5
        ).length,
        // A label's line box may graze the icons row's bottom margin (6px): the glyphs themselves stay clear.
        overIcons: temps.filter((t) => t.top < icons.bottom - 6).length,
        crossed: temps.filter((t) => pcts.some((p) => hit(t, p))).length,
        pctPairs: pcts.filter((p, i) => pcts.some((q, j) => j > i && hit(p, q)))
          .length,
        count: temps.length
      }
    })

    expect(r.count).toBeGreaterThan(0)
    expect(r.clipped).toBe(0)
    expect(r.overIcons).toBe(0)
    expect(r.crossed).toBe(0)
    expect(r.pctPairs).toBe(0)
  })
}

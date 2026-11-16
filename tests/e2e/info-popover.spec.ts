import { test, expect } from '@playwright/test'

/**
 * Tap-to-reveal info popovers (InfoDisclosure) must stay fully on screen at
 * any resolution: they flip to the roomier side and slide back inside the
 * viewport rather than being cropped by a screen edge.
 */

const STORAGE_KEY = 'wall-dashboard:settings:v1'

const SETTINGS = {
  version: 2,
  locale: 'fr',
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
  { width: 663, height: 424 },
  { width: 568, height: 320 },
  { width: 390, height: 844 },
  { width: 360, height: 640 }
]

for (const { width, height } of SIZES) {
  test(`popovers stay inside the viewport at ${width}x${height}`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height })
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [STORAGE_KEY, JSON.stringify(SETTINGS)]
    )
    await page.goto('/?now=2026-01-15T10:00:00&weather=rain&freeze=1')
    await page.locator('.start-overlay__dismiss').click()
    const triggers = page.locator('.info-disclosure__trigger')
    await expect(triggers.first()).toBeVisible()
    const count = await triggers.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      await triggers.nth(i).click({ force: true })
      const popover = page.locator('.info-disclosure__popover')
      await expect(popover).toHaveCount(1)
      await expect
        .poll(async () => {
          const r = await popover.evaluate((el) => {
            const b = el.getBoundingClientRect()
            return {
              left: b.left,
              top: b.top,
              right: b.right,
              bottom: b.bottom
            }
          })
          return (
            r.left >= -0.5 &&
            r.top >= -0.5 &&
            r.right <= width + 0.5 &&
            r.bottom <= height + 0.5
          )
        })
        .toBe(true)
      await page.keyboard.press('Escape')
    }
  })
}

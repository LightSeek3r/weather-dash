import { test, expect } from '@playwright/test'

/**
 * The date line marks a day off work (the calendar's `public` holidays) with
 * an icon before the holiday's name; ordinary days carry none.
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
  fxQuality: 'off'
}

async function open(page: import('@playwright/test').Page, now: string) {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [STORAGE_KEY, JSON.stringify(SETTINGS)]
  )
  await page.goto(`/?now=${now}&weather=clear-day&freeze=1`)
  await page.locator('.start-overlay__dismiss').click()
}

test('a public holiday gets the bank-holiday icon before its name', async ({
  page
}) => {
  await open(page, '2026-07-21T10:00:00') // Belgian National Day
  const icon = page.locator('.meta .holiday .bank-ic')
  await expect(icon).toHaveCount(1)
  await expect(icon).toHaveAccessibleName('Bank holiday')
})

test('an ordinary day shows no holiday item or icon', async ({ page }) => {
  await open(page, '2026-07-22T10:00:00')
  await expect(page.locator('.meta')).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page.locator('.bank-ic')).toHaveCount(0)
})

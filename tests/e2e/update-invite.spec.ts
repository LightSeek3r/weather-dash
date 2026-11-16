import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * A waiting app version (`?update=1` simulates it) turns the status dot into
 * an invitation with a Reload button; dismissing it leaves a pulsing dot.
 */

const STORAGE_KEY = 'wall-dashboard:settings:v1'

const SETTINGS_WITH_LOCATION = {
  version: 2,
  locale: 'en',
  clock: { format: '24h', showSeconds: false },
  location: { lat: 50.85, lon: 4.35, name: 'Brussels' },
  weather: { tempUnit: 'C', windUnit: 'kmh', showBeaufort: true },
  holidays: {
    baseCountry: 'FR',
    baseRegion: null,
    extraCountries: [],
    disabledHolidayIds: []
  },
  saints: { tradition: 'roman-catholic', enabled: true },
  nightMode: { start: '22:00', end: '07:00' },
  fullscreenScene: { intervalSeconds: 1800, durationSeconds: 20 },
  photos: {
    rotationDuration: '10m',
    dimOpacity: 0.55,
    blurPx: 0,
    shuffle: false
  },
  reducedMotion: 'auto',
  fxQuality: 'auto'
}

test.beforeEach(async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', (route) => route.abort())
  await page.route('https://air-quality-api.open-meteo.com/**', (route) =>
    route.abort()
  )
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value))
    },
    { key: STORAGE_KEY, value: SETTINGS_WITH_LOCATION }
  )
  await page.goto('/?update=1')
  await page.locator('.start-overlay').click()
})

test('an available update turns the dot into a reload invitation', async ({
  page
}) => {
  const dot = page.locator('.status-pill__dot')
  await expect(dot).toHaveClass(/status-pill__dot--update/)
  await expect(dot).toHaveAttribute('aria-label', 'New version available')
  // The overlay tap above counts as an outside click and folds the card.
  await dot.click()
  const invite = page.locator('.status-pill__invite')
  await expect(invite).toBeVisible()
  await expect(invite.getByRole('button', { name: 'Reload' })).toBeVisible()
})

test('the invitation folds back into the pulsing dot and can be reopened', async ({
  page
}) => {
  const dot = page.locator('.status-pill__dot')
  await dot.click()
  await expect(page.locator('.status-pill__invite')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.status-pill__invite')).toHaveCount(0)
  await expect(dot).toHaveClass(/status-pill__dot--update/)
  await dot.click()
  await expect(page.locator('.status-pill__invite')).toBeVisible()
})

test('the Reload button reloads the page', async ({ page }) => {
  await page.locator('.status-pill__dot').click()
  const reloaded = page.waitForEvent('load')
  await page.getByRole('button', { name: 'Reload' }).click()
  await reloaded
})

test.describe('small phone', () => {
  test.use({ viewport: { width: 320, height: 568 } })

  test('the invitation stays inside the viewport', async ({ page }) => {
    await page.locator('.status-pill__dot').click()
    const box = await page.locator('.status-pill__invite').boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  })
})

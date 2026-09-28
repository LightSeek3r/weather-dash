import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * Status pill redesign (plan: "live-usage fixes" #6) — the always-visible
 * "Updated just now" text was replaced by a small dot; detail only shows on
 * tap. Covers what unit tests can't: the actual click-to-reveal/dismiss
 * interaction and that the dot stays keyboard/screen-reader accessible
 * (aria-label always present) even though the visible text isn't.
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
  await page.goto('/')
  await page.locator('.start-overlay').click()
})

test('status pill shows a dot with no visible label by default', async ({
  page
}) => {
  const dot = page.locator('.status-pill__dot')
  await expect(dot).toBeVisible()
  // No visible text detail until tapped.
  await expect(page.locator('.status-pill__detail')).toHaveCount(0)
  // Still accessible: an always-present label describing current status.
  await expect(dot).toHaveAttribute('aria-label', /.+/)
})

test('tapping the dot reveals detail text, tapping again hides it', async ({
  page
}) => {
  const dot = page.locator('.status-pill__dot')
  await dot.click()
  const detail = page.locator('.status-pill__detail')
  await expect(detail).toBeVisible()

  await dot.click()
  await expect(detail).toHaveCount(0)
})

test('clicking outside dismisses the open detail popover', async ({ page }) => {
  const dot = page.locator('.status-pill__dot')
  await dot.click()
  await expect(page.locator('.status-pill__detail')).toBeVisible()

  await page.mouse.click(20, 20)
  await expect(page.locator('.status-pill__detail')).toHaveCount(0)
})

test('Escape dismisses the open detail popover', async ({ page }) => {
  const dot = page.locator('.status-pill__dot')
  await dot.click()
  await expect(page.locator('.status-pill__detail')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.status-pill__detail')).toHaveCount(0)
})

test('dot turns stale once the last good update is over two hours old', async ({
  browser
}) => {
  const page = await browser.newPage()
  await page.clock.install({ time: new Date('2026-09-24T17:30:00') })
  const forecast = readFileSync(
    'tests/fixtures/open-meteo/forecast-brussels.json',
    'utf8'
  )
  let fail = false
  await page.route('https://api.open-meteo.com/**', (route) =>
    fail
      ? route.abort()
      : route.fulfill({ contentType: 'application/json', body: forecast })
  )
  await page.route('https://air-quality-api.open-meteo.com/**', (route) =>
    route.abort()
  )
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value))
    },
    { key: STORAGE_KEY, value: SETTINGS_WITH_LOCATION }
  )
  await page.goto('/')
  await page.locator('.start-overlay').click()
  const dot = page.locator('.status-pill__dot')
  await expect(page.locator('.temp')).toBeVisible()
  await expect(dot).not.toHaveClass(/--stale/)

  fail = true
  // fastForward, not runFor: stepping through 2.5h of second ticks and
  // frames one by one outlasts the test timeout.
  await page.clock.fastForward(2.5 * 60 * 60 * 1000)
  await expect(dot).toHaveClass(/status-pill__dot--stale/)
  await page.close()
})

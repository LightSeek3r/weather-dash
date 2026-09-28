import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * Fullscreen opt-out + "go fullscreen" button. The Fullscreen API is stubbed
 * (a fake `fullscreenElement` plus a dispatched `fullscreenchange`) so the
 * test doesn't depend on whether headless Chromium really enters fullscreen.
 */

const STORAGE_KEY = 'wall-dashboard:settings:v1'

const BASE_SETTINGS = {
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

const FORECAST = readFileSync(
  'tests/fixtures/open-meteo/forecast-brussels.json',
  'utf8'
)

async function setup(page: Page, settings: object) {
  // A failed fetch's error toast would sit over the bottom-right buttons.
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: FORECAST })
  )
  await page.route('https://air-quality-api.open-meteo.com/**', (route) =>
    route.abort()
  )
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value))
      let current: Element | null = null
      Object.defineProperty(Document.prototype, 'fullscreenElement', {
        configurable: true,
        get: () => current
      })
      const set = (el: Element | null) => {
        current = el
        document.dispatchEvent(new Event('fullscreenchange'))
      }
      Element.prototype.requestFullscreen = function () {
        set(this)
        return Promise.resolve()
      }
      Document.prototype.exitFullscreen = () => {
        set(null)
        return Promise.resolve()
      }
    },
    { key: STORAGE_KEY, value: settings }
  )
}

const fsButton = (page: Page) => page.locator('.gear--fullscreen')

test('opted out: no start overlay, button enters fullscreen and hides', async ({
  page
}) => {
  await setup(page, { ...BASE_SETTINGS, fullscreenOnStart: false })
  await page.goto('/')

  await expect(page.locator('.start-overlay')).toHaveCount(0)
  await expect(fsButton(page)).toBeVisible()

  await fsButton(page).click()
  await expect(fsButton(page)).toHaveCount(0)
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(true)
})

test('default: overlay enters fullscreen, button returns after exit', async ({
  page
}) => {
  await setup(page, BASE_SETTINGS)
  await page.goto('/')

  await page.locator('.start-overlay').click()
  await expect(page.locator('.start-overlay')).toHaveCount(0)
  await expect(fsButton(page)).toHaveCount(0)

  await page.evaluate(() => document.exitFullscreen())
  await expect(fsButton(page)).toBeVisible()
})

test('standalone launch never offers the button', async ({ page }) => {
  await setup(page, { ...BASE_SETTINGS, fullscreenOnStart: false })
  await page.addInitScript(() => {
    const originalMatchMedia = window.matchMedia.bind(window)
    window.matchMedia = (query: string) => {
      if (query === '(display-mode: standalone)') {
        return { matches: true, media: query } as MediaQueryList
      }
      return originalMatchMedia(query)
    }
  })
  await page.goto('/')

  await expect(page.locator('.page')).toBeVisible()
  await expect(fsButton(page)).toHaveCount(0)
})

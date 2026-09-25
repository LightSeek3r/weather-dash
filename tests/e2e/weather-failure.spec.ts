import { test, expect } from '@playwright/test'

/**
 * Failure-path E2E for the weather fetch (plan: "Playwright failure-path E2E
 * (500/timeout/offline -> toasts + pill)"). Aborts the Open-Meteo forecast
 * (and air-quality) requests and confirms the app survives — no blank page,
 * no thrown app error — with a location already set in localStorage settings
 * so a fetch is actually attempted, and asserts the error toast this
 * triggers via `lib/weather/store.ts`'s `initWeather()` (wired into
 * `App.svelte`'s `onMount` since phase 2).
 *
 * `net::ERR_FAILED` console lines are Chromium's own intrinsic logging for
 * *any* aborted request — including this test's deliberate `route.abort()`
 * calls — not something the app's code emits. Filtered out below rather than
 * asserted against, so a genuine app-thrown console error still fails this
 * test loudly instead of getting lost in expected browser noise.
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

/** Chromium's own network-failure logging for an intentionally aborted request — not an app error. */
const EXPECTED_NETWORK_NOISE = /net::ERR_FAILED|Failed to load resource/

test('weather fetch failure does not crash the app and surfaces via the toast system', async ({
  page
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text())
  })

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

  // Crash-proof baseline: the app must render something, not a blank page,
  // and must not throw.
  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('#app')).not.toBeEmpty()

  // The error toast is the primary assertion — initWeather() must actually
  // surface the failure, not fail silently.
  const errorToast = page.locator('.toast.toast--error')
  await expect(errorToast.first()).toBeVisible()

  // No *app* error slipped through, once the expected network-abort noise
  // (see module doc) and the favicon 404 are filtered out.
  const unexpected = pageErrors.filter(
    (e) => !e.includes('favicon') && !EXPECTED_NETWORK_NOISE.test(e)
  )
  expect(unexpected).toEqual([])
})

import { test, expect, type Page } from '@playwright/test'
import {
  DEBUG_WEATHER_STATES,
  DEBUG_WEATHER_PROFILES,
  type DebugWeatherState
} from '../../src/lib/weather/debug-snapshots'

/**
 * Visual regression matrix (plan phase 6 verification: viewports x weather x
 * {no photo, photo}) — see plan premortem P8 for why this lives in its own
 * `tests/visual/` project (separate Playwright project in
 * playwright.config.ts, chromium only, `maxDiffPixelRatio: 0.02` tolerance
 * for font antialiasing).
 *
 * Determinism comes entirely from the debug query params implemented in
 * `lib/core/debug-params.ts`: `?freeze=1` stops the scheduler and every CSS
 * animation/transition, `?now=` fixes "now" everywhere it matters
 * (clock/date/night-mode gating/weather timeline), and `?weather=<state>`
 * substitutes one of six canned `WeatherSnapshot`s instead of a real
 * Open-Meteo fetch — so no network dependency and no wall-clock dependency.
 *
 * CAVEAT (see this task's final report): these baselines were generated on
 * a Windows dev machine, not the official Playwright Docker image the plan
 * calls for — font rendering/subpixel AA can differ across OS/GPU, so they
 * may need regenerating in CI/Docker before they're trustworthy there.
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

const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '820x1180', width: 820, height: 1180 },
  { name: '1180x820', width: 1180, height: 820 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '3840x2160', width: 3840, height: 2160 }
]

// Fixed instant per weather state. clear-night's falls inside the default
// 22:00-07:00 night window (lib/core/night-mode.ts) so NightDim/BorderFx
// pick the intended night look; every other state sits in mid-afternoon so
// night mode never kicks in and masks the weather-specific border FX.
const NOW_ISO: Record<DebugWeatherState, string> = {
  'clear-day': '2026-01-15T15:00:00',
  'clear-night': '2026-01-15T23:00:00',
  rain: '2026-01-15T15:00:00',
  snow: '2026-01-15T15:00:00',
  fog: '2026-01-15T15:00:00',
  storm: '2026-01-15T15:00:00'
}

const PHOTO_VARIANTS = ['no-photo', 'photo'] as const
type PhotoVariant = (typeof PHOTO_VARIANTS)[number]

// Smallest possible valid PNG (1x1 white pixel) — content doesn't matter,
// only that Background.svelte gets a real decodable image blob to render.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

/**
 * Seeds one photo directly into the same IndexedDB (`keyval-store`/`keyval`,
 * key prefix `wall-dashboard:photos:v1:`) idb-keyval/`lib/photos/store.ts`
 * use, via `page.addInitScript` — runs before the app's own module scripts,
 * so `Background.svelte`'s `listPhotos()` sees it on its very first read.
 */
async function seedPhoto(page: Page): Promise<void> {
  await page.addInitScript(
    ({ base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: 'image/png' })
      const photo = {
        id: 'debug-visual-photo',
        blob,
        addedAt: 0,
        width: 1,
        height: 1
      }
      const req = indexedDB.open('keyval-store')
      req.onupgradeneeded = () => req.result.createObjectStore('keyval')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('keyval', 'readwrite')
        tx.objectStore('keyval').put(
          photo,
          'wall-dashboard:photos:v1:debug-visual-photo'
        )
      }
    },
    { base64: TINY_PNG_BASE64 }
  )
}

async function seedSettings(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: SETTINGS_WITH_LOCATION }
  )
}

interface ContrastSample {
  fg: string
  bg: string
}

/** WCAG relative-luminance contrast ratio between two CSS colors (hex or rgb()/rgba()). */
function contrastRatio({ fg, bg }: ContrastSample): number | null {
  function parse(css: string): [number, number, number] | null {
    const hex = css.trim().match(/^#([0-9a-f]{6})$/i)
    if (hex) {
      const n = parseInt(hex[1], 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const rgb = css.match(/rgba?\(([^)]+)\)/i)
    if (rgb) {
      const parts = rgb[1].split(',').map((s) => parseFloat(s))
      if (parts.length >= 3) return [parts[0], parts[1], parts[2]]
    }
    return null
  }
  function luminance([r, g, b]: [number, number, number]): number {
    const srgb = [r, g, b].map((c) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
  }
  const fgRgb = parse(fg)
  const bgRgb = parse(bg)
  if (!fgRgb || !bgRgb) return null
  const l1 = luminance(fgRgb) + 0.05
  const l2 = luminance(bgRgb) + 0.05
  return l1 > l2 ? l1 / l2 : l2 / l1
}

test.describe('visual matrix', () => {
  for (const viewport of VIEWPORTS) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } })

      for (const weather of DEBUG_WEATHER_STATES) {
        for (const photoVariant of PHOTO_VARIANTS as readonly PhotoVariant[]) {
          const hasPhoto = photoVariant === 'photo'

          test(`${weather} / ${photoVariant}`, async ({ page }) => {
            await seedSettings(page)
            if (hasPhoto) await seedPhoto(page)

            const now = NOW_ISO[weather]
            await page.goto(
              `/?freeze=1&now=${encodeURIComponent(now)}&weather=${weather}`
            )

            // Tap-to-start overlay (App.svelte) — dismiss it like a real
            // kiosk boot so the screenshot shows the dashboard, not the
            // overlay.
            const startButton = page.locator('.start-overlay')
            await startButton.click()
            await expect(startButton).toHaveCount(0)

            // Settle: wait for the current-weather panel to actually show
            // this state's canned temperature, rather than an arbitrary
            // sleep — this is the concrete signal that debugParams.weather
            // made it all the way through App.svelte -> setDebugWeatherSnapshot
            // -> weatherStore -> CurrentWeather.svelte.
            const expectedTemp = Math.round(
              DEBUG_WEATHER_PROFILES[weather].temperature
            )
            await expect(page.locator('.temp')).toContainText(
              `${expectedTemp}°C`
            )

            if (hasPhoto) {
              await expect(page.locator('.photo-layer.visible')).toHaveCount(1)
              // The dim slider is the photo's only dim: a second layer or a
              // fixed scrim floor on top of it hid photos at any setting.
              await expect(page.locator('.photo-dim')).toHaveCount(0)
              const scrim = await page
                .locator('.scrim')
                .evaluate((el) => getComputedStyle(el).backgroundImage)
              expect(scrim).toContain(
                `rgba(10, 23, 38, ${SETTINGS_WITH_LOCATION.photos.dimOpacity})`
              )
            }

            // No horizontal scroll at any viewport (plan premortem P9:
            // readable/laid-out correctly from phone to 4K TV).
            const noHorizontalScroll = await page.evaluate(
              () =>
                document.documentElement.scrollWidth ===
                document.documentElement.clientWidth
            )
            expect(noHorizontalScroll).toBe(true)

            // WCAG AA spot-check — smoke-tests that this debug path renders
            // with the same tuned text/sky tokens the rest of the app
            // already relies on (see design-tokens.css / NightDim.svelte's
            // own contrast comments); not re-deriving the scrim/dim contrast
            // math itself.
            const contrast = await page.evaluate(() => {
              const root = getComputedStyle(document.documentElement)
              return {
                fg: root.getPropertyValue('--text').trim(),
                bg: root.getPropertyValue('--sky-1').trim()
              }
            })
            const ratio = contrastRatio(contrast)
            expect(ratio).not.toBeNull()
            expect(ratio as number).toBeGreaterThanOrEqual(4.5)

            await expect(page).toHaveScreenshot(
              `${viewport.name}-${weather}-${photoVariant}.png`
            )
          })
        }
      }
    })
  }
})

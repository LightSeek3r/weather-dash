import { test, expect } from '@playwright/test'

/**
 * Nothing on the dashboard may be lost on an awkward screen, only resized
 * (lib/ui/fit-height.ts). The visual matrix's viewports all happened to fit;
 * 16:10 laptops with a long weekday, saint and city name did not — the meta
 * row's last line slid under the timeline card. Geometry, not snapshots, so
 * it holds for any locale and any day.
 */

const STORAGE_KEY = 'wall-dashboard:settings:v1'

const settings = (locale: string): object => ({
  version: 2,
  locale,
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
})

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1200 },
  { width: 1366, height: 768 },
  { width: 844, height: 390 }
]

// Long weekday + long saint ("Our Lady of Ransom"); 21 July adds a holiday.
const DAYS = ['2026-09-24T18:20:00', '2026-07-21T15:00:00']

for (const locale of ['de', 'ru']) {
  for (const now of DAYS) {
    for (const vp of VIEWPORTS) {
      test(`${locale} ${now.slice(0, 10)} ${vp.width}x${vp.height}: hero and weather card fit`, async ({
        page
      }) => {
        await page.setViewportSize(vp)
        await page.addInitScript(
          ([key, value]) => localStorage.setItem(key, value),
          [STORAGE_KEY, JSON.stringify(settings(locale))]
        )
        await page.goto(`/?now=${now}&weather=rain`)
        await page.locator('.start-overlay').click()
        await expect(page.locator('.meta li').first()).toBeVisible()

        const g = await page.evaluate(async () => {
          await document.fonts.ready
          await new Promise((r) => requestAnimationFrame(() => r(null)))
          const bottom = (sel: string): number =>
            [...document.querySelectorAll(sel)].reduce(
              (m, el) => Math.max(m, el.getBoundingClientRect().bottom),
              0
            )
          const cap = document.querySelector('.cap') as HTMLElement
          return {
            heroBottom: bottom('.hero *'),
            tlTop: document.querySelector('.tl')!.getBoundingClientRect().top,
            capOverflow: cap.scrollHeight - cap.clientHeight,
            tmBottom: bottom('.tm *'),
            viewport: innerHeight
          }
        })
        expect(g.heroBottom).toBeLessThanOrEqual(g.tlTop)
        expect(g.capOverflow).toBeLessThanOrEqual(1)
        expect(g.tmBottom).toBeLessThanOrEqual(g.viewport)
      })
    }
  }
}

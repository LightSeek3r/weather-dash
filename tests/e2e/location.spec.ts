import { test, expect, type Page } from '@playwright/test'

/**
 * Location picker end to end: search-as-you-type against a mocked Open-Meteo
 * geocoder, keyboard picking, and "Use my location" against a mocked
 * browser position + Nominatim reverse lookup.
 */

const GEOCODE = {
  results: [
    {
      latitude: 50.85,
      longitude: 4.35,
      name: 'Brussels',
      country: 'Belgium',
      country_code: 'BE',
      admin1: 'Brussels Capital',
      timezone: 'Europe/Brussels'
    },
    {
      latitude: 41.19,
      longitude: -85.07,
      name: 'Brussels',
      country: 'United States',
      country_code: 'US',
      admin1: 'Illinois',
      timezone: 'America/Chicago'
    }
  ]
}

async function openSheet(page: Page, geocode: object = GEOCODE) {
  await page.route('https://geocoding-api.open-meteo.com/**', (route) =>
    route.fulfill({ json: geocode })
  )
  await page.route('https://api.open-meteo.com/**', (route) => route.abort())
  await page.route('https://air-quality-api.open-meteo.com/**', (route) =>
    route.abort()
  )
  await page.goto('/')
  await page.locator('.start-overlay__dismiss').click()
  await expect(page.locator('.sheet')).toBeVisible()
}

const search = (page: Page) =>
  page.getByRole('combobox', { name: 'Search for a city' })
const options = (page: Page) =>
  page.locator('#location-results').getByRole('option')
const current = (page: Page) => page.locator('.location-picked')

test('typing proposes places without pressing Search', async ({ page }) => {
  await openSheet(page)
  await search(page).pressSequentially('brus')

  const list = options(page)
  await expect(list).toHaveCount(2)
  await expect(list.first()).toContainText('Brussels, Belgium')
  await expect(list.nth(1)).toContainText('Illinois')
})

test('arrow keys + Enter pick a result and update the current location', async ({
  page
}) => {
  await openSheet(page)
  await search(page).fill('brus')
  await expect(options(page)).toHaveCount(2)

  await search(page).press('ArrowDown')
  await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true')
  await search(page).press('Enter')

  await expect(options(page)).toHaveCount(0)
  await expect(current(page)).toContainText(
    'Location set to Brussels, United States'
  )
  await expect(search(page)).toHaveValue('')
})

test('Escape closes the list but not the sheet', async ({ page }) => {
  await openSheet(page)
  await search(page).fill('brus')
  await expect(options(page)).toHaveCount(2)
  await search(page).press('Escape')
  await expect(options(page)).toHaveCount(0)
  await expect(page.locator('.sheet')).toBeVisible()
})

test('a query with no matches says so', async ({ page }) => {
  await openSheet(page, {})
  await search(page).fill('zzzz')
  await expect(page.getByText('No places found')).toBeVisible()
})

test('Use my location shows progress, then the named place', async ({
  page,
  context
}) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 48.8566, longitude: 2.3522 })
  let releaseReverse: () => void = () => {}
  const reverseGate = new Promise<void>((r) => (releaseReverse = r))
  await page.route('https://nominatim.openstreetmap.org/**', async (route) => {
    await reverseGate
    await route.fulfill({
      json: {
        address: { city: 'Paris', country: 'France', country_code: 'fr' }
      }
    })
  })
  await openSheet(page)

  await page.getByRole('button', { name: 'Use my location' }).click()
  await expect(current(page)).toContainText('Location set to Current location')
  releaseReverse()
  await expect(current(page)).toContainText('Location set to Paris, France')
})

test('a denial is cleared once a city is picked', async ({ page, context }) => {
  await context.clearPermissions()
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) =>
      fail?.({
        code: 1,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
        message: 'denied'
      } as GeolocationPositionError)
  })
  await openSheet(page)

  await page.getByRole('button', { name: 'Use my location' }).click()
  await expect(page.getByRole('alert')).toHaveText('Location access was denied')

  await search(page).fill('brus')
  await options(page).first().click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(current(page)).toContainText('Brussels, Belgium')
})

test('a late GPS answer never overwrites a city picked meanwhile', async ({
  page
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { resolveGps?: () => void }
    navigator.geolocation.getCurrentPosition = (ok) => {
      w.resolveGps = () =>
        ok({
          coords: { latitude: 48.85, longitude: 2.35 },
          timestamp: Date.now()
        } as GeolocationPosition)
    }
  })
  await openSheet(page)

  const gps = page.locator('.location-gps', {
    hasText: /Use my location|Locating/
  })
  await gps.click()
  await expect(gps).toHaveText('Locating…')
  await expect(gps).toBeDisabled()

  await search(page).fill('brus')
  await options(page).first().click()
  await expect(gps).toHaveText('Use my location')

  await page.evaluate(() =>
    (window as unknown as { resolveGps: () => void }).resolveGps()
  )
  await page.waitForTimeout(200)
  await expect(current(page)).toContainText('Brussels, Belgium')
})

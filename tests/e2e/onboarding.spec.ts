import { test, expect } from '@playwright/test'

/**
 * Live-usage fixes #2/#3/#4: standalone (home-screen installed) launches
 * skip the tap-to-start gesture entirely (there's no browser chrome to
 * request fullscreen for, and no user gesture to do it with this early),
 * and a first run with no location set auto-opens Settings with the
 * location field highlighted instead of silently showing
 * "Set a location to see the weather" until someone finds the gear.
 */

async function mockStandalone(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const originalMatchMedia = window.matchMedia.bind(window)
    window.matchMedia = (query: string) => {
      if (query === '(display-mode: standalone)') {
        return { matches: true, media: query } as MediaQueryList
      }
      return originalMatchMedia(query)
    }
  })
}

test('standalone launch skips the tap-to-start overlay', async ({ page }) => {
  await mockStandalone(page)
  await page.goto('/')

  await expect(page.locator('.start-overlay')).toHaveCount(0)
})

test('standalone launch with no location auto-opens settings on the location field', async ({
  page
}) => {
  await mockStandalone(page)
  await page.goto('/')

  const sheet = page.locator('.sheet')
  await expect(sheet).toBeVisible()
  await expect(page.locator('.location-section.attention')).toBeVisible()
})

test('non-standalone: tapping start with no location auto-opens settings', async ({
  page
}) => {
  await page.goto('/')

  await expect(page.locator('.sheet')).toHaveCount(0)
  await page.locator('.start-overlay').click()

  await expect(page.locator('.sheet')).toBeVisible()
  await expect(page.locator('.location-section.attention')).toBeVisible()
})

test('the tap-to-start overlay states what it does and how to keep it', async ({
  page
}) => {
  await page.goto('/')
  const overlay = page.locator('.start-overlay')
  await expect(overlay).toContainText(/full ?screen/i)
  await expect(overlay).toContainText(/home screen/i)
})

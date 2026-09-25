import { test, expect } from '@playwright/test'

test('loads root and has title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/^Weather Dash/)
})

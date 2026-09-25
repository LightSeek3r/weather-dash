import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry'
  },
  // Font antialiasing/subpixel rounding differs even in a controlled
  // environment (plan premortem P8) — a small tolerance avoids false
  // positives without hiding a genuinely broken layout. Timeout bumped from
  // the 5s default: the visual project runs up to `workers` chromium
  // instances rendering a 3840x2160 page concurrently, which is slow enough
  // under CPU contention to occasionally starve the default window (seen
  // once while developing this suite — a bare rerun with no code change
  // passed clean, consistent with contention rather than a real bug).
  expect: {
    timeout: 10000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 }
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    // Separate project (plan architecture sketch keeps visual-snapshot
    // tests in their own tests/visual/ dir) — its own testDir, chromium
    // only (baseline generation/comparison across 3 engines would triple
    // the matrix for no real benefit; chromium is the one available in the
    // official Playwright Docker image referenced by plan premortem P8).
    {
      name: 'visual',
      testDir: './tests/visual',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
})

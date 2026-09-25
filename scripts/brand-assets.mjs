// Regenerates public/ brand assets from public/favicon.svg plus live
// dashboard screenshots. Needs `npm run dev` running on :5173.
//   node scripts/brand-assets.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const BASE = 'http://localhost:5173'
const logo = readFileSync('public/favicon.svg', 'utf8')

// Maskable/apple variants must be full-bleed: the OS applies its own shape
// mask, and maskable content has to sit inside the central 80% safe zone.
const fullBleed = logo
  .replace(' rx="116"', '')
  .replace(
    /(<rect width="512" height="512" fill="url\(#bg\)"\/>)([\s\S]*)(<\/svg>)/,
    '$1<g transform="translate(256 256) scale(0.8) translate(-256 -256)">$2</g>$3'
  )

const ICONS = [
  { file: 'icon-192.png', size: 192, svg: logo },
  { file: 'icon-512.png', size: 512, svg: logo },
  { file: 'icon-maskable-512.png', size: 512, svg: fullBleed },
  { file: 'apple-touch-icon.png', size: 180, svg: fullBleed }
]

const SETTINGS = {
  version: 2,
  locale: 'en',
  location: { lat: 48.85, lon: 2.35, name: 'Paris' }
}

const SHOTS = [
  { file: 'og-image.png', width: 1920, height: 1008, scale: 0.625 },
  { file: 'screenshot-wide.png', width: 1920, height: 1080, scale: 1 },
  { file: 'screenshot-narrow.png', width: 390, height: 844, scale: 2 }
]

const browser = await chromium.launch()

for (const icon of ICONS) {
  const page = await browser.newPage({
    viewport: { width: icon.size, height: icon.size }
  })
  await page.setContent(
    `<style>*{margin:0}svg{display:block;width:100vw;height:100vh}</style>${icon.svg}`
  )
  await page.screenshot({ path: `public/${icon.file}`, omitBackground: true })
  await page.close()
}

for (const shot of SHOTS) {
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: shot.scale
  })
  await page.addInitScript(
    (s) =>
      localStorage.setItem('wall-dashboard:settings:v1', JSON.stringify(s)),
    SETTINGS
  )
  await page.goto(`${BASE}/?freeze=1&now=2026-06-15T15:00:00&weather=clear-day`)
  await page.locator('.start-overlay').click()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `public/${shot.file}` })
  await page.close()
}

await browser.close()

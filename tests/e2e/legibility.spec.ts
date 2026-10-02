import { test, expect } from '@playwright/test'

/**
 * Text contrast against the pixels actually behind it, not the sky token: at
 * 15:00 on a clear day the sun sits behind the weather card, and its glare
 * through the glass once took labels down to ~1.2:1 while the token check in
 * tests/visual still passed. Each text run is measured against the brightest
 * 10% of the pixels under it, with the text itself hidden.
 */

const STORAGE_KEY = 'wall-dashboard:settings:v1'

const SETTINGS = {
  version: 2,
  locale: 'en',
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
  fxQuality: 'high'
}

interface Run {
  text: string
  color: string
  large: boolean
  x: number
  y: number
  w: number
  h: number
}

const CASES = [
  { weather: 'clear-day', width: 1920, height: 1080 },
  { weather: 'clear-day', width: 1440, height: 900 },
  { weather: 'clear-day', width: 1180, height: 820 },
  { weather: 'clear-day', width: 820, height: 1180 },
  { weather: 'fog', width: 1440, height: 900 }
]

for (const c of CASES) {
  test(`${c.weather} ${c.width}x${c.height}: weather card text is legible over the sky behind it`, async ({
    page
  }) => {
    await page.setViewportSize({ width: c.width, height: c.height })
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [STORAGE_KEY, JSON.stringify(SETTINGS)]
    )
    await page.goto(`/?now=2026-01-15T15:00:00&weather=${c.weather}`)
    await page.locator('.start-overlay').click()
    await expect(page.locator('.cap .temp')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)

    // HTML text only: SVG <text> paints with `fill`, which the hiding rule
    // below can't reach, so it would be sampled as its own background.
    const runs: Run[] = await page.evaluate(() => {
      const out: Run[] = []
      for (const el of document.querySelectorAll('.cap *')) {
        if (el instanceof SVGElement || el.closest('.sr-only')) continue
        const own = [...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
        )
        if (!own) continue
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) continue
        const cs = getComputedStyle(el)
        const size = parseFloat(cs.fontSize)
        out.push({
          text: el.textContent!.trim().slice(0, 30),
          color: cs.color,
          large: size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700),
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height
        })
      }
      return out
    })
    expect(runs.length).toBeGreaterThan(5)

    await page.addStyleTag({
      content:
        '.cap, .cap * { color: transparent !important; -webkit-text-fill-color: transparent !important; }'
    })
    await page.waitForTimeout(100)
    const png = (await page.screenshot()).toString('base64')

    const results = await page.evaluate(
      async ({ png, runs }) => {
        const img = new Image()
        img.src = 'data:image/png;base64,' + png
        await img.decode()
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const g = canvas.getContext('2d')!
        g.drawImage(img, 0, 0)
        const lin = (v: number): number => {
          v /= 255
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        }
        const lum = (r: number, gr: number, b: number): number =>
          0.2126 * lin(r) + 0.7152 * lin(gr) + 0.0722 * lin(b)
        const k = img.width / innerWidth
        return runs.map((run) => {
          const d = g.getImageData(
            Math.round(run.x * k),
            Math.round(run.y * k),
            Math.max(1, Math.round(run.w * k)),
            Math.max(1, Math.round(run.h * k))
          ).data
          const ls: number[] = []
          for (let i = 0; i < d.length; i += 4)
            ls.push(lum(d[i], d[i + 1], d[i + 2]))
          ls.sort((a, b) => a - b)
          const bg = ls[Math.floor(ls.length * 0.9)]
          const [r, gr, b] = run.color.match(/[\d.]+/g)!.map(Number)
          const fg = lum(r, gr, b)
          const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
          return { text: run.text, ratio, need: run.large ? 3 : 4.5 }
        })
      },
      { png, runs }
    )

    const failing = results
      .filter((r) => r.ratio < r.need)
      .map((r) => `"${r.text}" ${r.ratio.toFixed(2)} < ${r.need}`)
    expect(failing).toEqual([])
  })
}

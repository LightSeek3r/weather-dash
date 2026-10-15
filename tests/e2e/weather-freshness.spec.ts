import { test, expect, type Page } from '@playwright/test'

/**
 * The sky and the hourly strip follow the clock, not the age of the last
 * fetch. Time is faked (Playwright's clock) and Open-Meteo is answered with
 * a forecast generated from that fake time, so "winter evening, sun gone"
 * and "morning, strip starts hours ago" can be reproduced exactly.
 */

test.use({ timezoneId: 'Europe/Brussels' })

const STORAGE_KEY = 'wall-dashboard:settings:v1'
const SETTINGS = {
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
  // night mode off the table: the test hours would otherwise dim the page
  nightMode: { start: '00:00', end: '00:00' },
  fullscreenScene: { intervalSeconds: 0, durationSeconds: 0 },
  fullscreenOnStart: false,
  photos: {
    rotationDuration: '10m',
    dimOpacity: 0.55,
    blurPx: 0,
    shuffle: false
  },
  reducedMotion: 'on',
  fxQuality: 'off'
}

const pad = (n: number) => String(n).padStart(2, '0')

/** A Brussels January forecast around `nowMs`: sun up from 08:00 to 17:59. */
function forecastAt(nowMs: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(nowMs))
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value)
  const [y, m, d, hh, mm] = [
    part('year'),
    part('month'),
    part('day'),
    part('hour'),
    part('minute')
  ]
  const isDay = (h: number) => h >= 8 && h < 18

  const hours: string[] = []
  const days: string[] = []
  for (let day = 0; day < 16; day++) {
    const date = new Date(Date.UTC(y, m - 1, d + day))
      .toISOString()
      .slice(0, 10)
    days.push(date)
    for (let h = 0; h < 24; h++) hours.push(`${date}T${pad(h)}:00`)
  }
  const hourOf = (t: string) => Number(t.slice(11, 13))
  const today = days[0]

  return JSON.stringify({
    latitude: 50.85,
    longitude: 4.35,
    utc_offset_seconds: 3600,
    timezone: 'Europe/Brussels',
    timezone_abbreviation: 'CET',
    current: {
      time: `${today}T${pad(hh)}:${pad(Math.floor(mm / 15) * 15)}`,
      interval: 900,
      temperature_2m: 3,
      apparent_temperature: 1,
      relative_humidity_2m: 80,
      uv_index: isDay(hh) ? 1 : 0,
      is_day: isDay(hh) ? 1 : 0,
      weather_code: isDay(hh) ? 0 : 3,
      wind_speed_10m: 10,
      wind_gusts_10m: 20,
      wind_direction_10m: 200,
      precipitation: 0,
      precipitation_probability: 0
    },
    hourly: {
      time: hours,
      temperature_2m: hours.map(() => 3),
      weather_code: hours.map((t) => (isDay(hourOf(t)) ? 0 : 3)),
      is_day: hours.map((t) => (isDay(hourOf(t)) ? 1 : 0)),
      precipitation_probability: hours.map(() => 0),
      precipitation: hours.map(() => 0),
      wind_speed_10m: hours.map(() => 10)
    },
    daily: {
      time: days,
      weather_code: days.map(() => 0),
      temperature_2m_max: days.map(() => 5),
      temperature_2m_min: days.map(() => 1),
      precipitation_probability_max: days.map(() => 0),
      wind_speed_10m_max: days.map(() => 12),
      sunrise: days.map((dd) => `${dd}T08:20`),
      sunset: days.map((dd) => `${dd}T17:50`)
    }
  })
}

async function open(page: Page, atUtc: string) {
  const state = { online: true, requests: 0 }
  await page.clock.install({ time: new Date(atUtc) })
  await page.route('https://api.open-meteo.com/**', async (route) => {
    state.requests += 1
    if (!state.online) return route.abort()
    const now = await page.evaluate(() => Date.now())
    return route.fulfill({
      contentType: 'application/json',
      body: forecastAt(now)
    })
  })
  await page.route('https://air-quality-api.open-meteo.com/**', (route) =>
    route.abort()
  )
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: SETTINGS }
  )
  await page.goto('/')
  return state
}

/**
 * The device sleeps through  (timers do not tick meanwhile), then wakes:
 * the clock jumps, due timers fire once, and the app gets a few live seconds.
 * Stepping hours tick by tick would be slow and is not what a wall display
 * or a phone does overnight.
 */
async function sleepThrough(page: Page, duration: string) {
  await page.clock.fastForward(duration)
  await page.clock.runFor('00:00:03')
}

const firstHour = (page: Page) => page.locator('.hours span.n').first()
const sunny = (page: Page) => page.locator('html[data-sky="sunny"]')

test('the hourly refresh moves the strip and drops the sunny sky at nightfall', async ({
  page
}) => {
  await open(page, '2026-01-15T16:10:00Z') // 17:10 in Brussels, sun still up
  await expect(sunny(page)).toHaveCount(1)
  await expect(firstHour(page)).toHaveText(/^17/)

  await sleepThrough(page, '01:00:00') // 18:10: the 18:00 tick refetched

  await expect(firstHour(page)).toHaveText(/^18/)
  await expect(sunny(page)).toHaveCount(0)
})

test('a failed refresh does not leave the evening on the afternoon sky', async ({
  page
}) => {
  const net = await open(page, '2026-01-15T16:10:00Z') // 17:10
  await expect(sunny(page)).toHaveCount(1)

  net.online = false // the network is gone, as right after a device wakes
  await sleepThrough(page, '03:05:00') // 20:15 with every refresh failing

  await expect(firstHour(page)).toHaveText(/^20/)
  await expect(sunny(page)).toHaveCount(0)
})

test('the strip at 08:37 starts at 08, even if nothing has been fetched since 04:10', async ({
  page
}) => {
  const net = await open(page, '2026-01-15T03:10:00Z') // 04:10
  await expect(firstHour(page)).toHaveText(/^04/)

  net.online = false
  await sleepThrough(page, '04:27:00') // 08:37

  await expect(firstHour(page)).toHaveText(/^08/)
})

test('after a failed hourly attempt, the next minutes retry instead of waiting for the next hour', async ({
  page
}) => {
  const net = await open(page, '2026-01-15T09:50:00Z') // 10:50
  await expect(firstHour(page)).toHaveText(/^10/)

  net.online = false
  await sleepThrough(page, '00:15:00') // 11:05: the 11:00 attempt failed offline
  const afterFailure = net.requests

  net.online = true
  await page.clock.runFor('00:03:00') // 11:08, same hour: a retry is due

  expect(net.requests).toBeGreaterThan(afterFailure)
  await expect(firstHour(page)).toHaveText(/^11/)
})

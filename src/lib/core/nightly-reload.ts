/**
 * Full page reload once a night (plan premortem P3: a 24/7 tab slowly
 * accumulates heap/GPU state no single leak fix fully clears; also the point a
 * waiting service-worker version takes over an always-open tab nobody
 * tapped the update invitation on: callers pass `applyAppUpdate`).
 *
 * Fires on the first `'minute'` tick at or after `atTime`, at most once per
 * local day, and only if:
 * - this page was already running before today's slot — otherwise a boot
 *   at 09:00 would reload immediately, and the fresh page this very reload
 *   produces (booted at ~03:30:01) would reload itself again;
 * - the tick lands within `CATCH_UP_MINUTES` of the slot. Ticks pause while
 *   the tab is hidden and a sleeping device skips them, so the exact 03:30
 *   tick can be missed; a late tick still catches up, but reloading hours
 *   later in front of whoever just woke the screen is worse than skipping
 *   one night.
 */
import { scheduler } from './scheduler'
import { parseTimeOfDay } from './night-mode'

const CATCH_UP_MINUTES = 60
const MINUTE_MS = 60_000

/**
 * sessionStorage survives `location.reload()` in the same tab, so the next
 * boot can tell "the kiosk reloaded itself" from "a person opened the app".
 */
export const NIGHTLY_RELOAD_MARKER_KEY = 'wall-dashboard:nightly-reload'
const MARKER_MAX_AGE_MS = 5 * MINUTE_MS

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function writeMarker(now: Date): void {
  try {
    sessionStorage.setItem(NIGHTLY_RELOAD_MARKER_KEY, String(now.getTime()))
  } catch {
    // Storage unavailable (private mode, quota) — the reload itself still
    // matters more than the marker, so carry on without it.
  }
}

/**
 * `true` once if this page load was produced by `scheduleNightlyReload` in
 * the last few minutes; clears the marker either way. Lets the app skip its
 * "tap to start" overlay and re-request the wake lock unattended — without
 * this, every nightly reload leaves the kiosk sitting behind that overlay
 * with no wake lock until someone taps it.
 */
export function consumeNightlyReloadMarker(now: Date = new Date()): boolean {
  try {
    const raw = sessionStorage.getItem(NIGHTLY_RELOAD_MARKER_KEY)
    sessionStorage.removeItem(NIGHTLY_RELOAD_MARKER_KEY)
    if (raw === null) return false
    const age = now.getTime() - Number(raw)
    return Number.isFinite(age) && age >= 0 && age < MARKER_MAX_AGE_MS
  } catch {
    return false
  }
}

/**
 * @param atTime local `"HH:MM"` (24h). Malformed -> never fires (warns once).
 * @param reload injectable so tests can assert the trigger without reloading.
 * @returns cleanup that stops the schedule.
 */
export function scheduleNightlyReload(
  atTime: string,
  reload: () => void = () => location.reload()
): () => void {
  const slotMinutes = parseTimeOfDay(atTime)
  if (slotMinutes === null) {
    console.warn(`[nightly-reload] invalid time "${atTime}", not scheduling`)
    return () => {}
  }

  const startedAt = new Date()
  let lastFiredKey = ''

  const unsubscribe = scheduler.on('minute', (now) => {
    const key = localDateKey(now)
    if (key === lastFiredKey) return

    // Built from local components each time (not "last slot + 24h") so DST
    // days, whose length is 23h/25h, still land on the wall-clock slot.
    const slot = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      Math.floor(slotMinutes / 60),
      slotMinutes % 60
    )
    const lateBy = now.getTime() - slot.getTime()
    if (lateBy < 0 || lateBy >= CATCH_UP_MINUTES * MINUTE_MS) return
    if (startedAt.getTime() >= slot.getTime()) return

    lastFiredKey = key
    writeMarker(now)
    reload()
  })

  return unsubscribe
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scheduler } from '../../../src/lib/core/scheduler'
import {
  scheduleNightlyReload,
  consumeNightlyReloadMarker,
  NIGHTLY_RELOAD_MARKER_KEY
} from '../../../src/lib/core/nightly-reload'

const MINUTE_MS = 60_000

/** Captures the minute listener so tests can feed arbitrary timestamps (incl. duplicates) without waiting hours of fake ticks. */
function captureMinuteListener(): { tick: (d: Date) => void } {
  const spy = vi.spyOn(scheduler, 'on')
  let listener: ((d: Date) => void) | undefined
  spy.mockImplementation((kind, fn) => {
    if (kind === 'minute') listener = fn
    return () => {
      listener = undefined
      return true
    }
  })
  return { tick: (d) => listener?.(d) }
}

describe('scheduleNightlyReload', () => {
  let stop: (() => void) | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
  })

  afterEach(() => {
    stop?.()
    stop = undefined
    scheduler.stop()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('fires exactly once at the target time via the real scheduler', async () => {
    vi.setSystemTime(new Date(2026, 8, 25, 3, 27, 30))
    const reload = vi.fn()
    stop = scheduleNightlyReload('03:30', reload)
    scheduler.start()

    await vi.advanceTimersByTimeAsync(2 * MINUTE_MS) // -> 03:29:30
    expect(reload).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(MINUTE_MS) // -> 03:30:30
    expect(reload).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(90 * MINUTE_MS)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not fire at other times of day', () => {
    vi.setSystemTime(new Date(2026, 8, 24, 12, 0))
    const { tick } = captureMinuteListener()
    const reload = vi.fn()
    stop = scheduleNightlyReload('03:30', reload)

    for (const [h, m] of [
      [12, 1],
      [23, 59],
      [0, 0],
      [3, 29],
      [4, 30],
      [9, 0]
    ]) {
      tick(new Date(2026, 8, 25, h, m))
    }
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not double-fire if the target minute is ticked twice', () => {
    vi.setSystemTime(new Date(2026, 8, 24, 12, 0))
    const { tick } = captureMinuteListener()
    const reload = vi.fn()
    stop = scheduleNightlyReload('03:30', reload)

    tick(new Date(2026, 8, 25, 3, 30, 0))
    tick(new Date(2026, 8, 25, 3, 30, 1))
    tick(new Date(2026, 8, 25, 3, 31))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('fires again the next night', () => {
    vi.setSystemTime(new Date(2026, 8, 24, 12, 0))
    const { tick } = captureMinuteListener()
    const reload = vi.fn()
    stop = scheduleNightlyReload('03:30', reload)

    tick(new Date(2026, 8, 25, 3, 30))
    tick(new Date(2026, 8, 26, 3, 30))
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('catches up a slightly late tick but skips one hours late', () => {
    vi.setSystemTime(new Date(2026, 8, 24, 12, 0))
    const { tick } = captureMinuteListener()
    const reload = vi.fn()
    stop = scheduleNightlyReload('03:30', reload)

    tick(new Date(2026, 8, 25, 10, 0)) // tab was hidden all night
    expect(reload).not.toHaveBeenCalled()
    tick(new Date(2026, 8, 26, 3, 34)) // exact tick missed by a few minutes
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload a page that booted after today’s slot (incl. the reloaded page itself)', () => {
    vi.setSystemTime(new Date(2026, 8, 25, 3, 30, 2))
    const { tick } = captureMinuteListener()
    const reload = vi.fn()
    stop = scheduleNightlyReload('03:30', reload)

    tick(new Date(2026, 8, 25, 3, 31))
    expect(reload).not.toHaveBeenCalled()
    tick(new Date(2026, 8, 26, 3, 30))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('cleanup stops it', async () => {
    vi.setSystemTime(new Date(2026, 8, 25, 3, 28, 30))
    const reload = vi.fn()
    const cleanup = scheduleNightlyReload('03:30', reload)
    scheduler.start()
    cleanup()

    await vi.advanceTimersByTimeAsync(5 * MINUTE_MS)
    expect(reload).not.toHaveBeenCalled()
  })

  it('malformed time never fires and never throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.setSystemTime(new Date(2026, 8, 25, 3, 28, 30))
    const reload = vi.fn()
    stop = scheduleNightlyReload('3h30', reload)
    scheduler.start()

    await vi.advanceTimersByTimeAsync(5 * MINUTE_MS)
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('consumeNightlyReloadMarker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('is true once after a scheduled reload, then false', () => {
    vi.setSystemTime(new Date(2026, 8, 24, 12, 0))
    const { tick } = captureMinuteListener()
    const stop = scheduleNightlyReload('03:30', () => {})
    tick(new Date(2026, 8, 25, 3, 30))
    stop()

    const bootedAt = new Date(2026, 8, 25, 3, 30, 3)
    expect(consumeNightlyReloadMarker(bootedAt)).toBe(true)
    expect(consumeNightlyReloadMarker(bootedAt)).toBe(false)
  })

  it('is false with no marker or a stale one', () => {
    expect(consumeNightlyReloadMarker()).toBe(false)
    const now = new Date(2026, 8, 25, 12, 0)
    sessionStorage.setItem(
      NIGHTLY_RELOAD_MARKER_KEY,
      String(now.getTime() - 60 * MINUTE_MS)
    )
    expect(consumeNightlyReloadMarker(now)).toBe(false)
    sessionStorage.setItem(NIGHTLY_RELOAD_MARKER_KEY, 'garbage')
    expect(consumeNightlyReloadMarker(now)).toBe(false)
  })
})

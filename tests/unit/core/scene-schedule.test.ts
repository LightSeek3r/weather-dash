import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { get } from 'svelte/store'
import { scheduler } from '../../../src/lib/core/scheduler'
import {
  createSceneSchedule,
  type SceneSchedule
} from '../../../src/lib/core/scene-schedule'

const MINUTE_MS = 60_000
const DAY_NIGHT = { start: '22:00', end: '07:00' }

describe('createSceneSchedule', () => {
  let schedule: SceneSchedule | undefined

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    schedule?.destroy()
    schedule = undefined
    scheduler.stop()
    vi.useRealTimers()
  })

  function start(
    at: Date,
    intervalSeconds = 1800,
    durationSeconds = 20,
    nightMode = DAY_NIGHT
  ): SceneSchedule {
    vi.setSystemTime(at)
    schedule = createSceneSchedule({
      intervalSeconds,
      durationSeconds,
      nightMode
    })
    scheduler.start()
    return schedule
  }

  it('stays inactive until the interval has elapsed, then activates', async () => {
    const s = start(new Date(2026, 8, 25, 10, 0, 0))
    await vi.advanceTimersByTimeAsync(29 * MINUTE_MS)
    expect(get(s.active)).toBe(false)

    await vi.advanceTimersByTimeAsync(MINUTE_MS)
    expect(get(s.active)).toBe(true)
  })

  it('auto-hides after durationSeconds', async () => {
    const s = start(new Date(2026, 8, 25, 10, 0, 0))
    await vi.advanceTimersByTimeAsync(30 * MINUTE_MS) // fires at 10:30:00
    expect(get(s.active)).toBe(true)

    await vi.advanceTimersByTimeAsync(19_000)
    expect(get(s.active)).toBe(true)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(get(s.active)).toBe(false)
  })

  it('repeats every interval', async () => {
    const s = start(new Date(2026, 8, 25, 10, 0, 0))
    const activations: boolean[] = []
    const unsubscribe = s.active.subscribe((a) => a && activations.push(a))

    await vi.advanceTimersByTimeAsync(3 * 30 * MINUTE_MS)
    expect(activations).toHaveLength(3)
    unsubscribe()
  })

  it('rounds intervalSeconds to whole minutes (min 1)', async () => {
    const s = start(new Date(2026, 8, 25, 10, 0, 0), 10, 5)
    await vi.advanceTimersByTimeAsync(MINUTE_MS)
    expect(get(s.active)).toBe(true)
  })

  it('dismiss() hides early and the next scene still comes one interval later', async () => {
    const s = start(new Date(2026, 8, 25, 10, 0, 0))
    await vi.advanceTimersByTimeAsync(30 * MINUTE_MS)
    expect(get(s.active)).toBe(true)

    s.dismiss()
    expect(get(s.active)).toBe(false)

    await vi.advanceTimersByTimeAsync(29 * MINUTE_MS)
    expect(get(s.active)).toBe(false)
    await vi.advanceTimersByTimeAsync(MINUTE_MS)
    expect(get(s.active)).toBe(true)
  })

  it('is skipped entirely while night mode is active', async () => {
    const s = start(new Date(2026, 8, 25, 22, 0, 30))
    const activations: boolean[] = []
    const unsubscribe = s.active.subscribe((a) => a && activations.push(a))

    // Slots 22:30 .. 06:00 are all night: none shown.
    for (let h = 0; h < 8; h++) {
      await vi.advanceTimersByTimeAsync(60 * MINUTE_MS)
    }
    expect(activations).toHaveLength(0)

    // Slots at 06:30 (night, skipped) and 07:00 (day) — only the latter shows.
    await vi.advanceTimersByTimeAsync(60 * MINUTE_MS)
    expect(activations).toHaveLength(1)
    unsubscribe()
  }, 30_000)

  it('hides a running scene if night starts mid-scene', async () => {
    // 5-minute scene starting 21:58 -> night begins 22:00.
    const s = start(new Date(2026, 8, 25, 21, 57, 30), 60, 300)
    await vi.advanceTimersByTimeAsync(MINUTE_MS) // 21:58:00 fires
    expect(get(s.active)).toBe(true)

    await vi.advanceTimersByTimeAsync(2 * MINUTE_MS) // 22:00:00
    expect(get(s.active)).toBe(false)
  })

  it('interval or duration <= 0 disables scenes', async () => {
    for (const [interval, duration] of [
      [0, 20],
      [1800, 0],
      [-5, 20],
      [Number.NaN, 20]
    ]) {
      const s = start(new Date(2026, 8, 25, 10, 0, 0), interval, duration)
      await vi.advanceTimersByTimeAsync(120 * MINUTE_MS)
      expect(get(s.active)).toBe(false)
      s.destroy()
      scheduler.stop()
    }
  })

  it('destroy() hides and stops scheduling', async () => {
    const s = start(new Date(2026, 8, 25, 10, 0, 0))
    await vi.advanceTimersByTimeAsync(30 * MINUTE_MS)
    expect(get(s.active)).toBe(true)

    s.destroy()
    expect(get(s.active)).toBe(false)
    await vi.advanceTimersByTimeAsync(120 * MINUTE_MS)
    expect(get(s.active)).toBe(false)
  })
})

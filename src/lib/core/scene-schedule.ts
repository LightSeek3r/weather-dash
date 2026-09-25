/**
 * Periodic fullscreen scene (plan decision: every 30 min for 20 s,
 * configurable, tap to dismiss, skipped in night mode) — the big, rare
 * counterpart to pixel-shift for burn-in (plan premortem P5).
 *
 * Interval: counted in `'minute'` ticks, same elapsed-tracking pattern as
 * `photos/rotation.ts`. `intervalSeconds` is rounded to whole minutes (min
 * 1) — the setting is minutes-scale in practice and a sub-minute scene
 * cadence would defeat the point of a dashboard. Counting ticks rather than
 * wall-clock means time the tab spends hidden (ticks paused) doesn't count
 * toward the next scene, which is what we want: no burn-in while hidden.
 *
 * Duration: `'second'` ticks, subscribed only while a scene is showing, so
 * an idle schedule costs one listener on the minute tick. Hide time is
 * compared against the tick's wall-clock `now`, not a tick count, so a tab
 * that was hidden mid-scene hides it immediately on return instead of
 * resuming a stale countdown.
 *
 * `intervalSeconds <= 0` or `durationSeconds <= 0` disables scenes.
 */
import { writable, type Readable } from 'svelte/store'
import { scheduler } from './scheduler'
import { isNightMode } from './night-mode'
import type { Settings } from './storage/settings'

export interface SceneScheduleOptions {
  intervalSeconds: number
  durationSeconds: number
  nightMode: Settings['nightMode']
}

export interface SceneSchedule {
  active: Readable<boolean>
  /** Hide the current scene early (tap to dismiss). Next one still comes one full interval after this one started. */
  dismiss(): void
  destroy(): void
}

function positiveFinite(n: number): boolean {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

export function createSceneSchedule(
  options: SceneScheduleOptions
): SceneSchedule {
  const active = writable(false)
  let hideAt = 0
  let unsubscribeSecond: (() => void) | null = null
  let unsubscribeMinute: (() => void) | null = null

  function hide(): void {
    unsubscribeSecond?.()
    unsubscribeSecond = null
    active.set(false)
  }

  function show(now: Date): void {
    hideAt = now.getTime() + options.durationSeconds * 1000
    active.set(true)
    unsubscribeSecond = scheduler.on('second', (tickNow) => {
      if (tickNow.getTime() >= hideAt) hide()
    })
  }

  const enabled =
    positiveFinite(options.intervalSeconds) &&
    positiveFinite(options.durationSeconds)

  if (enabled) {
    const intervalMinutes = Math.max(
      1,
      Math.round(options.intervalSeconds / 60)
    )
    let elapsedMinutes = 0

    unsubscribeMinute = scheduler.on('minute', (now) => {
      const night = isNightMode(
        now,
        options.nightMode.start,
        options.nightMode.end
      )
      // Night began mid-scene: don't leave a bright full-screen animation
      // up for the rest of its duration.
      if (night && unsubscribeSecond) hide()

      elapsedMinutes += 1
      if (elapsedMinutes < intervalMinutes) return
      elapsedMinutes = 0
      // Skipped, not deferred: no burst of scenes the moment night ends.
      if (night || unsubscribeSecond) return
      show(now)
    })
  }

  return {
    active,
    dismiss: hide,
    destroy(): void {
      hide()
      unsubscribeMinute?.()
      unsubscribeMinute = null
    }
  }
}

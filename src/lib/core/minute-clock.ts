/**
 * "Now", refreshed on the scheduler's minute tick — the shared clock for
 * anything that derives what to show from the current time (sun position,
 * the present hour of the forecast). No timer of its own. Under `?freeze=1`
 * the scheduler never ticks, so this stays at the frozen `now`.
 */
import { readable, type Readable } from 'svelte/store'
import { scheduler } from './scheduler'
import { debugParams } from './debug-params'

export const minuteClock: Readable<Date> = readable(
  debugParams.now ?? new Date(),
  (set) => {
    set(debugParams.now ?? new Date())
    return scheduler.on('minute', set)
  }
)

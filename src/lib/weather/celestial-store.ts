/**
 * Where the sun/moon is right now, shared by the sky layer
 * (CelestialArc.svelte) and the FX layer (sun rays, moonlit stars) so both
 * agree on one position. Moves on the scheduler's minute tick — no timer of
 * its own — and reads only the sunrise/sunset the weather snapshot already
 * carries. Under `?freeze=1` the scheduler never ticks, so this stays at
 * the frozen `now`.
 */
import { derived, type Readable } from 'svelte/store'
import { minuteClock } from '../core/minute-clock'
import { weatherStore } from './store'
import {
  arcForLatitude,
  celestialPosition,
  locationNow,
  type CelestialPosition
} from './celestialPosition'

export const celestialStore: Readable<CelestialPosition | null> = derived(
  [minuteClock, weatherStore],
  ([$now, $weather]) => {
    const snap = $weather.snapshot
    return snap
      ? celestialPosition(
          locationNow($now, snap.location.timezone, snap.today.sunrise),
          snap.today,
          snap.tomorrow,
          arcForLatitude(snap.location.lat)
        )
      : null
  }
)

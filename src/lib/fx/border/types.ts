/**
 * Shared contract for every border effect module, so `BorderFx.svelte` can
 * drive any of them identically: construct, `mount` into the overlay host,
 * `unmount` on any category/tier change. An effect owns every DOM node,
 * context, listener and loop it creates, and `unmount()` must release all
 * of them — the host is left exactly as it was found.
 */
import type { FxTier } from '../tiers'
import type { ConditionKey, WeatherVisual } from '../../weather/mapWmo'
import type { CelestialPosition } from '../../weather/celestialPosition'

export type ActiveTier = Exclude<FxTier, 'off'>

export interface EffectOptions {
  tier: ActiveTier
  /** 0..1 — scales particle/drop counts (drizzle vs downpour, flurries vs heavy snow). */
  density: number
  /**
   * The precise condition behind the chosen `fx` category — lets a module
   * distinguish visually *within* one category (partly-cloudy vs overcast
   * in cloudy.ts, drizzle vs rain in rain-eco/rain-webgl.ts) without
   * `pickEffect()` needing a separate `EffectId` per pair. Absent in the
   * unit-test harness (`tests/unit/fx/border.test.ts` mounts with only
   * `tier`/`density`), so every reader must treat it as optional and fall
   * back to a sensible default.
   */
  conditionKey?: ConditionKey
  intensity?: WeatherVisual['intensity']
  /** Thunderstorm with hail (WMO 96/99) — adds hail pellets and the icy look. */
  hail?: boolean
  /** From the snapshot's `isDay`; tints clouds sunlit vs moonlit. Defaults to day. */
  isDay?: boolean
  /**
   * `?freeze=1`: render one deterministic frame (seeded random, fixed
   * clock) and start no loop — see FROZEN_SEED in common.ts.
   */
  frozen?: boolean
  /**
   * Where the sun/moon currently sits (normalized viewport coords, see
   * lib/weather/celestialPosition.ts). A getter rather than a value so the
   * minute-by-minute movement never forces a remount; read per frame.
   */
  celestial?: () => CelestialPosition | null
}

export interface BorderEffect {
  mount(host: HTMLElement, opts: EffectOptions): void
  unmount(): void
}

export type EffectFactory = () => BorderEffect

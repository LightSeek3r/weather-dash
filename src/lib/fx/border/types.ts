/**
 * Shared contract for every border effect module, so `BorderFx.svelte` can
 * drive any of them identically: construct, `mount` into the overlay host,
 * `unmount` on any category/tier change. An effect owns every DOM node,
 * context, listener and loop it creates, and `unmount()` must release all
 * of them — the host is left exactly as it was found.
 */
import type { FxTier } from '../tiers'
import type { ConditionKey, WeatherVisual } from '../../weather/mapWmo'

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
}

export interface BorderEffect {
  mount(host: HTMLElement, opts: EffectOptions): void
  unmount(): void
}

export type EffectFactory = () => BorderEffect

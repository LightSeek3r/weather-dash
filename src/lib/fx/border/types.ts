/**
 * Shared contract for every border effect module, so `BorderFx.svelte` can
 * drive any of them identically: construct, `mount` into the overlay host,
 * `unmount` on any category/tier change. An effect owns every DOM node,
 * context, listener and loop it creates, and `unmount()` must release all
 * of them — the host is left exactly as it was found.
 */
import type { FxTier } from '../tiers'

export type ActiveTier = Exclude<FxTier, 'off'>

export interface EffectOptions {
  tier: ActiveTier
  /** 0..1 — scales particle/drop counts (drizzle vs downpour, flurries vs heavy snow). */
  density: number
}

export interface BorderEffect {
  mount(host: HTMLElement, opts: EffectOptions): void
  unmount(): void
}

export type EffectFactory = () => BorderEffect

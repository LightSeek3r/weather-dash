/**
 * Weather category + tier → which border effect module to run, and its
 * lazy loader. Only the chosen module is ever fetched (plan premortem P12:
 * FX must stay out of the initial JS budget) — nothing here imports an
 * effect statically.
 */
import type { FxCategory, WeatherVisual } from '../../weather/mapWmo'
import type { ActiveTier, EffectFactory } from './types'

export type EffectId =
  | 'sun'
  | 'stars'
  | 'cloudy'
  | 'fog'
  | 'rain-webgl'
  | 'rain-eco'
  | 'snow'
  | 'storm'

export function pickEffect(
  fx: FxCategory,
  isDay: boolean,
  tier: ActiveTier
): EffectId {
  switch (fx) {
    case 'clear':
      return isDay ? 'sun' : 'stars'
    case 'cloudy':
      return 'cloudy'
    case 'fog':
      return 'fog'
    case 'drizzle':
    case 'rain':
      return tier === 'high' ? 'rain-webgl' : 'rain-eco'
    case 'snow':
      return 'snow'
    case 'storm':
      return 'storm'
  }
}

const LEVEL: Record<NonNullable<WeatherVisual['intensity']>, number> = {
  light: 0.35,
  moderate: 0.65,
  heavy: 1
}

/** 0..1 density for an effect — drizzle is a lighter-scaled rain, codes with no intensity use a moderate default. */
export function densityFor(
  fx: FxCategory,
  intensity: WeatherVisual['intensity']
): number {
  const level = intensity ? LEVEL[intensity] : LEVEL.moderate
  if (fx === 'drizzle') return level * 0.5
  if (fx === 'storm') return Math.max(level, 0.85)
  return level
}

const LOADERS: Record<
  EffectId,
  () => Promise<{ createEffect: EffectFactory }>
> = {
  sun: () => import('./sun'),
  stars: () => import('./stars'),
  cloudy: () => import('./cloudy'),
  fog: () => import('./fog'),
  'rain-webgl': () => import('./rain-webgl'),
  'rain-eco': () => import('./rain-eco'),
  snow: () => import('./snow'),
  storm: () => import('./storm')
}

export async function loadEffect(id: EffectId): Promise<EffectFactory> {
  const mod = await LOADERS[id]()
  return mod.createEffect
}

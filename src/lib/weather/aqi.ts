export const AQI_BANDS = [
  'good',
  'fair',
  'moderate',
  'poor',
  'veryPoor',
  'extremelyPoor'
] as const

export type AqiBand = (typeof AQI_BANDS)[number]

/** European Air Quality Index bands (EEA), the scale Open-Meteo's `european_aqi` uses. */
export function europeanAqiBand(aqi: number): AqiBand {
  if (aqi <= 20) return 'good'
  if (aqi <= 40) return 'fair'
  if (aqi <= 60) return 'moderate'
  if (aqi <= 80) return 'poor'
  if (aqi <= 100) return 'veryPoor'
  return 'extremelyPoor'
}

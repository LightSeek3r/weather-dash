/**
 * Pure WMO weather-code -> visual mapping. No network, no i18n lookup —
 * `conditionKey` is a `Dictionary.weather.condition` key resolved by the UI
 * layer at display time (see `lib/ui/strings.ts`), same split as
 * `MoonPhase.labelKey`.
 *
 * Icon note: `icon` values are sprite `<symbol>` ids from the chosen mockup
 * (`design/mockups/02-blue-hour.html`, ~line 383-397). `i-sun`, `i-moon`,
 * `i-cloud`, `i-cloud-dark`, `i-rain`, `i-cloudy`, `i-partly`, `i-moon-cloud`
 * already exist there. `i-snow`, `i-fog`, `i-storm` do NOT exist yet — a
 * parallel UI agent owns adding those symbols to the same sprite, reusing
 * the existing `g-cloud`/`g-cloud-dark`/`g-sun`/`g-moon` gradients where it
 * makes sense. Referencing the ids here now so this mapper doesn't need to
 * change once those symbols land.
 */

export type FxCategory =
  'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm'

export type ConditionKey =
  | 'clearSky'
  | 'mainlyClear'
  | 'partlyCloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'freezingDrizzle'
  | 'rain'
  | 'freezingRain'
  | 'snow'
  | 'snowGrains'
  | 'rainShowers'
  | 'snowShowers'
  | 'thunderstorm'

export interface WeatherVisual {
  /** Sprite symbol id — see module doc. */
  icon: string
  fx: FxCategory
  conditionKey: ConditionKey
  intensity?: 'light' | 'moderate' | 'heavy'
  hail?: boolean
}

const FALLBACK: WeatherVisual = {
  icon: 'i-cloudy',
  fx: 'cloudy',
  conditionKey: 'overcast'
}

function icon(conditionKey: ConditionKey, isDay: boolean): string {
  switch (conditionKey) {
    case 'clearSky':
    case 'mainlyClear':
      return isDay ? 'i-sun' : 'i-moon'
    case 'partlyCloudy':
      return isDay ? 'i-partly' : 'i-moon-cloud'
    case 'overcast':
      return 'i-cloudy'
    case 'fog':
      return 'i-fog'
    case 'drizzle':
    case 'freezingDrizzle':
    case 'rain':
    case 'freezingRain':
    case 'rainShowers':
      return 'i-rain'
    case 'snow':
    case 'snowGrains':
    case 'snowShowers':
      return 'i-snow'
    case 'thunderstorm':
      return 'i-storm'
  }
}

/** Maps a raw WMO weather code (https://open-meteo.com/en/docs, WMO Weather interpretation codes) to a display-ready visual. */
export function mapWmoCode(code: number, isDay: boolean): WeatherVisual {
  let conditionKey: ConditionKey
  let fx: FxCategory
  let intensity: WeatherVisual['intensity']
  let hail: boolean | undefined

  switch (code) {
    case 0:
      conditionKey = 'clearSky'
      fx = 'clear'
      break
    case 1:
      conditionKey = 'mainlyClear'
      fx = 'clear'
      break
    case 2:
      conditionKey = 'partlyCloudy'
      fx = 'cloudy'
      break
    case 3:
      conditionKey = 'overcast'
      fx = 'cloudy'
      break
    case 45:
    case 48:
      conditionKey = 'fog'
      fx = 'fog'
      break
    case 51:
      conditionKey = 'drizzle'
      fx = 'drizzle'
      intensity = 'light'
      break
    case 53:
      conditionKey = 'drizzle'
      fx = 'drizzle'
      intensity = 'moderate'
      break
    case 55:
      conditionKey = 'drizzle'
      fx = 'drizzle'
      intensity = 'heavy'
      break
    case 56:
      conditionKey = 'freezingDrizzle'
      fx = 'drizzle'
      intensity = 'light'
      break
    case 57:
      conditionKey = 'freezingDrizzle'
      fx = 'drizzle'
      intensity = 'heavy'
      break
    case 61:
      conditionKey = 'rain'
      fx = 'rain'
      intensity = 'light'
      break
    case 63:
      conditionKey = 'rain'
      fx = 'rain'
      intensity = 'moderate'
      break
    case 65:
      conditionKey = 'rain'
      fx = 'rain'
      intensity = 'heavy'
      break
    case 66:
      conditionKey = 'freezingRain'
      fx = 'rain'
      intensity = 'light'
      break
    case 67:
      conditionKey = 'freezingRain'
      fx = 'rain'
      intensity = 'heavy'
      break
    case 71:
      conditionKey = 'snow'
      fx = 'snow'
      intensity = 'light'
      break
    case 73:
      conditionKey = 'snow'
      fx = 'snow'
      intensity = 'moderate'
      break
    case 75:
      conditionKey = 'snow'
      fx = 'snow'
      intensity = 'heavy'
      break
    case 77:
      conditionKey = 'snowGrains'
      fx = 'snow'
      break
    case 80:
      conditionKey = 'rainShowers'
      fx = 'rain'
      intensity = 'light'
      break
    case 81:
      conditionKey = 'rainShowers'
      fx = 'rain'
      intensity = 'moderate'
      break
    case 82:
      conditionKey = 'rainShowers'
      fx = 'rain'
      intensity = 'heavy'
      break
    case 85:
      conditionKey = 'snowShowers'
      fx = 'snow'
      intensity = 'light'
      break
    case 86:
      conditionKey = 'snowShowers'
      fx = 'snow'
      intensity = 'heavy'
      break
    case 95:
      conditionKey = 'thunderstorm'
      fx = 'storm'
      hail = false
      break
    case 96:
      conditionKey = 'thunderstorm'
      fx = 'storm'
      hail = true
      break
    case 99:
      conditionKey = 'thunderstorm'
      fx = 'storm'
      hail = true
      break
    default:
      // Unknown/out-of-range code — fall back rather than throw, this feeds
      // a 24/7 unattended display.
      return FALLBACK
  }

  return {
    icon: icon(conditionKey, isDay),
    fx,
    conditionKey,
    ...(intensity !== undefined ? { intensity } : {}),
    ...(hail !== undefined ? { hail } : {})
  }
}

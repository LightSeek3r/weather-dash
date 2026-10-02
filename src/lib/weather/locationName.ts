import { get } from 'svelte/store'
import { LOCALES, settingsStore } from '../core/storage/settings'
import { localeTag } from '../ui/i18n'
import { t } from '../ui/strings'
import { reverseGeocode } from './reverseGeocode'

// A GPS fix is saved under this translated placeholder until named — in
// whichever language was active at the time, hence every locale's.
const PLACEHOLDER_NAMES = new Set(
  LOCALES.map((l) => t(l).weather.location.currentLocationName)
)

export function isPlaceholderLocationName(name: string): boolean {
  return PLACEHOLDER_NAMES.has(name)
}

/**
 * Names a GPS-only location ("Current location") after its city. With
 * `setHolidayCountry`, also points holidays at that country — only for an
 * explicit GPS press, never the boot-time backfill of an older saved fix.
 */
export async function nameUnnamedLocation(
  setHolidayCountry: boolean
): Promise<void> {
  const { location, locale } = get(settingsStore)
  if (!location || !isPlaceholderLocationName(location.name)) return
  const place = await reverseGeocode(
    location.lat,
    location.lon,
    localeTag(locale)
  )
  if (!place) return
  settingsStore.update((cur) => {
    // The user may have picked another place while the lookup was in flight.
    if (cur.location?.lat !== location.lat || cur.location.lon !== location.lon)
      return cur
    const newCountry =
      setHolidayCountry &&
      place.countryCode &&
      place.countryCode !== cur.holidays.baseCountry
    return {
      ...cur,
      location: { ...cur.location, name: place.name },
      holidays: newCountry
        ? { ...cur.holidays, baseCountry: place.countryCode, baseRegion: null }
        : cur.holidays
    }
  })
}

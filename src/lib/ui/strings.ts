/**
 * Minimal UI string dictionary. Every static label a component shows must
 * come from here, keyed by `settingsStore.locale` — a hardcoded English
 * literal is the same bug twice over: it already happened once (clock/date
 * formatting ignored `settingsStore.locale` entirely until this pass fixed
 * it). Extend this file's `Dictionary` shape + all 15 locale objects together
 * so nothing ships translated for some languages and not others.
 *
 * These are short, common calendar/UI words — confident enough without
 * native review. Weather condition labels (phase 2) are more idiomatic and
 * should get a native-speaker pass for fr/nl/de/ru/zh/hi/ar/bn/ur/id/ja per
 * the plan's model notes.
 *
 * Font note: the two self-hosted families (Lexend, Atkinson Hyperlegible —
 * see design-tokens.css) cover Latin + Cyrillic, so en/fr/nl/de/es/it/pt/id
 * and ru render in-font; zh, hi, ar, bn, ur and ja glyphs have no coverage
 * there and silently fall back to whatever CJK/Devanagari/Arabic/Bengali
 * system font the browser substitutes per-character. That's expected browser
 * behavior, not a bug — bundling that many non-Latin/Cyrillic webfonts is out
 * of scope (bundle-size concern, tracked in the plan). Arabic and Urdu are
 * also this app's only right-to-left locales — see `i18n.ts`'s
 * `textDirection()` and `App.svelte`'s `<html dir>` effect; the dashboard's
 * own grid layout (clock/weather/timeline placement) intentionally doesn't
 * mirror, only the text itself flows and shapes correctly.
 */
import type { Locale } from '../core/storage/settings'
import type { RelativeTimeLabels } from './status'
import type { ConditionKey, WeatherVisual } from '../weather/mapWmo'
import type { MoonPhaseKey } from '../weather/types'

type Intensity = NonNullable<WeatherVisual['intensity']>

/** Exactly the condition/intensity pairs `mapWmoCode` emits. */
interface IntensifiedConditions {
  drizzle: Record<Intensity, string>
  freezingDrizzle: Record<'light' | 'heavy', string>
  rain: Record<Intensity, string>
  freezingRain: Record<'light' | 'heavy', string>
  snow: Record<Intensity, string>
  rainShowers: Record<Intensity, string>
  snowShowers: Record<'light' | 'heavy', string>
}

export interface Dictionary {
  /** Shared across every `InfoDisclosure` trigger unless a call site overrides it. */
  common: {
    moreInfo: string
  }
  dateLine: {
    week: string
    day: string
    of: string
    /** Overflow marker for the compact holiday item, e.g. "Christmas, Boxing Day" + "+1" more. */
    more: (n: number) => string
    /** Holiday provenance in the info popover: country, or country + region. */
    holidayOrigin: (country: string, region: string | null) => string
    /** Saint-of-the-day provenance in the info popover, composed with the already-translated `settings.saints.traditionRomanCatholic`/`traditionFrenchCivil` value. */
    saintSource: (tradition: string) => string
  }
  kiosk: {
    tapToStart: string
    openSettings: string
    installTip: string
    enterFullscreen: string
  }
  /** Fullscreen anti-burn-in scene overlay. */
  scene: { tapToReturn: string }
  settings: {
    title: string
    close: string
    /** Language picker section — the <select>'s own options are each locale's native name for itself (never translated), only this heading is. */
    language: { heading: string }
    display: { heading: string; fullscreenOnStart: string }
    holidays: {
      heading: string
      country: string
      region: string
      /** The region picker's empty choice: without a region, only country-wide holidays apply. */
      nationalOnly: string
      extraCountries: string
      addCountry: string
      /** Aria-label for the remove button on an extra-country chip. */
      removeCountry: string
      listHeading: string
    }
    saints: {
      heading: string
      enable: string
      tradition: string
      traditionRomanCatholic: string
      traditionFrenchCivil: string
    }
    photos: {
      heading: string
      addPhotos: string
      /** Aria-label for a thumbnail's delete button, e.g. "Delete photo". */
      deletePhoto: string
      empty: string
      rotation: string
      /** Composes a duration label, e.g. `{n} {unit}` -> "5 minutes" / "1 hour". */
      duration: (n: number, unit: string) => string
      unitMinute: string
      unitMinutes: string
      unitHour: string
      unitHours: string
      dim: string
      blur: string
      shuffle: string
      /** `{used} MB of {quota} MB used`, composed not hardcoded per-value. */
      storageUsage: (usedMB: number, quotaMB: number) => string
    }
    backup: {
      heading: string
      exportButton: string
      importButton: string
      exportSuccess: string
      importSuccess: string
      /** Prefixes the human-readable message `importSettings()` already returns (see storage/settings.ts's `summarizeIssues`) — that message itself stays untranslated (technical field paths), same treatment as an upstream error code. */
      importErrorPrefix: string
    }
  }
  status: {
    offline: string
    noDataYet: string
    /** Prefixes `relative`, e.g. "updated" + "5m ago" -> "updated 5m ago". */
    updatedPrefix: string
    relative: RelativeTimeLabels
  }
  weather: {
    /** Toasted on a failed weather refresh (last-good data stays on screen, see store.ts). */
    fetchError: string
    condition: Record<ConditionKey, string>
    moonPhase: Record<MoonPhaseKey, string>
    /**
     * Whole phrases rather than a modifier composed onto `condition[key]`:
     * word order and agreement differ by language ("Pluie modérée",
     * "Leichter Regen", "小雨").
     */
    intensified: IntensifiedConditions
    thunderstormHail: string
    panel: {
      feelsLike: string
      humidity: string
      uvIndex: string
      /** UV info popover: one-line WHO band explanation. */
      uvScaleInfo: string
      wind: string
      force: string
      /** Wind info popover: one-line Beaufort scale explanation. */
      windScaleInfo: string
      gusts: string
      sunrise: string
      sunset: string
      daylight: string
      moonPhase: string
      /** Moon info popover: approximate visible illumination, e.g. "62% illuminated". */
      moonIllumination: (percent: number) => string
      /** Moon info popover: days until the next full moon, handling the "today" (n<=0) case itself. */
      moonNextFull: (days: number) => string
      /** Moon info popover: days until the next new moon, handling the "today" (n<=0) case itself. */
      moonNextNew: (days: number) => string
      tomorrow: string
      noLocation: string
    }
    location: {
      searchPlaceholder: string
      searchButton: string
      useMyLocation: string
      /** Location name stored after a successful GPS lookup (no reverse geocoding in v1). */
      currentLocationName: string
      gpsDenied: string
      /** GPS and the network fallback both failed. */
      gpsFailed: string
      /** Shown after falling back to the network (IP) position. */
      approximate: string
    }
  }
}

const en: Dictionary = {
  common: {
    moreInfo: 'More info'
  },
  dateLine: {
    week: 'Week',
    day: 'Day',
    of: 'of',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country} (${region})` : country,
    saintSource: (tradition) => `Source: ${tradition}`
  },
  kiosk: {
    tapToStart: 'Tap to go fullscreen',
    openSettings: 'Open settings',
    installTip:
      'Tip: add to your home screen to stay fullscreen after a reload',
    enterFullscreen: 'Go fullscreen'
  },
  scene: { tapToReturn: 'Tap to return to the dashboard' },
  settings: {
    title: 'Settings',
    close: 'Close settings',
    language: { heading: 'Language' },
    display: {
      heading: 'Display',
      fullscreenOnStart: 'Go fullscreen when the app opens'
    },
    holidays: {
      heading: 'Holidays',
      country: 'Country',
      region: 'Region',
      nationalOnly: 'National holidays only',
      extraCountries: 'Extra countries',
      addCountry: 'Add country',
      removeCountry: 'Remove country',
      listHeading: 'Holidays this year'
    },
    saints: {
      heading: 'Saint of the day',
      enable: 'Enable saint of the day',
      tradition: 'Tradition',
      traditionRomanCatholic: 'Roman Catholic',
      traditionFrenchCivil: 'French civil calendar'
    },
    photos: {
      heading: 'Photos',
      addPhotos: 'Add photos',
      deletePhoto: 'Delete photo',
      empty: 'No photos yet',
      rotation: 'Rotation',
      duration: (n, unit) => `${n} ${unit}`,
      unitMinute: 'minute',
      unitMinutes: 'minutes',
      unitHour: 'hour',
      unitHours: 'hours',
      dim: 'Dim',
      blur: 'Blur',
      shuffle: 'Shuffle photos',
      storageUsage: (used, quota) => `${used} MB of ${quota} MB used`
    },
    backup: {
      heading: 'Backup',
      exportButton: 'Export settings',
      importButton: 'Import settings',
      exportSuccess: 'Settings exported',
      importSuccess: 'Settings imported',
      importErrorPrefix: 'Import failed'
    }
  },
  status: {
    offline: 'offline',
    noDataYet: 'no data yet',
    updatedPrefix: 'updated',
    relative: {
      justNow: 'just now',
      minutesAgo: (n) => `${n}m ago`,
      hoursAgo: (n) => `${n}h ago`,
      yesterday: 'yesterday',
      daysAgo: (n) => `${n}d ago`
    }
  },
  weather: {
    fetchError: 'Could not update weather',
    condition: {
      clearSky: 'Clear sky',
      mainlyClear: 'Mainly clear',
      partlyCloudy: 'Partly cloudy',
      overcast: 'Overcast',
      fog: 'Fog',
      drizzle: 'Drizzle',
      freezingDrizzle: 'Freezing drizzle',
      rain: 'Rain',
      freezingRain: 'Freezing rain',
      snow: 'Snow',
      snowGrains: 'Snow grains',
      rainShowers: 'Rain showers',
      snowShowers: 'Snow showers',
      thunderstorm: 'Thunderstorm'
    },
    moonPhase: {
      newMoon: 'New moon',
      waxingCrescent: 'Waxing crescent',
      firstQuarter: 'First quarter',
      waxingGibbous: 'Waxing gibbous',
      fullMoon: 'Full moon',
      waningGibbous: 'Waning gibbous',
      lastQuarter: 'Last quarter',
      waningCrescent: 'Waning crescent'
    },
    intensified: {
      drizzle: {
        light: 'Light drizzle',
        moderate: 'Moderate drizzle',
        heavy: 'Heavy drizzle'
      },
      freezingDrizzle: {
        light: 'Light freezing drizzle',
        heavy: 'Heavy freezing drizzle'
      },
      rain: {
        light: 'Light rain',
        moderate: 'Moderate rain',
        heavy: 'Heavy rain'
      },
      freezingRain: {
        light: 'Light freezing rain',
        heavy: 'Heavy freezing rain'
      },
      snow: {
        light: 'Light snow',
        moderate: 'Moderate snow',
        heavy: 'Heavy snow'
      },
      rainShowers: {
        light: 'Light rain showers',
        moderate: 'Moderate rain showers',
        heavy: 'Heavy rain showers'
      },
      snowShowers: { light: 'Light snow showers', heavy: 'Heavy snow showers' }
    },
    thunderstormHail: 'Thunderstorm with hail',
    panel: {
      feelsLike: 'Feels like',
      humidity: 'Humidity',
      uvIndex: 'UV index',
      uvScaleInfo:
        'WHO UV index: 0–2 low, 3–5 moderate, 6–7 high, 8–10 very high, 11+ extreme.',
      wind: 'Wind',
      force: 'force',
      windScaleInfo: 'Beaufort scale: 0 (calm) to 12 (hurricane force).',
      gusts: 'gusts',
      sunrise: 'Sunrise',
      sunset: 'Sunset',
      daylight: 'Daylight',
      moonPhase: 'Moon phase',
      moonIllumination: (percent) => `${percent}% illuminated`,
      moonNextFull: (days) =>
        days <= 0 ? 'Full moon today' : `Full moon in ${days}d`,
      moonNextNew: (days) =>
        days <= 0 ? 'New moon today' : `New moon in ${days}d`,
      tomorrow: 'Tomorrow',
      noLocation: 'Set a location to see the weather'
    },
    location: {
      searchPlaceholder: 'Search for a city',
      searchButton: 'Search',
      useMyLocation: 'Use my location',
      currentLocationName: 'Current location',
      gpsDenied: 'Location access was denied',
      gpsFailed:
        'Couldn’t determine your position — search for your city instead',
      approximate:
        'Approximate location from your network — search your city for precision'
    }
  }
}

const fr: Dictionary = {
  common: {
    moreInfo: 'Plus d’infos'
  },
  dateLine: {
    week: 'Semaine',
    day: 'Jour',
    of: 'sur',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country} (${region})` : country,
    saintSource: (tradition) => `Source : ${tradition}`
  },
  kiosk: {
    tapToStart: 'Toucher pour passer en plein écran',
    openSettings: 'Ouvrir les réglages',
    installTip:
      "Astuce : ajoutez l'app à l'écran d'accueil pour garder le plein écran après un rechargement",
    enterFullscreen: 'Passer en plein écran'
  },
  scene: { tapToReturn: 'Toucher pour revenir au tableau de bord' },
  settings: {
    title: 'Réglages',
    close: 'Fermer les réglages',
    language: { heading: 'Langue' },
    display: {
      heading: 'Affichage',
      fullscreenOnStart: 'Passer en plein écran à l’ouverture'
    },
    holidays: {
      heading: 'Jours fériés',
      country: 'Pays',
      region: 'Région',
      nationalOnly: 'Jours fériés nationaux uniquement',
      extraCountries: 'Pays supplémentaires',
      addCountry: 'Ajouter un pays',
      removeCountry: 'Retirer le pays',
      listHeading: 'Jours fériés de l’année'
    },
    saints: {
      heading: 'Saint du jour',
      enable: 'Activer le saint du jour',
      tradition: 'Tradition',
      traditionRomanCatholic: 'Catholique romain',
      traditionFrenchCivil: 'Calendrier civil français'
    },
    photos: {
      heading: 'Photos',
      addPhotos: 'Ajouter des photos',
      deletePhoto: 'Supprimer la photo',
      empty: 'Aucune photo pour l’instant',
      rotation: 'Rotation',
      duration: (n, unit) => `${n} ${unit}`,
      unitMinute: 'minute',
      unitMinutes: 'minutes',
      unitHour: 'heure',
      unitHours: 'heures',
      dim: 'Assombrir',
      blur: 'Flou',
      shuffle: 'Lecture aléatoire des photos',
      storageUsage: (used, quota) => `${used} Mo sur ${quota} Mo utilisés`
    },
    backup: {
      heading: 'Sauvegarde',
      exportButton: 'Exporter les réglages',
      importButton: 'Importer les réglages',
      exportSuccess: 'Réglages exportés',
      importSuccess: 'Réglages importés',
      importErrorPrefix: 'Échec de l’importation'
    }
  },
  status: {
    offline: 'hors ligne',
    noDataYet: 'aucune donnée pour l’instant',
    updatedPrefix: 'mis à jour',
    relative: {
      justNow: 'à l’instant',
      minutesAgo: (n) => `il y a ${n} min`,
      hoursAgo: (n) => `il y a ${n} h`,
      yesterday: 'hier',
      daysAgo: (n) => `il y a ${n} j`
    }
  },
  // fr weather vocabulary below is idiomatic, not just literal-translated
  // calendar words — flagging for a native-speaker review pass (per plan).
  weather: {
    fetchError: 'Impossible de mettre à jour la météo',
    condition: {
      clearSky: 'Ciel dégagé',
      mainlyClear: 'Plutôt dégagé',
      partlyCloudy: 'Partiellement nuageux',
      overcast: 'Couvert',
      fog: 'Brouillard',
      drizzle: 'Bruine',
      freezingDrizzle: 'Bruine verglaçante',
      rain: 'Pluie',
      freezingRain: 'Pluie verglaçante',
      snow: 'Neige',
      snowGrains: 'Neige en grains',
      rainShowers: 'Averses',
      snowShowers: 'Averses de neige',
      thunderstorm: 'Orage'
    },
    moonPhase: {
      newMoon: 'Nouvelle lune',
      waxingCrescent: 'Premier croissant',
      firstQuarter: 'Premier quartier',
      waxingGibbous: 'Gibbeuse croissante',
      fullMoon: 'Pleine lune',
      waningGibbous: 'Gibbeuse décroissante',
      lastQuarter: 'Dernier quartier',
      waningCrescent: 'Dernier croissant'
    },
    intensified: {
      drizzle: {
        light: 'Bruine faible',
        moderate: 'Bruine modérée',
        heavy: 'Forte bruine'
      },
      freezingDrizzle: {
        light: 'Bruine verglaçante faible',
        heavy: 'Forte bruine verglaçante'
      },
      rain: {
        light: 'Pluie faible',
        moderate: 'Pluie modérée',
        heavy: 'Forte pluie'
      },
      freezingRain: {
        light: 'Pluie verglaçante faible',
        heavy: 'Forte pluie verglaçante'
      },
      snow: {
        light: 'Neige faible',
        moderate: 'Neige modérée',
        heavy: 'Forte neige'
      },
      rainShowers: {
        light: 'Averses faibles',
        moderate: 'Averses modérées',
        heavy: 'Fortes averses'
      },
      snowShowers: {
        light: 'Faibles averses de neige',
        heavy: 'Fortes averses de neige'
      }
    },
    thunderstormHail: 'Orage avec grêle',
    panel: {
      feelsLike: 'Ressenti',
      humidity: 'Humidité',
      uvIndex: 'Indice UV',
      uvScaleInfo:
        'Indice UV (OMS) : 0–2 faible, 3–5 modéré, 6–7 élevé, 8–10 très élevé, 11+ extrême.',
      wind: 'Vent',
      force: 'force',
      windScaleInfo: 'Échelle de Beaufort : de 0 (calme) à 12 (force ouragan).',
      gusts: 'rafales',
      sunrise: 'Lever du soleil',
      sunset: 'Coucher du soleil',
      daylight: 'Ensoleillement',
      moonPhase: 'Phase lunaire',
      moonIllumination: (percent) => `${percent}% éclairée`,
      moonNextFull: (days) =>
        days <= 0 ? 'Pleine lune aujourd’hui' : `Pleine lune dans ${days} j`,
      moonNextNew: (days) =>
        days <= 0
          ? 'Nouvelle lune aujourd’hui'
          : `Nouvelle lune dans ${days} j`,
      tomorrow: 'Demain',
      noLocation: 'Définissez un lieu pour voir la météo'
    },
    location: {
      searchPlaceholder: 'Rechercher une ville',
      searchButton: 'Rechercher',
      useMyLocation: 'Utiliser ma position',
      currentLocationName: 'Position actuelle',
      gpsDenied: 'L’accès à la position a été refusé',
      gpsFailed: 'Position introuvable — recherchez plutôt votre ville',
      approximate:
        'Position approximative d’après votre réseau — recherchez votre ville pour plus de précision'
    }
  }
}

const nl: Dictionary = {
  common: {
    moreInfo: 'Meer info'
  },
  dateLine: {
    week: 'Week',
    day: 'Dag',
    of: 'van',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country} (${region})` : country,
    saintSource: (tradition) => `Bron: ${tradition}`
  },
  kiosk: {
    tapToStart: 'Tik om volledig scherm te openen',
    openSettings: 'Instellingen openen',
    installTip:
      'Tip: voeg toe aan je startscherm om volledig scherm te behouden na een herlaad',
    enterFullscreen: 'Volledig scherm'
  },
  scene: { tapToReturn: 'Tik om terug te gaan naar het dashboard' },
  settings: {
    title: 'Instellingen',
    close: 'Instellingen sluiten',
    language: { heading: 'Taal' },
    display: {
      heading: 'Weergave',
      fullscreenOnStart: 'Volledig scherm bij het openen van de app'
    },
    holidays: {
      heading: 'Feestdagen',
      country: 'Land',
      region: 'Regio',
      nationalOnly: 'Alleen nationale feestdagen',
      extraCountries: 'Extra landen',
      addCountry: 'Land toevoegen',
      removeCountry: 'Land verwijderen',
      listHeading: 'Feestdagen dit jaar'
    },
    saints: {
      heading: 'Heilige van de dag',
      enable: 'Heilige van de dag inschakelen',
      tradition: 'Traditie',
      traditionRomanCatholic: 'Rooms-katholiek',
      traditionFrenchCivil: 'Franse burgerlijke kalender'
    },
    photos: {
      heading: 'Foto’s',
      addPhotos: 'Foto’s toevoegen',
      deletePhoto: 'Foto verwijderen',
      empty: 'Nog geen foto’s',
      rotation: 'Rotatie',
      duration: (n, unit) => `${n} ${unit}`,
      // Dutch: "minuut" pluralizes irregularly to "minuten"; "uur" stays
      // invariant after a number ("2 uur", not "2 uren") — not a simple +s
      // either direction, so both need their own word per plan's i18n note.
      unitMinute: 'minuut',
      unitMinutes: 'minuten',
      unitHour: 'uur',
      unitHours: 'uur',
      dim: 'Dimmen',
      blur: 'Vervagen',
      shuffle: 'Willekeurige volgorde',
      storageUsage: (used, quota) => `${used} MB van ${quota} MB gebruikt`
    },
    backup: {
      heading: 'Backup',
      exportButton: 'Instellingen exporteren',
      importButton: 'Instellingen importeren',
      exportSuccess: 'Instellingen geëxporteerd',
      importSuccess: 'Instellingen geïmporteerd',
      importErrorPrefix: 'Importeren mislukt'
    }
  },
  status: {
    offline: 'offline',
    noDataYet: 'nog geen gegevens',
    updatedPrefix: 'bijgewerkt',
    relative: {
      justNow: 'net nu',
      minutesAgo: (n) => `${n} min geleden`,
      hoursAgo: (n) => `${n} u geleden`,
      yesterday: 'gisteren',
      daysAgo: (n) => `${n} d geleden`
    }
  },
  // nl weather vocabulary — flagging for a native-speaker review pass (per plan).
  weather: {
    fetchError: 'Weer bijwerken mislukt',
    condition: {
      clearSky: 'Heldere lucht',
      mainlyClear: 'Grotendeels helder',
      partlyCloudy: 'Deels bewolkt',
      overcast: 'Bewolkt',
      fog: 'Mist',
      drizzle: 'Motregen',
      freezingDrizzle: 'Onderkoelde motregen',
      rain: 'Regen',
      freezingRain: 'Onderkoelde regen',
      snow: 'Sneeuw',
      snowGrains: 'Sneeuwkorrels',
      rainShowers: 'Regenbuien',
      snowShowers: 'Sneeuwbuien',
      thunderstorm: 'Onweer'
    },
    moonPhase: {
      newMoon: 'Nieuwe maan',
      waxingCrescent: 'Wassende maansikkel',
      firstQuarter: 'Eerste kwartier',
      waxingGibbous: 'Wassende maan',
      fullMoon: 'Volle maan',
      waningGibbous: 'Afnemende maan',
      lastQuarter: 'Laatste kwartier',
      waningCrescent: 'Afnemende maansikkel'
    },
    intensified: {
      drizzle: {
        light: 'Lichte motregen',
        moderate: 'Matige motregen',
        heavy: 'Zware motregen'
      },
      freezingDrizzle: {
        light: 'Lichte onderkoelde motregen',
        heavy: 'Zware onderkoelde motregen'
      },
      rain: {
        light: 'Lichte regen',
        moderate: 'Matige regen',
        heavy: 'Zware regen'
      },
      freezingRain: {
        light: 'Lichte onderkoelde regen',
        heavy: 'Zware onderkoelde regen'
      },
      snow: {
        light: 'Lichte sneeuw',
        moderate: 'Matige sneeuw',
        heavy: 'Zware sneeuw'
      },
      rainShowers: {
        light: 'Lichte regenbuien',
        moderate: 'Matige regenbuien',
        heavy: 'Zware regenbuien'
      },
      snowShowers: { light: 'Lichte sneeuwbuien', heavy: 'Zware sneeuwbuien' }
    },
    thunderstormHail: 'Onweer met hagel',
    panel: {
      feelsLike: 'Voelt als',
      humidity: 'Vochtigheid',
      uvIndex: 'UV-index',
      uvScaleInfo:
        'UV-index (WHO): 0–2 laag, 3–5 matig, 6–7 hoog, 8–10 zeer hoog, 11+ extreem.',
      wind: 'Wind',
      force: 'kracht',
      windScaleInfo:
        'Schaal van Beaufort: van 0 (windstil) tot 12 (orkaankracht).',
      gusts: 'windstoten',
      sunrise: 'Zonsopgang',
      sunset: 'Zonsondergang',
      daylight: 'Daglicht',
      moonPhase: 'Maanfase',
      moonIllumination: (percent) => `${percent}% verlicht`,
      moonNextFull: (days) =>
        days <= 0 ? 'Vandaag volle maan' : `Volle maan in ${days} d`,
      moonNextNew: (days) =>
        days <= 0 ? 'Vandaag nieuwe maan' : `Nieuwe maan in ${days} d`,
      tomorrow: 'Morgen',
      noLocation: 'Stel een locatie in om het weer te zien'
    },
    location: {
      searchPlaceholder: 'Zoek een stad',
      searchButton: 'Zoeken',
      useMyLocation: 'Mijn locatie gebruiken',
      currentLocationName: 'Huidige locatie',
      gpsDenied: 'Toegang tot locatie is geweigerd',
      gpsFailed: 'Positie niet gevonden — zoek in plaats daarvan je stad',
      approximate:
        'Geschatte locatie via je netwerk — zoek je stad voor meer precisie'
    }
  }
}

const de: Dictionary = {
  common: {
    moreInfo: 'Mehr Infos'
  },
  dateLine: {
    week: 'Woche',
    day: 'Tag',
    of: 'von',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country} (${region})` : country,
    saintSource: (tradition) => `Quelle: ${tradition}`
  },
  kiosk: {
    tapToStart: 'Für Vollbild tippen',
    openSettings: 'Einstellungen öffnen',
    installTip:
      'Tipp: Zum Startbildschirm hinzufügen, damit Vollbild nach einem Neuladen erhalten bleibt',
    enterFullscreen: 'Vollbild'
  },
  scene: { tapToReturn: 'Tippen, um zum Dashboard zurückzukehren' },
  settings: {
    title: 'Einstellungen',
    close: 'Einstellungen schließen',
    language: { heading: 'Sprache' },
    display: {
      heading: 'Anzeige',
      fullscreenOnStart: 'Beim Öffnen der App in den Vollbildmodus wechseln'
    },
    holidays: {
      heading: 'Feiertage',
      country: 'Land',
      region: 'Region',
      nationalOnly: 'Nur landesweite Feiertage',
      extraCountries: 'Zusätzliche Länder',
      addCountry: 'Land hinzufügen',
      removeCountry: 'Land entfernen',
      listHeading: 'Feiertage dieses Jahr'
    },
    saints: {
      heading: 'Namenstag',
      enable: 'Namenstag anzeigen',
      tradition: 'Tradition',
      traditionRomanCatholic: 'Römisch-katholisch',
      traditionFrenchCivil: 'Französischer Zivilkalender'
    },
    photos: {
      heading: 'Fotos',
      addPhotos: 'Fotos hinzufügen',
      deletePhoto: 'Foto löschen',
      empty: 'Noch keine Fotos',
      rotation: 'Rotation',
      duration: (n, unit) => `${n} ${unit}`,
      unitMinute: 'Minute',
      unitMinutes: 'Minuten',
      unitHour: 'Stunde',
      unitHours: 'Stunden',
      dim: 'Abdunkeln',
      blur: 'Unschärfe',
      shuffle: 'Zufällige Reihenfolge',
      storageUsage: (used, quota) => `${used} MB von ${quota} MB verwendet`
    },
    backup: {
      heading: 'Sicherung',
      exportButton: 'Einstellungen exportieren',
      importButton: 'Einstellungen importieren',
      exportSuccess: 'Einstellungen exportiert',
      importSuccess: 'Einstellungen importiert',
      importErrorPrefix: 'Import fehlgeschlagen'
    }
  },
  status: {
    offline: 'offline',
    noDataYet: 'noch keine Daten',
    updatedPrefix: 'aktualisiert',
    relative: {
      justNow: 'gerade jetzt',
      minutesAgo: (n) => `vor ${n} Min.`,
      hoursAgo: (n) => `vor ${n} Std.`,
      yesterday: 'gestern',
      daysAgo: (n) => `vor ${n} Tg.`
    }
  },
  // de weather vocabulary — flagging for a native-speaker review pass (per plan).
  weather: {
    fetchError: 'Wetter konnte nicht aktualisiert werden',
    condition: {
      clearSky: 'Klarer Himmel',
      mainlyClear: 'Überwiegend klar',
      partlyCloudy: 'Teilweise bewölkt',
      overcast: 'Bedeckt',
      fog: 'Nebel',
      drizzle: 'Sprühregen',
      freezingDrizzle: 'Gefrierender Sprühregen',
      rain: 'Regen',
      freezingRain: 'Gefrierender Regen',
      snow: 'Schnee',
      snowGrains: 'Schneegriesel',
      rainShowers: 'Regenschauer',
      snowShowers: 'Schneeschauer',
      thunderstorm: 'Gewitter'
    },
    moonPhase: {
      newMoon: 'Neumond',
      waxingCrescent: 'Zunehmende Sichel',
      firstQuarter: 'Erstes Viertel',
      waxingGibbous: 'Zunehmender Mond',
      fullMoon: 'Vollmond',
      waningGibbous: 'Abnehmender Mond',
      lastQuarter: 'Letztes Viertel',
      waningCrescent: 'Abnehmende Sichel'
    },
    intensified: {
      drizzle: {
        light: 'Leichter Sprühregen',
        moderate: 'Mäßiger Sprühregen',
        heavy: 'Starker Sprühregen'
      },
      freezingDrizzle: {
        light: 'Leichter gefrierender Sprühregen',
        heavy: 'Starker gefrierender Sprühregen'
      },
      rain: {
        light: 'Leichter Regen',
        moderate: 'Mäßiger Regen',
        heavy: 'Starker Regen'
      },
      freezingRain: {
        light: 'Leichter gefrierender Regen',
        heavy: 'Starker gefrierender Regen'
      },
      snow: {
        light: 'Leichter Schneefall',
        moderate: 'Mäßiger Schneefall',
        heavy: 'Starker Schneefall'
      },
      rainShowers: {
        light: 'Leichter Regenschauer',
        moderate: 'Mäßiger Regenschauer',
        heavy: 'Starker Regenschauer'
      },
      snowShowers: {
        light: 'Leichter Schneeschauer',
        heavy: 'Starker Schneeschauer'
      }
    },
    thunderstormHail: 'Gewitter mit Hagel',
    panel: {
      feelsLike: 'Gefühlt',
      humidity: 'Luftfeuchtigkeit',
      uvIndex: 'UV-Index',
      uvScaleInfo:
        'UV-Index (WHO): 0–2 niedrig, 3–5 mäßig, 6–7 hoch, 8–10 sehr hoch, 11+ extrem.',
      wind: 'Wind',
      force: 'Stärke',
      windScaleInfo: 'Beaufort-Skala: von 0 (windstill) bis 12 (Orkanstärke).',
      gusts: 'Böen',
      sunrise: 'Sonnenaufgang',
      sunset: 'Sonnenuntergang',
      daylight: 'Tageslicht',
      moonPhase: 'Mondphase',
      moonIllumination: (percent) => `${percent}% beleuchtet`,
      moonNextFull: (days) =>
        days <= 0 ? 'Heute Vollmond' : `Vollmond in ${days} Tg.`,
      moonNextNew: (days) =>
        days <= 0 ? 'Heute Neumond' : `Neumond in ${days} Tg.`,
      tomorrow: 'Morgen',
      noLocation: 'Standort festlegen, um das Wetter zu sehen'
    },
    location: {
      searchPlaceholder: 'Stadt suchen',
      searchButton: 'Suchen',
      useMyLocation: 'Meinen Standort verwenden',
      currentLocationName: 'Aktueller Standort',
      gpsDenied: 'Standortzugriff wurde verweigert',
      gpsFailed: 'Standort nicht ermittelbar — bitte nach der Stadt suchen',
      approximate:
        'Ungefährer Standort über das Netzwerk — für mehr Genauigkeit die Stadt suchen'
    }
  }
}

const es: Dictionary = {
  common: {
    moreInfo: 'Más información'
  },
  dateLine: {
    week: 'Semana',
    day: 'Día',
    of: 'de',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country} (${region})` : country,
    saintSource: (tradition) => `Fuente: ${tradition}`
  },
  kiosk: {
    tapToStart: 'Toca para ver en pantalla completa',
    openSettings: 'Abrir ajustes',
    installTip:
      'Consejo: añade la app a tu pantalla de inicio para mantener la pantalla completa tras recargar',
    enterFullscreen: 'Pantalla completa'
  },
  scene: { tapToReturn: 'Toca para volver al panel' },
  settings: {
    title: 'Ajustes',
    close: 'Cerrar ajustes',
    language: { heading: 'Idioma' },
    display: {
      heading: 'Pantalla',
      fullscreenOnStart: 'Pasar a pantalla completa al abrir la app'
    },
    holidays: {
      heading: 'Días festivos',
      country: 'País',
      region: 'Región',
      nationalOnly: 'Solo festivos nacionales',
      extraCountries: 'Países adicionales',
      addCountry: 'Añadir país',
      removeCountry: 'Quitar país',
      listHeading: 'Días festivos de este año'
    },
    saints: {
      heading: 'Santo del día',
      enable: 'Activar el santo del día',
      tradition: 'Tradición',
      traditionRomanCatholic: 'Católico romano',
      traditionFrenchCivil: 'Calendario civil francés'
    },
    photos: {
      heading: 'Fotos',
      addPhotos: 'Añadir fotos',
      deletePhoto: 'Eliminar foto',
      empty: 'Aún no hay fotos',
      rotation: 'Rotación',
      duration: (n, unit) => `${n} ${unit}`,
      unitMinute: 'minuto',
      unitMinutes: 'minutos',
      unitHour: 'hora',
      unitHours: 'horas',
      dim: 'Oscurecer',
      blur: 'Desenfoque',
      shuffle: 'Orden aleatorio',
      storageUsage: (used, quota) => `${used} MB de ${quota} MB usados`
    },
    backup: {
      heading: 'Copia de seguridad',
      exportButton: 'Exportar ajustes',
      importButton: 'Importar ajustes',
      exportSuccess: 'Ajustes exportados',
      importSuccess: 'Ajustes importados',
      importErrorPrefix: 'Error al importar'
    }
  },
  status: {
    offline: 'sin conexión',
    noDataYet: 'aún sin datos',
    updatedPrefix: 'actualizado',
    relative: {
      justNow: 'ahora mismo',
      minutesAgo: (n) => `hace ${n} min`,
      hoursAgo: (n) => `hace ${n} h`,
      yesterday: 'ayer',
      daysAgo: (n) => `hace ${n} d`
    }
  },
  weather: {
    fetchError: 'No se pudo actualizar el tiempo',
    condition: {
      clearSky: 'Cielo despejado',
      mainlyClear: 'Mayormente despejado',
      partlyCloudy: 'Parcialmente nublado',
      overcast: 'Cubierto',
      fog: 'Niebla',
      drizzle: 'Llovizna',
      freezingDrizzle: 'Llovizna helada',
      rain: 'Lluvia',
      freezingRain: 'Lluvia helada',
      snow: 'Nieve',
      snowGrains: 'Granos de nieve',
      rainShowers: 'Chubascos',
      snowShowers: 'Chubascos de nieve',
      thunderstorm: 'Tormenta'
    },
    moonPhase: {
      newMoon: 'Luna nueva',
      waxingCrescent: 'Creciente iluminante',
      firstQuarter: 'Cuarto creciente',
      waxingGibbous: 'Gibosa creciente',
      fullMoon: 'Luna llena',
      waningGibbous: 'Gibosa menguante',
      lastQuarter: 'Cuarto menguante',
      waningCrescent: 'Creciente menguante'
    },
    intensified: {
      drizzle: {
        light: 'Llovizna ligera',
        moderate: 'Llovizna moderada',
        heavy: 'Llovizna fuerte'
      },
      freezingDrizzle: {
        light: 'Llovizna helada ligera',
        heavy: 'Llovizna helada fuerte'
      },
      rain: {
        light: 'Lluvia ligera',
        moderate: 'Lluvia moderada',
        heavy: 'Lluvia fuerte'
      },
      freezingRain: {
        light: 'Lluvia helada ligera',
        heavy: 'Lluvia helada fuerte'
      },
      snow: {
        light: 'Nieve ligera',
        moderate: 'Nieve moderada',
        heavy: 'Nieve fuerte'
      },
      rainShowers: {
        light: 'Chubascos ligeros',
        moderate: 'Chubascos moderados',
        heavy: 'Chubascos fuertes'
      },
      snowShowers: {
        light: 'Chubascos de nieve ligeros',
        heavy: 'Chubascos de nieve fuertes'
      }
    },
    thunderstormHail: 'Tormenta con granizo',
    panel: {
      feelsLike: 'Sensación',
      humidity: 'Humedad',
      uvIndex: 'Índice UV',
      uvScaleInfo:
        'Índice UV (OMS): 0–2 bajo, 3–5 moderado, 6–7 alto, 8–10 muy alto, 11+ extremo.',
      wind: 'Viento',
      force: 'fuerza',
      windScaleInfo: 'Escala de Beaufort: de 0 (calma) a 12 (fuerza huracán).',
      gusts: 'rachas',
      sunrise: 'Amanecer',
      sunset: 'Atardecer',
      daylight: 'Horas de luz',
      moonPhase: 'Fase lunar',
      moonIllumination: (percent) => `${percent}% iluminada`,
      moonNextFull: (days) =>
        days <= 0 ? 'Luna llena hoy' : `Luna llena en ${days} d`,
      moonNextNew: (days) =>
        days <= 0 ? 'Luna nueva hoy' : `Luna nueva en ${days} d`,
      tomorrow: 'Mañana',
      noLocation: 'Configura una ubicación para ver el tiempo'
    },
    location: {
      searchPlaceholder: 'Buscar una ciudad',
      searchButton: 'Buscar',
      useMyLocation: 'Usar mi ubicación',
      currentLocationName: 'Ubicación actual',
      gpsDenied: 'Se denegó el acceso a la ubicación',
      gpsFailed: 'No se pudo determinar la ubicación: busca tu ciudad',
      approximate:
        'Ubicación aproximada según tu red: busca tu ciudad para mayor precisión'
    }
  }
}

const it: Dictionary = {
  common: {
    moreInfo: 'Altre info'
  },
  dateLine: {
    week: 'Settimana',
    day: 'Giorno',
    of: 'di',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country} (${region})` : country,
    saintSource: (tradition) => `Fonte: ${tradition}`
  },
  kiosk: {
    tapToStart: 'Tocca per andare a schermo intero',
    openSettings: 'Apri impostazioni',
    installTip:
      'Suggerimento: aggiungi alla schermata Home per restare a schermo intero dopo un ricaricamento',
    enterFullscreen: 'Schermo intero'
  },
  scene: { tapToReturn: 'Tocca per tornare alla dashboard' },
  settings: {
    title: 'Impostazioni',
    close: 'Chiudi impostazioni',
    language: { heading: 'Lingua' },
    display: {
      heading: 'Schermo',
      fullscreenOnStart: 'Passa a schermo intero all’apertura dell’app'
    },
    holidays: {
      heading: 'Festività',
      country: 'Paese',
      region: 'Regione',
      nationalOnly: 'Solo festività nazionali',
      extraCountries: 'Paesi aggiuntivi',
      addCountry: 'Aggiungi paese',
      removeCountry: 'Rimuovi paese',
      listHeading: 'Festività di quest’anno'
    },
    saints: {
      heading: 'Santo del giorno',
      enable: 'Attiva il santo del giorno',
      tradition: 'Tradizione',
      traditionRomanCatholic: 'Cattolico romano',
      traditionFrenchCivil: 'Calendario civile francese'
    },
    photos: {
      heading: 'Foto',
      addPhotos: 'Aggiungi foto',
      deletePhoto: 'Elimina foto',
      empty: 'Nessuna foto ancora',
      rotation: 'Rotazione',
      duration: (n, unit) => `${n} ${unit}`,
      // Italian pluralizes both irregularly (minuto->minuti, ora->ore), not
      // with a suffix -s, so each needs its own word (per plan's i18n note).
      unitMinute: 'minuto',
      unitMinutes: 'minuti',
      unitHour: 'ora',
      unitHours: 'ore',
      dim: 'Oscuramento',
      blur: 'Sfocatura',
      shuffle: 'Ordine casuale',
      storageUsage: (used, quota) => `${used} MB di ${quota} MB utilizzati`
    },
    backup: {
      heading: 'Backup',
      exportButton: 'Esporta impostazioni',
      importButton: 'Importa impostazioni',
      exportSuccess: 'Impostazioni esportate',
      importSuccess: 'Impostazioni importate',
      importErrorPrefix: 'Importazione non riuscita'
    }
  },
  status: {
    offline: 'offline',
    noDataYet: 'nessun dato ancora',
    updatedPrefix: 'aggiornato',
    relative: {
      justNow: 'proprio ora',
      minutesAgo: (n) => `${n} min fa`,
      hoursAgo: (n) => `${n} h fa`,
      yesterday: 'ieri',
      daysAgo: (n) => `${n} g fa`
    }
  },
  weather: {
    fetchError: 'Impossibile aggiornare il meteo',
    condition: {
      clearSky: 'Cielo sereno',
      mainlyClear: 'Prevalentemente sereno',
      partlyCloudy: 'Parzialmente nuvoloso',
      overcast: 'Coperto',
      fog: 'Nebbia',
      drizzle: 'Pioviggine',
      freezingDrizzle: 'Pioviggine gelata',
      rain: 'Pioggia',
      freezingRain: 'Pioggia gelata',
      snow: 'Neve',
      snowGrains: 'Graniglia di neve',
      rainShowers: 'Rovesci di pioggia',
      snowShowers: 'Rovesci di neve',
      thunderstorm: 'Temporale'
    },
    moonPhase: {
      newMoon: 'Luna nuova',
      waxingCrescent: 'Luna crescente',
      firstQuarter: 'Primo quarto',
      waxingGibbous: 'Gibbosa crescente',
      fullMoon: 'Luna piena',
      waningGibbous: 'Gibbosa calante',
      lastQuarter: 'Ultimo quarto',
      waningCrescent: 'Luna calante'
    },
    intensified: {
      drizzle: {
        light: 'Pioviggine leggera',
        moderate: 'Pioviggine moderata',
        heavy: 'Pioviggine forte'
      },
      freezingDrizzle: {
        light: 'Pioviggine gelata leggera',
        heavy: 'Pioviggine gelata forte'
      },
      rain: {
        light: 'Pioggia leggera',
        moderate: 'Pioggia moderata',
        heavy: 'Pioggia forte'
      },
      freezingRain: {
        light: 'Pioggia gelata leggera',
        heavy: 'Pioggia gelata forte'
      },
      snow: {
        light: 'Neve leggera',
        moderate: 'Neve moderata',
        heavy: 'Neve forte'
      },
      rainShowers: {
        light: 'Rovesci di pioggia leggeri',
        moderate: 'Rovesci di pioggia moderati',
        heavy: 'Rovesci di pioggia forti'
      },
      snowShowers: {
        light: 'Rovesci di neve leggeri',
        heavy: 'Rovesci di neve forti'
      }
    },
    thunderstormHail: 'Temporale con grandine',
    panel: {
      feelsLike: 'Percepita',
      humidity: 'Umidità',
      uvIndex: 'Indice UV',
      uvScaleInfo:
        'Indice UV (OMS): 0–2 basso, 3–5 moderato, 6–7 alto, 8–10 molto alto, 11+ estremo.',
      wind: 'Vento',
      force: 'forza',
      windScaleInfo: 'Scala Beaufort: da 0 (calma) a 12 (forza uragano).',
      gusts: 'raffiche',
      sunrise: 'Alba',
      sunset: 'Tramonto',
      daylight: 'Ore di luce',
      moonPhase: 'Fase lunare',
      moonIllumination: (percent) => `${percent}% illuminata`,
      moonNextFull: (days) =>
        days <= 0 ? 'Luna piena oggi' : `Luna piena in ${days} g`,
      moonNextNew: (days) =>
        days <= 0 ? 'Luna nuova oggi' : `Luna nuova in ${days} g`,
      tomorrow: 'Domani',
      noLocation: 'Imposta una posizione per vedere il meteo'
    },
    location: {
      searchPlaceholder: 'Cerca una città',
      searchButton: 'Cerca',
      useMyLocation: 'Usa la mia posizione',
      currentLocationName: 'Posizione attuale',
      gpsDenied: 'Accesso alla posizione negato',
      gpsFailed: 'Impossibile determinare la posizione: cerca la tua città',
      approximate:
        'Posizione approssimativa dalla rete: cerca la tua città per maggiore precisione'
    }
  }
}

const pt: Dictionary = {
  common: {
    moreInfo: 'Mais informações'
  },
  dateLine: {
    week: 'Semana',
    day: 'Dia',
    of: 'de',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country} (${region})` : country,
    saintSource: (tradition) => `Fonte: ${tradition}`
  },
  kiosk: {
    tapToStart: 'Toque para tela cheia',
    openSettings: 'Abrir configurações',
    installTip:
      'Dica: adicione à tela inicial para manter a tela cheia após recarregar',
    enterFullscreen: 'Tela cheia'
  },
  scene: { tapToReturn: 'Toque para voltar ao painel' },
  settings: {
    title: 'Configurações',
    close: 'Fechar configurações',
    language: { heading: 'Idioma' },
    display: {
      heading: 'Tela',
      fullscreenOnStart: 'Entrar em tela cheia ao abrir o app'
    },
    holidays: {
      heading: 'Feriados',
      country: 'País',
      region: 'Região',
      nationalOnly: 'Apenas feriados nacionais',
      extraCountries: 'Países adicionais',
      addCountry: 'Adicionar país',
      removeCountry: 'Remover país',
      listHeading: 'Feriados deste ano'
    },
    saints: {
      heading: 'Santo do dia',
      enable: 'Ativar o santo do dia',
      tradition: 'Tradição',
      traditionRomanCatholic: 'Católico romano',
      traditionFrenchCivil: 'Calendário civil francês'
    },
    photos: {
      heading: 'Fotos',
      addPhotos: 'Adicionar fotos',
      deletePhoto: 'Eliminar foto',
      empty: 'Ainda sem fotos',
      rotation: 'Rotação',
      duration: (n, unit) => `${n} ${unit}`,
      unitMinute: 'minuto',
      unitMinutes: 'minutos',
      unitHour: 'hora',
      unitHours: 'horas',
      dim: 'Escurecer',
      blur: 'Desfoque',
      shuffle: 'Ordem aleatória',
      storageUsage: (used, quota) => `${used} MB de ${quota} MB utilizados`
    },
    backup: {
      heading: 'Cópia de segurança',
      exportButton: 'Exportar configurações',
      importButton: 'Importar configurações',
      exportSuccess: 'Configurações exportadas',
      importSuccess: 'Configurações importadas',
      importErrorPrefix: 'Falha na importação'
    }
  },
  status: {
    offline: 'offline',
    noDataYet: 'ainda sem dados',
    updatedPrefix: 'atualizado',
    relative: {
      justNow: 'agora mesmo',
      minutesAgo: (n) => `há ${n} min`,
      hoursAgo: (n) => `há ${n} h`,
      yesterday: 'ontem',
      daysAgo: (n) => `há ${n} d`
    }
  },
  weather: {
    fetchError: 'Não foi possível atualizar o tempo',
    condition: {
      clearSky: 'Céu limpo',
      mainlyClear: 'Predominantemente limpo',
      partlyCloudy: 'Parcialmente nublado',
      overcast: 'Nublado',
      fog: 'Nevoeiro',
      drizzle: 'Chuvisco',
      freezingDrizzle: 'Chuvisco gelado',
      rain: 'Chuva',
      freezingRain: 'Chuva gelada',
      snow: 'Neve',
      snowGrains: 'Grãos de neve',
      rainShowers: 'Aguaceiros',
      snowShowers: 'Aguaceiros de neve',
      thunderstorm: 'Trovoada'
    },
    moonPhase: {
      newMoon: 'Lua nova',
      waxingCrescent: 'Crescente côncava',
      firstQuarter: 'Quarto crescente',
      waxingGibbous: 'Gibosa crescente',
      fullMoon: 'Lua cheia',
      waningGibbous: 'Gibosa minguante',
      lastQuarter: 'Quarto minguante',
      waningCrescent: 'Minguante côncava'
    },
    intensified: {
      drizzle: {
        light: 'Chuvisco fraco',
        moderate: 'Chuvisco moderado',
        heavy: 'Chuvisco forte'
      },
      freezingDrizzle: {
        light: 'Chuvisco gelado fraco',
        heavy: 'Chuvisco gelado forte'
      },
      rain: {
        light: 'Chuva fraca',
        moderate: 'Chuva moderada',
        heavy: 'Chuva forte'
      },
      freezingRain: {
        light: 'Chuva gelada fraca',
        heavy: 'Chuva gelada forte'
      },
      snow: {
        light: 'Neve fraca',
        moderate: 'Neve moderada',
        heavy: 'Neve forte'
      },
      rainShowers: {
        light: 'Aguaceiros fracos',
        moderate: 'Aguaceiros moderados',
        heavy: 'Aguaceiros fortes'
      },
      snowShowers: {
        light: 'Aguaceiros de neve fracos',
        heavy: 'Aguaceiros de neve fortes'
      }
    },
    thunderstormHail: 'Trovoada com granizo',
    panel: {
      feelsLike: 'Sensação',
      humidity: 'Humidade',
      uvIndex: 'Índice UV',
      uvScaleInfo:
        'Índice UV (OMS): 0–2 baixo, 3–5 moderado, 6–7 alto, 8–10 muito alto, 11+ extremo.',
      wind: 'Vento',
      force: 'força',
      windScaleInfo:
        'Escala de Beaufort: de 0 (calmo) a 12 (força de furacão).',
      gusts: 'rajadas',
      sunrise: 'Nascer do sol',
      sunset: 'Pôr do sol',
      daylight: 'Luz do dia',
      moonPhase: 'Fase da lua',
      moonIllumination: (percent) => `${percent}% iluminada`,
      moonNextFull: (days) =>
        days <= 0 ? 'Lua cheia hoje' : `Lua cheia em ${days} d`,
      moonNextNew: (days) =>
        days <= 0 ? 'Lua nova hoje' : `Lua nova em ${days} d`,
      tomorrow: 'Amanhã',
      noLocation: 'Defina uma localização para ver o tempo'
    },
    location: {
      searchPlaceholder: 'Pesquisar uma cidade',
      searchButton: 'Pesquisar',
      useMyLocation: 'Usar a minha localização',
      currentLocationName: 'Localização atual',
      gpsDenied: 'O acesso à localização foi negado',
      gpsFailed:
        'Não foi possível determinar a localização — pesquise a sua cidade',
      approximate:
        'Localização aproximada pela rede — pesquise a sua cidade para maior precisão'
    }
  }
}

const ru: Dictionary = {
  common: {
    moreInfo: 'Подробнее'
  },
  dateLine: {
    week: 'Неделя',
    day: 'День',
    of: 'из',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country} (${region})` : country,
    saintSource: (tradition) => `Источник: ${tradition}`
  },
  kiosk: {
    tapToStart: 'Нажмите для полноэкранного режима',
    openSettings: 'Открыть настройки',
    installTip:
      'Совет: добавьте на главный экран, чтобы сохранить полноэкранный режим после перезагрузки',
    enterFullscreen: 'Полноэкранный режим'
  },
  scene: { tapToReturn: 'Нажмите, чтобы вернуться на панель' },
  settings: {
    title: 'Настройки',
    close: 'Закрыть настройки',
    language: { heading: 'Язык' },
    display: {
      heading: 'Экран',
      fullscreenOnStart: 'Включать полноэкранный режим при запуске'
    },
    holidays: {
      heading: 'Праздники',
      country: 'Страна',
      region: 'Регион',
      nationalOnly: 'Только общенациональные праздники',
      extraCountries: 'Дополнительные страны',
      addCountry: 'Добавить страну',
      removeCountry: 'Удалить страну',
      listHeading: 'Праздники в этом году'
    },
    saints: {
      heading: 'Святой дня',
      enable: 'Показывать святого дня',
      tradition: 'Традиция',
      traditionRomanCatholic: 'Римско-католическая',
      traditionFrenchCivil: 'Французский гражданский календарь'
    },
    photos: {
      heading: 'Фото',
      addPhotos: 'Добавить фото',
      deletePhoto: 'Удалить фото',
      empty: 'Пока нет фото',
      rotation: 'Смена фото',
      duration: (n, unit) => `${n} ${unit}`,
      // Russian numeral agreement is a 3-way system (1 / 2-4 / 5-0, with
      // 11-14 always the "many" form) but Dictionary only has a singular/
      // plural slot each. unitMinutes covers 5/10/15/30 correctly (all take
      // genitive plural "минут"). unitHours is used for 2/6/12/24: exact for
      // 6/12 ("часов") but grammatically "часа" for 2/24 — accepted
      // simplification per plan's i18n note rather than a 3-form table for
      // one small label.
      unitMinute: 'минута',
      unitMinutes: 'минут',
      unitHour: 'час',
      unitHours: 'часов',
      dim: 'Затемнение',
      blur: 'Размытие',
      shuffle: 'Случайный порядок фото',
      storageUsage: (used, quota) => `${used} МБ из ${quota} МБ использовано`
    },
    backup: {
      heading: 'Резервное копирование',
      exportButton: 'Экспортировать настройки',
      importButton: 'Импортировать настройки',
      exportSuccess: 'Настройки экспортированы',
      importSuccess: 'Настройки импортированы',
      importErrorPrefix: 'Ошибка импорта'
    }
  },
  status: {
    offline: 'офлайн',
    noDataYet: 'пока нет данных',
    updatedPrefix: 'обновлено',
    relative: {
      justNow: 'только что',
      minutesAgo: (n) => `${n} мин назад`,
      hoursAgo: (n) => `${n} ч назад`,
      yesterday: 'вчера',
      daysAgo: (n) => `${n} дн назад`
    }
  },
  // ru weather vocabulary — flagging for a native-speaker review pass (per plan).
  weather: {
    fetchError: 'Не удалось обновить погоду',
    condition: {
      clearSky: 'Ясное небо',
      mainlyClear: 'Преимущественно ясно',
      partlyCloudy: 'Переменная облачность',
      overcast: 'Пасмурно',
      fog: 'Туман',
      drizzle: 'Морось',
      freezingDrizzle: 'Ледяная морось',
      rain: 'Дождь',
      freezingRain: 'Ледяной дождь',
      snow: 'Снег',
      snowGrains: 'Снежные зёрна',
      rainShowers: 'Ливень',
      snowShowers: 'Снежный ливень',
      thunderstorm: 'Гроза'
    },
    moonPhase: {
      newMoon: 'Новолуние',
      waxingCrescent: 'Растущий серп',
      firstQuarter: 'Первая четверть',
      waxingGibbous: 'Растущая луна',
      fullMoon: 'Полнолуние',
      waningGibbous: 'Убывающая луна',
      lastQuarter: 'Последняя четверть',
      waningCrescent: 'Убывающий серп'
    },
    intensified: {
      drizzle: {
        light: 'Слабая морось',
        moderate: 'Умеренная морось',
        heavy: 'Сильная морось'
      },
      freezingDrizzle: {
        light: 'Слабая ледяная морось',
        heavy: 'Сильная ледяная морось'
      },
      rain: {
        light: 'Слабый дождь',
        moderate: 'Умеренный дождь',
        heavy: 'Сильный дождь'
      },
      freezingRain: {
        light: 'Слабый ледяной дождь',
        heavy: 'Сильный ледяной дождь'
      },
      snow: {
        light: 'Слабый снег',
        moderate: 'Умеренный снег',
        heavy: 'Сильный снег'
      },
      rainShowers: {
        light: 'Слабый ливень',
        moderate: 'Умеренный ливень',
        heavy: 'Сильный ливень'
      },
      snowShowers: {
        light: 'Слабый снежный ливень',
        heavy: 'Сильный снежный ливень'
      }
    },
    thunderstormHail: 'Гроза с градом',
    panel: {
      feelsLike: 'Ощущается как',
      humidity: 'Влажность',
      uvIndex: 'УФ-индекс',
      uvScaleInfo:
        'УФ-индекс (ВОЗ): 0–2 низкий, 3–5 умеренный, 6–7 высокий, 8–10 очень высокий, 11+ экстремальный.',
      wind: 'Ветер',
      force: 'сила',
      windScaleInfo: 'Шкала Бофорта: от 0 (штиль) до 12 (ураганная сила).',
      gusts: 'порывы',
      sunrise: 'Восход',
      sunset: 'Закат',
      daylight: 'Световой день',
      moonPhase: 'Фаза луны',
      moonIllumination: (percent) => `Освещённость ${percent}%`,
      moonNextFull: (days) =>
        days <= 0 ? 'Сегодня полнолуние' : `Полнолуние через ${days} дн`,
      moonNextNew: (days) =>
        days <= 0 ? 'Сегодня новолуние' : `Новолуние через ${days} дн`,
      tomorrow: 'Завтра',
      noLocation: 'Укажите местоположение, чтобы увидеть погоду'
    },
    location: {
      searchPlaceholder: 'Поиск города',
      searchButton: 'Поиск',
      useMyLocation: 'Использовать моё местоположение',
      currentLocationName: 'Текущее местоположение',
      gpsDenied: 'Доступ к местоположению запрещён',
      gpsFailed:
        'Не удалось определить местоположение — найдите свой город через поиск',
      approximate:
        'Приблизительное местоположение по сети — для точности найдите свой город'
    }
  }
}

const zh: Dictionary = {
  // Fixed template constraint, not a translation choice: DateLine.svelte
  // renders `{label} {number}` with no way to put the number inside the
  // phrase (see component) — idiomatic Chinese would write "第34周", which
  // this rigid label-then-number slot can't produce, so noun+number ("周
  // 34") is used instead, same compact-badge pattern as every other locale.
  common: {
    moreInfo: '更多信息'
  },
  dateLine: {
    week: '周',
    day: '天',
    of: '共',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country}（${region}）` : country,
    saintSource: (tradition) => `来源：${tradition}`
  },
  kiosk: {
    tapToStart: '轻触进入全屏',
    openSettings: '打开设置',
    installTip: '提示：添加到主屏幕，刷新后可保持全屏',
    enterFullscreen: '全屏'
  },
  scene: { tapToReturn: '轻触返回仪表盘' },
  settings: {
    title: '设置',
    close: '关闭设置',
    language: { heading: '语言' },
    display: { heading: '显示', fullscreenOnStart: '打开应用时进入全屏' },
    holidays: {
      heading: '节假日',
      country: '国家',
      region: '地区',
      nationalOnly: '仅全国性节假日',
      extraCountries: '其他国家',
      addCountry: '添加国家',
      removeCountry: '移除国家',
      listHeading: '今年的节假日'
    },
    saints: {
      heading: '每日圣人',
      enable: '启用每日圣人',
      tradition: '传统',
      traditionRomanCatholic: '罗马天主教',
      traditionFrenchCivil: '法国公民历'
    },
    photos: {
      heading: '照片',
      addPhotos: '添加照片',
      deletePhoto: '删除照片',
      empty: '暂无照片',
      rotation: '轮播间隔',
      duration: (n, unit) => `${n} ${unit}`,
      // Chinese doesn't inflect nouns for number, so unlike ru/nl/it there's
      // no singular/plural distinction to make — both slots share one word.
      unitMinute: '分钟',
      unitMinutes: '分钟',
      unitHour: '小时',
      unitHours: '小时',
      dim: '变暗',
      blur: '模糊',
      shuffle: '随机播放照片',
      storageUsage: (used, quota) => `已用 ${used} MB，共 ${quota} MB`
    },
    backup: {
      heading: '备份',
      exportButton: '导出设置',
      importButton: '导入设置',
      exportSuccess: '设置已导出',
      importSuccess: '设置已导入',
      importErrorPrefix: '导入失败'
    }
  },
  status: {
    offline: '离线',
    noDataYet: '暂无数据',
    updatedPrefix: '更新于',
    relative: {
      justNow: '刚刚',
      minutesAgo: (n) => `${n} 分钟前`,
      hoursAgo: (n) => `${n} 小时前`,
      yesterday: '昨天',
      daysAgo: (n) => `${n} 天前`
    }
  },
  // zh weather vocabulary — flagging for a native-speaker review pass (per plan).
  weather: {
    fetchError: '无法更新天气',
    condition: {
      clearSky: '晴朗',
      mainlyClear: '大部晴朗',
      partlyCloudy: '局部多云',
      overcast: '阴天',
      fog: '雾',
      drizzle: '毛毛雨',
      freezingDrizzle: '冻毛毛雨',
      rain: '雨',
      freezingRain: '冻雨',
      snow: '雪',
      snowGrains: '米雪',
      rainShowers: '阵雨',
      snowShowers: '阵雪',
      thunderstorm: '雷暴'
    },
    moonPhase: {
      newMoon: '新月',
      waxingCrescent: '峨眉月',
      firstQuarter: '上弦月',
      waxingGibbous: '盈凸月',
      fullMoon: '满月',
      waningGibbous: '亏凸月',
      lastQuarter: '下弦月',
      waningCrescent: '残月'
    },
    intensified: {
      drizzle: { light: '小毛毛雨', moderate: '中毛毛雨', heavy: '大毛毛雨' },
      freezingDrizzle: { light: '小冻毛毛雨', heavy: '大冻毛毛雨' },
      rain: { light: '小雨', moderate: '中雨', heavy: '大雨' },
      freezingRain: { light: '小冻雨', heavy: '大冻雨' },
      snow: { light: '小雪', moderate: '中雪', heavy: '大雪' },
      rainShowers: { light: '小阵雨', moderate: '中阵雨', heavy: '大阵雨' },
      snowShowers: { light: '小阵雪', heavy: '大阵雪' }
    },
    thunderstormHail: '雷暴伴有冰雹',
    panel: {
      feelsLike: '体感温度',
      humidity: '湿度',
      uvIndex: '紫外线指数',
      uvScaleInfo:
        '紫外线指数（世卫组织）：0–2 低，3–5 中等，6–7 高，8–10 很高，11+ 极高。',
      wind: '风',
      force: '风力',
      windScaleInfo: '蒲福风级：0（无风）至12（飓风）。',
      gusts: '阵风',
      sunrise: '日出',
      sunset: '日落',
      daylight: '日照时长',
      moonPhase: '月相',
      moonIllumination: (percent) => `照亮 ${percent}%`,
      moonNextFull: (days) => (days <= 0 ? '今天满月' : `满月还有 ${days} 天`),
      moonNextNew: (days) => (days <= 0 ? '今天新月' : `新月还有 ${days} 天`),
      tomorrow: '明天',
      noLocation: '设置位置以查看天气'
    },
    location: {
      searchPlaceholder: '搜索城市',
      searchButton: '搜索',
      useMyLocation: '使用我的位置',
      currentLocationName: '当前位置',
      gpsDenied: '位置访问被拒绝',
      gpsFailed: '无法确定您的位置，请改为搜索城市',
      approximate: '根据网络估算的大致位置，搜索城市可获得精确位置'
    }
  }
}

const hi: Dictionary = {
  common: {
    moreInfo: 'अधिक जानकारी'
  },
  dateLine: {
    week: 'सप्ताह',
    day: 'दिन',
    of: 'में से',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country} (${region})` : country,
    saintSource: (tradition) => `स्रोत: ${tradition}`
  },
  kiosk: {
    tapToStart: 'फ़ुलस्क्रीन के लिए टैप करें',
    openSettings: 'सेटिंग्स खोलें',
    installTip:
      'सुझाव: रीलोड के बाद भी फ़ुलस्क्रीन बनाए रखने के लिए होम स्क्रीन पर जोड़ें',
    enterFullscreen: 'फ़ुलस्क्रीन'
  },
  scene: { tapToReturn: 'डैशबोर्ड पर वापस जाने के लिए टैप करें' },
  settings: {
    title: 'सेटिंग्स',
    close: 'सेटिंग्स बंद करें',
    language: { heading: 'भाषा' },
    display: {
      heading: 'डिस्प्ले',
      fullscreenOnStart: 'ऐप खुलने पर फ़ुलस्क्रीन करें'
    },
    holidays: {
      heading: 'छुट्टियाँ',
      country: 'देश',
      region: 'क्षेत्र',
      nationalOnly: 'केवल राष्ट्रीय अवकाश',
      extraCountries: 'अतिरिक्त देश',
      addCountry: 'देश जोड़ें',
      removeCountry: 'देश हटाएं',
      listHeading: 'इस वर्ष की छुट्टियाँ'
    },
    saints: {
      heading: 'दिन का संत',
      enable: 'दिन का संत दिखाएं',
      tradition: 'परंपरा',
      traditionRomanCatholic: 'रोमन कैथोलिक',
      traditionFrenchCivil: 'फ्रांसीसी नागरिक कैलेंडर'
    },
    photos: {
      heading: 'फ़ोटो',
      addPhotos: 'फ़ोटो जोड़ें',
      deletePhoto: 'फ़ोटो हटाएं',
      empty: 'अभी तक कोई फ़ोटो नहीं',
      rotation: 'रोटेशन अवधि',
      duration: (n, unit) => `${n} ${unit}`,
      // "मिनट" doesn't inflect for number in common usage, so both minute
      // slots share one word; "घंटा" (hour) does inflect to "घंटे" in the
      // plural, per standard Hindi noun agreement.
      unitMinute: 'मिनट',
      unitMinutes: 'मिनट',
      unitHour: 'घंटा',
      unitHours: 'घंटे',
      dim: 'मंद करें',
      blur: 'ब्लर करें',
      shuffle: 'फ़ोटो शफ़ल करें',
      storageUsage: (used, quota) =>
        `${quota} MB में से ${used} MB इस्तेमाल हुआ`
    },
    backup: {
      heading: 'बैकअप',
      exportButton: 'सेटिंग्स निर्यात करें',
      importButton: 'सेटिंग्स आयात करें',
      exportSuccess: 'सेटिंग्स निर्यात की गईं',
      importSuccess: 'सेटिंग्स आयात की गईं',
      importErrorPrefix: 'आयात विफल'
    }
  },
  status: {
    offline: 'ऑफ़लाइन',
    noDataYet: 'अभी तक कोई डेटा नहीं',
    updatedPrefix: 'अपडेट किया गया',
    relative: {
      justNow: 'अभी अभी',
      minutesAgo: (n) => `${n} मिनट पहले`,
      hoursAgo: (n) => `${n} घंटे पहले`,
      yesterday: 'कल',
      daysAgo: (n) => `${n} दिन पहले`
    }
  },
  // hi weather vocabulary — flagging for a native-speaker review pass (per plan).
  weather: {
    fetchError: 'मौसम अपडेट नहीं हो सका',
    condition: {
      clearSky: 'साफ़ आसमान',
      mainlyClear: 'अधिकतर साफ़',
      partlyCloudy: 'आंशिक रूप से बादल',
      overcast: 'बादल छाए हुए',
      fog: 'कोहरा',
      drizzle: 'बूंदाबांदी',
      freezingDrizzle: 'जमने वाली बूंदाबांदी',
      rain: 'बारिश',
      freezingRain: 'जमने वाली बारिश',
      snow: 'बर्फ़',
      snowGrains: 'बर्फ़ के कण',
      rainShowers: 'बारिश की बौछारें',
      snowShowers: 'बर्फ़ की बौछारें',
      thunderstorm: 'गरज के साथ तूफ़ान'
    },
    moonPhase: {
      newMoon: 'अमावस्या',
      waxingCrescent: 'बढ़ता हुआ अर्धचंद्र',
      firstQuarter: 'पहला चौथाई चाँद',
      waxingGibbous: 'बढ़ता हुआ चाँद',
      fullMoon: 'पूर्णिमा',
      waningGibbous: 'घटता हुआ चाँद',
      lastQuarter: 'आखिरी चौथाई चाँद',
      waningCrescent: 'घटता हुआ अर्धचंद्र'
    },
    intensified: {
      drizzle: {
        light: 'हल्की बूंदाबांदी',
        moderate: 'मध्यम बूंदाबांदी',
        heavy: 'भारी बूंदाबांदी'
      },
      freezingDrizzle: {
        light: 'हल्की जमने वाली बूंदाबांदी',
        heavy: 'भारी जमने वाली बूंदाबांदी'
      },
      rain: {
        light: 'हल्की बारिश',
        moderate: 'मध्यम बारिश',
        heavy: 'भारी बारिश'
      },
      freezingRain: {
        light: 'हल्की जमने वाली बारिश',
        heavy: 'भारी जमने वाली बारिश'
      },
      snow: {
        light: 'हल्की बर्फ़',
        moderate: 'मध्यम बर्फ़',
        heavy: 'भारी बर्फ़'
      },
      rainShowers: {
        light: 'हल्की बारिश की बौछारें',
        moderate: 'मध्यम बारिश की बौछारें',
        heavy: 'भारी बारिश की बौछारें'
      },
      snowShowers: {
        light: 'हल्की बर्फ़ की बौछारें',
        heavy: 'भारी बर्फ़ की बौछारें'
      }
    },
    thunderstormHail: 'गरज और ओलों के साथ तूफ़ान',
    panel: {
      feelsLike: 'अनुभव तापमान',
      humidity: 'नमी',
      uvIndex: 'यूवी इंडेक्स',
      uvScaleInfo:
        'यूवी इंडेक्स (WHO): 0–2 कम, 3–5 मध्यम, 6–7 उच्च, 8–10 बहुत उच्च, 11+ अत्यधिक।',
      wind: 'हवा',
      force: 'गति',
      windScaleInfo: 'ब्यूफोर्ट स्केल: 0 (शांत) से 12 (तूफानी शक्ति) तक।',
      gusts: 'झोंके',
      sunrise: 'सूर्योदय',
      sunset: 'सूर्यास्त',
      daylight: 'दिन की रोशनी',
      moonPhase: 'चंद्र कला',
      moonIllumination: (percent) => `${percent}% रोशन`,
      moonNextFull: (days) =>
        days <= 0 ? 'आज पूर्णिमा' : `पूर्णिमा ${days} दिन में`,
      moonNextNew: (days) =>
        days <= 0 ? 'आज अमावस्या' : `अमावस्या ${days} दिन में`,
      tomorrow: 'कल',
      noLocation: 'मौसम देखने के लिए स्थान सेट करें'
    },
    location: {
      searchPlaceholder: 'शहर खोजें',
      searchButton: 'खोजें',
      useMyLocation: 'मेरा स्थान उपयोग करें',
      currentLocationName: 'वर्तमान स्थान',
      gpsDenied: 'स्थान की अनुमति अस्वीकार कर दी गई',
      gpsFailed: 'आपका स्थान निर्धारित नहीं हो सका — इसके बजाय अपना शहर खोजें',
      approximate:
        'आपके नेटवर्क से अनुमानित स्थान — सटीकता के लिए अपना शहर खोजें'
    }
  }
}

const ar: Dictionary = {
  common: {
    moreInfo: 'معلومات إضافية'
  },
  dateLine: {
    week: 'الأسبوع',
    day: 'اليوم',
    of: 'من',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country} (${region})` : country,
    saintSource: (tradition) => `المصدر: ${tradition}`
  },
  kiosk: {
    tapToStart: 'اضغط للانتقال إلى وضع ملء الشاشة',
    openSettings: 'فتح الإعدادات',
    installTip:
      'نصيحة: أضف التطبيق إلى الشاشة الرئيسية للبقاء في وضع ملء الشاشة بعد إعادة التحميل',
    enterFullscreen: 'ملء الشاشة'
  },
  scene: { tapToReturn: 'اضغط للعودة إلى لوحة المعلومات' },
  settings: {
    title: 'الإعدادات',
    close: 'إغلاق الإعدادات',
    language: { heading: 'اللغة' },
    display: {
      heading: 'العرض',
      fullscreenOnStart: 'ملء الشاشة عند فتح التطبيق'
    },
    holidays: {
      heading: 'الأعياد',
      country: 'الدولة',
      region: 'المنطقة',
      nationalOnly: 'الأعياد الوطنية فقط',
      extraCountries: 'دول إضافية',
      addCountry: 'إضافة دولة',
      removeCountry: 'إزالة الدولة',
      listHeading: 'أعياد هذا العام'
    },
    saints: {
      heading: 'قديس اليوم',
      enable: 'تفعيل قديس اليوم',
      tradition: 'التقليد',
      traditionRomanCatholic: 'كاثوليكي روماني',
      traditionFrenchCivil: 'التقويم المدني الفرنسي'
    },
    photos: {
      heading: 'الصور',
      addPhotos: 'إضافة صور',
      deletePhoto: 'حذف الصورة',
      empty: 'لا توجد صور بعد',
      rotation: 'التبديل',
      duration: (n, unit) => `${n} ${unit}`,
      unitMinute: 'دقيقة',
      unitMinutes: 'دقائق',
      unitHour: 'ساعة',
      unitHours: 'ساعات',
      dim: 'تعتيم',
      blur: 'تمويه',
      shuffle: 'ترتيب عشوائي للصور',
      storageUsage: (used, quota) => `${used} م.ب من ${quota} م.ب مستخدمة`
    },
    backup: {
      heading: 'النسخ الاحتياطي',
      exportButton: 'تصدير الإعدادات',
      importButton: 'استيراد الإعدادات',
      exportSuccess: 'تم تصدير الإعدادات',
      importSuccess: 'تم استيراد الإعدادات',
      importErrorPrefix: 'فشل الاستيراد'
    }
  },
  status: {
    offline: 'غير متصل',
    noDataYet: 'لا توجد بيانات بعد',
    updatedPrefix: 'آخر تحديث',
    relative: {
      justNow: 'الآن',
      minutesAgo: (n) => `منذ ${n} د`,
      hoursAgo: (n) => `منذ ${n} س`,
      yesterday: 'الأمس',
      daysAgo: (n) => `منذ ${n} يوم`
    }
  },
  weather: {
    fetchError: 'تعذّر تحديث حالة الطقس',
    condition: {
      clearSky: 'سماء صافية',
      mainlyClear: 'صافٍ غالبًا',
      partlyCloudy: 'غائم جزئيًا',
      overcast: 'ملبد بالغيوم',
      fog: 'ضباب',
      drizzle: 'رذاذ',
      freezingDrizzle: 'رذاذ متجمد',
      rain: 'مطر',
      freezingRain: 'مطر متجمد',
      snow: 'ثلج',
      snowGrains: 'حبيبات ثلجية',
      rainShowers: 'زخات مطر',
      snowShowers: 'زخات ثلجية',
      thunderstorm: 'عاصفة رعدية'
    },
    moonPhase: {
      newMoon: 'محاق',
      waxingCrescent: 'هلال متزايد',
      firstQuarter: 'التربيع الأول',
      waxingGibbous: 'أحدب متزايد',
      fullMoon: 'بدر',
      waningGibbous: 'أحدب متناقص',
      lastQuarter: 'التربيع الأخير',
      waningCrescent: 'هلال متناقص'
    },
    intensified: {
      drizzle: {
        light: 'رذاذ خفيف',
        moderate: 'رذاذ متوسط',
        heavy: 'رذاذ كثيف'
      },
      freezingDrizzle: {
        light: 'رذاذ متجمد خفيف',
        heavy: 'رذاذ متجمد كثيف'
      },
      rain: {
        light: 'مطر خفيف',
        moderate: 'مطر متوسط',
        heavy: 'مطر غزير'
      },
      freezingRain: {
        light: 'مطر متجمد خفيف',
        heavy: 'مطر متجمد غزير'
      },
      snow: {
        light: 'ثلج خفيف',
        moderate: 'ثلج متوسط',
        heavy: 'ثلج كثيف'
      },
      rainShowers: {
        light: 'زخات مطر خفيفة',
        moderate: 'زخات مطر متوسطة',
        heavy: 'زخات مطر غزيرة'
      },
      snowShowers: { light: 'زخات ثلجية خفيفة', heavy: 'زخات ثلجية كثيفة' }
    },
    thunderstormHail: 'عاصفة رعدية مصحوبة بالبرد',
    panel: {
      feelsLike: 'الشعور بالحرارة',
      humidity: 'الرطوبة',
      uvIndex: 'مؤشر الأشعة فوق البنفسجية',
      uvScaleInfo:
        'مؤشر الأشعة فوق البنفسجية (منظمة الصحة العالمية): 0–2 منخفض، 3–5 متوسط، 6–7 مرتفع، 8–10 مرتفع جدًا، 11+ شديد.',
      wind: 'الرياح',
      force: 'قوة',
      windScaleInfo: 'مقياس بوفورت: من 0 (هادئ) إلى 12 (قوة إعصار).',
      gusts: 'هبات',
      sunrise: 'شروق الشمس',
      sunset: 'غروب الشمس',
      daylight: 'مدة النهار',
      moonPhase: 'طور القمر',
      moonIllumination: (percent) => `إضاءة ${percent}%`,
      moonNextFull: (days) =>
        days <= 0 ? 'بدر اليوم' : `البدر بعد ${days} يوم`,
      moonNextNew: (days) =>
        days <= 0 ? 'محاق اليوم' : `المحاق بعد ${days} يوم`,
      tomorrow: 'غدًا',
      noLocation: 'حدّد موقعًا لرؤية حالة الطقس'
    },
    location: {
      searchPlaceholder: 'البحث عن مدينة',
      searchButton: 'بحث',
      useMyLocation: 'استخدام موقعي',
      currentLocationName: 'الموقع الحالي',
      gpsDenied: 'تم رفض الوصول إلى الموقع',
      gpsFailed: 'تعذّر تحديد موقعك — ابحث عن مدينتك بدلاً من ذلك',
      approximate: 'موقع تقريبي من شبكتك — ابحث عن مدينتك لمزيد من الدقة'
    }
  }
}

const bn: Dictionary = {
  common: {
    moreInfo: 'আরও তথ্য'
  },
  dateLine: {
    week: 'সপ্তাহ',
    day: 'দিন',
    of: 'এর মধ্যে',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country} (${region})` : country,
    saintSource: (tradition) => `উৎস: ${tradition}`
  },
  kiosk: {
    tapToStart: 'ফুলস্ক্রিনে যেতে ট্যাপ করুন',
    openSettings: 'সেটিংস খুলুন',
    installTip:
      'পরামর্শ: রিলোডের পরেও ফুলস্ক্রিন রাখতে হোম স্ক্রিনে যুক্ত করুন',
    enterFullscreen: 'ফুলস্ক্রিন করুন'
  },
  scene: { tapToReturn: 'ড্যাশবোর্ডে ফিরতে ট্যাপ করুন' },
  settings: {
    title: 'সেটিংস',
    close: 'সেটিংস বন্ধ করুন',
    language: { heading: 'ভাষা' },
    display: {
      heading: 'ডিসপ্লে',
      fullscreenOnStart: 'অ্যাপ খোলার সময় ফুলস্ক্রিন করুন'
    },
    holidays: {
      heading: 'ছুটির দিন',
      country: 'দেশ',
      region: 'অঞ্চল',
      nationalOnly: 'শুধু জাতীয় ছুটির দিন',
      extraCountries: 'অতিরিক্ত দেশ',
      addCountry: 'দেশ যুক্ত করুন',
      removeCountry: 'দেশ অপসারণ করুন',
      listHeading: 'এই বছরের ছুটির দিন'
    },
    saints: {
      heading: 'দিনের সাধু',
      enable: 'দিনের সাধু সক্রিয় করুন',
      tradition: 'ধারা',
      traditionRomanCatholic: 'রোমান ক্যাথলিক',
      traditionFrenchCivil: 'ফরাসি নাগরিক ক্যালেন্ডার'
    },
    photos: {
      heading: 'ছবি',
      addPhotos: 'ছবি যুক্ত করুন',
      deletePhoto: 'ছবি মুছুন',
      empty: 'এখনও কোনো ছবি নেই',
      rotation: 'ঘূর্ণন',
      duration: (n, unit) => `${n} ${unit}`,
      unitMinute: 'মিনিট',
      unitMinutes: 'মিনিট',
      unitHour: 'ঘণ্টা',
      unitHours: 'ঘণ্টা',
      dim: 'অন্ধকার করুন',
      blur: 'ব্লার',
      shuffle: 'ছবি শাফল করুন',
      storageUsage: (used, quota) => `${quota} এমবির মধ্যে ${used} এমবি ব্যবহৃত`
    },
    backup: {
      heading: 'ব্যাকআপ',
      exportButton: 'সেটিংস এক্সপোর্ট করুন',
      importButton: 'সেটিংস ইমপোর্ট করুন',
      exportSuccess: 'সেটিংস এক্সপোর্ট হয়েছে',
      importSuccess: 'সেটিংস ইমপোর্ট হয়েছে',
      importErrorPrefix: 'ইমপোর্ট ব্যর্থ হয়েছে'
    }
  },
  status: {
    offline: 'অফলাইন',
    noDataYet: 'এখনও কোনো তথ্য নেই',
    updatedPrefix: 'আপডেট হয়েছে',
    relative: {
      justNow: 'এইমাত্র',
      minutesAgo: (n) => `${n} মিনিট আগে`,
      hoursAgo: (n) => `${n} ঘণ্টা আগে`,
      yesterday: 'গতকাল',
      daysAgo: (n) => `${n} দিন আগে`
    }
  },
  weather: {
    fetchError: 'আবহাওয়া আপডেট করা যায়নি',
    condition: {
      clearSky: 'পরিষ্কার আকাশ',
      mainlyClear: 'প্রধানত পরিষ্কার',
      partlyCloudy: 'আংশিক মেঘলা',
      overcast: 'মেঘলা',
      fog: 'কুয়াশা',
      drizzle: 'গুঁড়ি গুঁড়ি বৃষ্টি',
      freezingDrizzle: 'হিমায়িত গুঁড়ি বৃষ্টি',
      rain: 'বৃষ্টি',
      freezingRain: 'হিমায়িত বৃষ্টি',
      snow: 'তুষার',
      snowGrains: 'তুষার দানা',
      rainShowers: 'বৃষ্টির ঝাপটা',
      snowShowers: 'তুষারের ঝাপটা',
      thunderstorm: 'বজ্রঝড়'
    },
    moonPhase: {
      newMoon: 'অমাবস্যা',
      waxingCrescent: 'বর্ধনশীল অর্ধচন্দ্র',
      firstQuarter: 'প্রথম কোয়ার্টার',
      waxingGibbous: 'বর্ধনশীল উদ্বৃত্ত চন্দ্র',
      fullMoon: 'পূর্ণিমা',
      waningGibbous: 'ক্ষয়িষ্ণু উদ্বৃত্ত চন্দ্র',
      lastQuarter: 'শেষ কোয়ার্টার',
      waningCrescent: 'ক্ষয়িষ্ণু অর্ধচন্দ্র'
    },
    intensified: {
      drizzle: {
        light: 'হালকা গুঁড়ি বৃষ্টি',
        moderate: 'মাঝারি গুঁড়ি বৃষ্টি',
        heavy: 'ভারী গুঁড়ি বৃষ্টি'
      },
      freezingDrizzle: {
        light: 'হালকা হিমায়িত গুঁড়ি বৃষ্টি',
        heavy: 'ভারী হিমায়িত গুঁড়ি বৃষ্টি'
      },
      rain: {
        light: 'হালকা বৃষ্টি',
        moderate: 'মাঝারি বৃষ্টি',
        heavy: 'ভারী বৃষ্টি'
      },
      freezingRain: {
        light: 'হালকা হিমায়িত বৃষ্টি',
        heavy: 'ভারী হিমায়িত বৃষ্টি'
      },
      snow: {
        light: 'হালকা তুষার',
        moderate: 'মাঝারি তুষার',
        heavy: 'ভারী তুষার'
      },
      rainShowers: {
        light: 'হালকা বৃষ্টির ঝাপটা',
        moderate: 'মাঝারি বৃষ্টির ঝাপটা',
        heavy: 'ভারী বৃষ্টির ঝাপটা'
      },
      snowShowers: {
        light: 'হালকা তুষারের ঝাপটা',
        heavy: 'ভারী তুষারের ঝাপটা'
      }
    },
    thunderstormHail: 'শিলাবৃষ্টি সহ বজ্রঝড়',
    panel: {
      feelsLike: 'অনুভূত হচ্ছে',
      humidity: 'আর্দ্রতা',
      uvIndex: 'ইউভি সূচক',
      uvScaleInfo:
        'ইউভি সূচক (WHO): 0–2 কম, 3–5 মাঝারি, 6–7 উচ্চ, 8–10 অতি উচ্চ, 11+ চরম।',
      wind: 'বাতাস',
      force: 'শক্তি',
      windScaleInfo:
        'বিউফোর্ট স্কেল: 0 (শান্ত) থেকে 12 (ঘূর্ণিঝড় শক্তি) পর্যন্ত।',
      gusts: 'ঝাপটা',
      sunrise: 'সূর্যোদয়',
      sunset: 'সূর্যাস্ত',
      daylight: 'দিনের আলো',
      moonPhase: 'চন্দ্রকলা',
      moonIllumination: (percent) => `${percent}% আলোকিত`,
      moonNextFull: (days) =>
        days <= 0 ? 'আজ পূর্ণিমা' : `${days} দিনে পূর্ণিমা`,
      moonNextNew: (days) =>
        days <= 0 ? 'আজ অমাবস্যা' : `${days} দিনে অমাবস্যা`,
      tomorrow: 'আগামীকাল',
      noLocation: 'আবহাওয়া দেখতে একটি স্থান নির্ধারণ করুন'
    },
    location: {
      searchPlaceholder: 'একটি শহর খুঁজুন',
      searchButton: 'অনুসন্ধান',
      useMyLocation: 'আমার অবস্থান ব্যবহার করুন',
      currentLocationName: 'বর্তমান অবস্থান',
      gpsDenied: 'অবস্থান অ্যাক্সেস প্রত্যাখ্যান করা হয়েছে',
      gpsFailed:
        'আপনার অবস্থান নির্ধারণ করা যায়নি — পরিবর্তে আপনার শহর খুঁজুন',
      approximate:
        'আপনার নেটওয়ার্ক থেকে আনুমানিক অবস্থান — সঠিকতার জন্য আপনার শহর খুঁজুন'
    }
  }
}

const ur: Dictionary = {
  common: {
    moreInfo: 'مزید معلومات'
  },
  dateLine: {
    week: 'ہفتہ',
    day: 'دن',
    of: 'از',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country} (${region})` : country,
    saintSource: (tradition) => `ماخذ: ${tradition}`
  },
  kiosk: {
    tapToStart: 'فل اسکرین کے لیے ٹیپ کریں',
    openSettings: 'ترتیبات کھولیں',
    installTip:
      'مشورہ: ری لوڈ کے بعد بھی فل اسکرین برقرار رکھنے کے لیے ہوم اسکرین پر شامل کریں',
    enterFullscreen: 'فل اسکرین کریں'
  },
  scene: { tapToReturn: 'ڈیش بورڈ پر واپس جانے کے لیے ٹیپ کریں' },
  settings: {
    title: 'ترتیبات',
    close: 'ترتیبات بند کریں',
    language: { heading: 'زبان' },
    display: {
      heading: 'ڈسپلے',
      fullscreenOnStart: 'ایپ کھلنے پر فل اسکرین کریں'
    },
    holidays: {
      heading: 'تعطیلات',
      country: 'ملک',
      region: 'علاقہ',
      nationalOnly: 'صرف قومی تعطیلات',
      extraCountries: 'اضافی ممالک',
      addCountry: 'ملک شامل کریں',
      removeCountry: 'ملک ہٹائیں',
      listHeading: 'اس سال کی تعطیلات'
    },
    saints: {
      heading: 'دن کا سینٹ',
      enable: 'دن کا سینٹ فعال کریں',
      tradition: 'روایت',
      traditionRomanCatholic: 'رومن کیتھولک',
      traditionFrenchCivil: 'فرانسیسی سویلین کیلنڈر'
    },
    photos: {
      heading: 'تصاویر',
      addPhotos: 'تصاویر شامل کریں',
      deletePhoto: 'تصویر حذف کریں',
      empty: 'ابھی کوئی تصویر نہیں',
      rotation: 'گردش',
      duration: (n, unit) => `${n} ${unit}`,
      unitMinute: 'منٹ',
      unitMinutes: 'منٹ',
      unitHour: 'گھنٹہ',
      unitHours: 'گھنٹے',
      dim: 'دھیما کریں',
      blur: 'دھندلا',
      shuffle: 'تصاویر بے ترتیب کریں',
      storageUsage: (used, quota) =>
        `${quota} ایم بی میں سے ${used} ایم بی استعمال شدہ`
    },
    backup: {
      heading: 'بیک اپ',
      exportButton: 'ترتیبات ایکسپورٹ کریں',
      importButton: 'ترتیبات امپورٹ کریں',
      exportSuccess: 'ترتیبات ایکسپورٹ ہو گئیں',
      importSuccess: 'ترتیبات امپورٹ ہو گئیں',
      importErrorPrefix: 'امپورٹ ناکام ہوگئی'
    }
  },
  status: {
    offline: 'آف لائن',
    noDataYet: 'ابھی کوئی ڈیٹا نہیں',
    updatedPrefix: 'تازہ کاری',
    relative: {
      justNow: 'ابھی ابھی',
      minutesAgo: (n) => `${n} منٹ پہلے`,
      hoursAgo: (n) => `${n} گھنٹے پہلے`,
      yesterday: 'گزشتہ روز',
      daysAgo: (n) => `${n} دن پہلے`
    }
  },
  weather: {
    fetchError: 'موسم کو اپ ڈیٹ نہیں کیا جا سکا',
    condition: {
      clearSky: 'صاف آسمان',
      mainlyClear: 'زیادہ تر صاف',
      partlyCloudy: 'جزوی ابر آلود',
      overcast: 'ابر آلود',
      fog: 'دھند',
      drizzle: 'بوندا باندی',
      freezingDrizzle: 'منجمد بوندا باندی',
      rain: 'بارش',
      freezingRain: 'منجمد بارش',
      snow: 'برف',
      snowGrains: 'برف کے ذرات',
      rainShowers: 'بارش کی جھڑی',
      snowShowers: 'برف کی جھڑی',
      thunderstorm: 'گرج چمک کا طوفان'
    },
    moonPhase: {
      newMoon: 'نیا چاند',
      waxingCrescent: 'بڑھتا ہلال',
      firstQuarter: 'پہلی سہ ماہی',
      waxingGibbous: 'بڑھتا محدب چاند',
      fullMoon: 'مکمل چاند',
      waningGibbous: 'گھٹتا محدب چاند',
      lastQuarter: 'آخری سہ ماہی',
      waningCrescent: 'گھٹتا ہلال'
    },
    intensified: {
      drizzle: {
        light: 'ہلکی بوندا باندی',
        moderate: 'معتدل بوندا باندی',
        heavy: 'شدید بوندا باندی'
      },
      freezingDrizzle: {
        light: 'ہلکی منجمد بوندا باندی',
        heavy: 'شدید منجمد بوندا باندی'
      },
      rain: {
        light: 'ہلکی بارش',
        moderate: 'معتدل بارش',
        heavy: 'شدید بارش'
      },
      freezingRain: {
        light: 'ہلکی منجمد بارش',
        heavy: 'شدید منجمد بارش'
      },
      snow: {
        light: 'ہلکی برف',
        moderate: 'معتدل برف',
        heavy: 'شدید برف'
      },
      rainShowers: {
        light: 'ہلکی بارش کی جھڑی',
        moderate: 'معتدل بارش کی جھڑی',
        heavy: 'شدید بارش کی جھڑی'
      },
      snowShowers: { light: 'ہلکی برف کی جھڑی', heavy: 'شدید برف کی جھڑی' }
    },
    thunderstormHail: 'ژالہ باری کے ساتھ گرج چمک کا طوفان',
    panel: {
      feelsLike: 'محسوس ہونے والا درجہ حرارت',
      humidity: 'نمی',
      uvIndex: 'یووی انڈیکس',
      uvScaleInfo:
        'یووی انڈیکس (WHO): 0–2 کم، 3–5 معتدل، 6–7 زیادہ، 8–10 بہت زیادہ، 11+ انتہائی۔',
      wind: 'ہوا',
      force: 'شدت',
      windScaleInfo: 'بیوفورٹ اسکیل: 0 (پرسکون) سے 12 (طوفانی شدت) تک۔',
      gusts: 'جھونکے',
      sunrise: 'طلوع آفتاب',
      sunset: 'غروب آفتاب',
      daylight: 'دن کی روشنی',
      moonPhase: 'چاند کا مرحلہ',
      moonIllumination: (percent) => `${percent}% روشن`,
      moonNextFull: (days) =>
        days <= 0 ? 'آج مکمل چاند ہے' : `${days} دن میں مکمل چاند`,
      moonNextNew: (days) =>
        days <= 0 ? 'آج نیا چاند ہے' : `${days} دن میں نیا چاند`,
      tomorrow: 'کل',
      noLocation: 'موسم دیکھنے کے لیے مقام مقرر کریں'
    },
    location: {
      searchPlaceholder: 'شہر تلاش کریں',
      searchButton: 'تلاش',
      useMyLocation: 'میرا مقام استعمال کریں',
      currentLocationName: 'موجودہ مقام',
      gpsDenied: 'مقام تک رسائی سے انکار کر دیا گیا',
      gpsFailed:
        'آپ کا مقام معلوم نہیں ہو سکا — اس کے بجائے اپنا شہر تلاش کریں',
      approximate:
        'آپ کے نیٹ ورک سے تخمینی مقام — درستگی کے لیے اپنا شہر تلاش کریں'
    }
  }
}

const id: Dictionary = {
  common: {
    moreInfo: 'Info lebih lanjut'
  },
  dateLine: {
    week: 'Minggu',
    day: 'Hari',
    of: 'dari',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country} (${region})` : country,
    saintSource: (tradition) => `Sumber: ${tradition}`
  },
  kiosk: {
    tapToStart: 'Ketuk untuk masuk mode layar penuh',
    openSettings: 'Buka pengaturan',
    installTip:
      'Tips: tambahkan ke layar utama agar tetap layar penuh setelah dimuat ulang',
    enterFullscreen: 'Masuk layar penuh'
  },
  scene: { tapToReturn: 'Ketuk untuk kembali ke dasbor' },
  settings: {
    title: 'Pengaturan',
    close: 'Tutup pengaturan',
    language: { heading: 'Bahasa' },
    display: {
      heading: 'Tampilan',
      fullscreenOnStart: 'Masuk layar penuh saat aplikasi dibuka'
    },
    holidays: {
      heading: 'Hari libur',
      country: 'Negara',
      region: 'Wilayah',
      nationalOnly: 'Hanya hari libur nasional',
      extraCountries: 'Negara tambahan',
      addCountry: 'Tambah negara',
      removeCountry: 'Hapus negara',
      listHeading: 'Hari libur tahun ini'
    },
    saints: {
      heading: 'Santo/santa hari ini',
      enable: 'Aktifkan santo/santa hari ini',
      tradition: 'Tradisi',
      traditionRomanCatholic: 'Katolik Roma',
      traditionFrenchCivil: 'Kalender sipil Prancis'
    },
    photos: {
      heading: 'Foto',
      addPhotos: 'Tambah foto',
      deletePhoto: 'Hapus foto',
      empty: 'Belum ada foto',
      rotation: 'Rotasi',
      duration: (n, unit) => `${n} ${unit}`,
      unitMinute: 'menit',
      unitMinutes: 'menit',
      unitHour: 'jam',
      unitHours: 'jam',
      dim: 'Redupkan',
      blur: 'Buram',
      shuffle: 'Acak foto',
      storageUsage: (used, quota) => `${used} MB dari ${quota} MB terpakai`
    },
    backup: {
      heading: 'Cadangan',
      exportButton: 'Ekspor pengaturan',
      importButton: 'Impor pengaturan',
      exportSuccess: 'Pengaturan diekspor',
      importSuccess: 'Pengaturan diimpor',
      importErrorPrefix: 'Impor gagal'
    }
  },
  status: {
    offline: 'luring',
    noDataYet: 'belum ada data',
    updatedPrefix: 'diperbarui',
    relative: {
      justNow: 'baru saja',
      minutesAgo: (n) => `${n} mnt lalu`,
      hoursAgo: (n) => `${n} jam lalu`,
      yesterday: 'kemarin',
      daysAgo: (n) => `${n} hr lalu`
    }
  },
  weather: {
    fetchError: 'Tidak dapat memperbarui cuaca',
    condition: {
      clearSky: 'Cerah',
      mainlyClear: 'Sebagian besar cerah',
      partlyCloudy: 'Berawan sebagian',
      overcast: 'Berawan tebal',
      fog: 'Berkabut',
      drizzle: 'Gerimis',
      freezingDrizzle: 'Gerimis beku',
      rain: 'Hujan',
      freezingRain: 'Hujan beku',
      snow: 'Salju',
      snowGrains: 'Butiran salju',
      rainShowers: 'Hujan lokal',
      snowShowers: 'Hujan salju lokal',
      thunderstorm: 'Badai petir'
    },
    moonPhase: {
      newMoon: 'Bulan baru',
      waxingCrescent: 'Sabit bertambah',
      firstQuarter: 'Kuartal pertama',
      waxingGibbous: 'Cembung bertambah',
      fullMoon: 'Bulan purnama',
      waningGibbous: 'Cembung berkurang',
      lastQuarter: 'Kuartal akhir',
      waningCrescent: 'Sabit berkurang'
    },
    intensified: {
      drizzle: {
        light: 'Gerimis ringan',
        moderate: 'Gerimis sedang',
        heavy: 'Gerimis lebat'
      },
      freezingDrizzle: {
        light: 'Gerimis beku ringan',
        heavy: 'Gerimis beku lebat'
      },
      rain: {
        light: 'Hujan ringan',
        moderate: 'Hujan sedang',
        heavy: 'Hujan lebat'
      },
      freezingRain: {
        light: 'Hujan beku ringan',
        heavy: 'Hujan beku lebat'
      },
      snow: {
        light: 'Salju ringan',
        moderate: 'Salju sedang',
        heavy: 'Salju lebat'
      },
      rainShowers: {
        light: 'Hujan lokal ringan',
        moderate: 'Hujan lokal sedang',
        heavy: 'Hujan lokal lebat'
      },
      snowShowers: {
        light: 'Hujan salju lokal ringan',
        heavy: 'Hujan salju lokal lebat'
      }
    },
    thunderstormHail: 'Badai petir disertai hujan es',
    panel: {
      feelsLike: 'Terasa seperti',
      humidity: 'Kelembapan',
      uvIndex: 'Indeks UV',
      uvScaleInfo:
        'Indeks UV (WHO): 0–2 rendah, 3–5 sedang, 6–7 tinggi, 8–10 sangat tinggi, 11+ ekstrem.',
      wind: 'Angin',
      force: 'kekuatan',
      windScaleInfo:
        'Skala Beaufort: dari 0 (tenang) hingga 12 (kekuatan badai).',
      gusts: 'hembusan',
      sunrise: 'Matahari terbit',
      sunset: 'Matahari terbenam',
      daylight: 'Lama siang',
      moonPhase: 'Fase bulan',
      moonIllumination: (percent) => `${percent}% tersinari`,
      moonNextFull: (days) =>
        days <= 0 ? 'Purnama hari ini' : `Purnama dalam ${days} hari`,
      moonNextNew: (days) =>
        days <= 0 ? 'Bulan baru hari ini' : `Bulan baru dalam ${days} hari`,
      tomorrow: 'Besok',
      noLocation: 'Atur lokasi untuk melihat cuaca'
    },
    location: {
      searchPlaceholder: 'Cari kota',
      searchButton: 'Cari',
      useMyLocation: 'Gunakan lokasi saya',
      currentLocationName: 'Lokasi saat ini',
      gpsDenied: 'Akses lokasi ditolak',
      gpsFailed: 'Tidak dapat menentukan lokasi Anda — coba cari kota Anda',
      approximate:
        'Lokasi perkiraan dari jaringan Anda — cari kota Anda untuk hasil yang lebih akurat'
    }
  }
}

const ja: Dictionary = {
  common: {
    moreInfo: '詳細情報'
  },
  dateLine: {
    week: '週',
    day: '日目',
    of: '／',
    more: (n) => `+${n}`,
    holidayOrigin: (country, region) =>
      region ? `${country}（${region}）` : country,
    saintSource: (tradition) => `出典: ${tradition}`
  },
  kiosk: {
    tapToStart: 'タップして全画面表示にする',
    openSettings: '設定を開く',
    installTip:
      'ヒント: 再読み込み後も全画面表示を保つには、ホーム画面に追加してください',
    enterFullscreen: '全画面表示にする'
  },
  scene: { tapToReturn: 'タップしてダッシュボードに戻る' },
  settings: {
    title: '設定',
    close: '設定を閉じる',
    language: { heading: '言語' },
    display: {
      heading: '表示',
      fullscreenOnStart: 'アプリ起動時に全画面表示にする'
    },
    holidays: {
      heading: '祝日',
      country: '国',
      region: '地域',
      nationalOnly: '国民の祝日のみ',
      extraCountries: '追加の国',
      addCountry: '国を追加',
      removeCountry: '国を削除',
      listHeading: '今年の祝日'
    },
    saints: {
      heading: '今日の聖人',
      enable: '今日の聖人を表示する',
      tradition: '伝統',
      traditionRomanCatholic: 'ローマ・カトリック',
      traditionFrenchCivil: 'フランス民間暦'
    },
    photos: {
      heading: '写真',
      addPhotos: '写真を追加',
      deletePhoto: '写真を削除',
      empty: 'まだ写真がありません',
      rotation: '切り替え間隔',
      duration: (n, unit) => `${n}${unit}`,
      unitMinute: '分',
      unitMinutes: '分',
      unitHour: '時間',
      unitHours: '時間',
      dim: '暗さ',
      blur: 'ぼかし',
      shuffle: '写真をシャッフル',
      storageUsage: (used, quota) => `${quota}MBのうち${used}MB使用`
    },
    backup: {
      heading: 'バックアップ',
      exportButton: '設定を書き出す',
      importButton: '設定を読み込む',
      exportSuccess: '設定を書き出しました',
      importSuccess: '設定を読み込みました',
      importErrorPrefix: '読み込みに失敗しました'
    }
  },
  status: {
    offline: 'オフライン',
    noDataYet: 'データなし',
    updatedPrefix: '更新',
    relative: {
      justNow: 'たった今',
      minutesAgo: (n) => `${n}分前`,
      hoursAgo: (n) => `${n}時間前`,
      yesterday: '昨日',
      daysAgo: (n) => `${n}日前`
    }
  },
  weather: {
    fetchError: '天気を更新できませんでした',
    condition: {
      clearSky: '快晴',
      mainlyClear: 'ほぼ晴れ',
      partlyCloudy: '所々曇り',
      overcast: '曇り',
      fog: '霧',
      drizzle: '霧雨',
      freezingDrizzle: '着氷性の霧雨',
      rain: '雨',
      freezingRain: '着氷性の雨',
      snow: '雪',
      snowGrains: '細氷',
      rainShowers: 'にわか雨',
      snowShowers: 'にわか雪',
      thunderstorm: '雷雨'
    },
    moonPhase: {
      newMoon: '新月',
      waxingCrescent: '三日月',
      firstQuarter: '上弦の月',
      waxingGibbous: '満ちゆく月',
      fullMoon: '満月',
      waningGibbous: '欠けゆく月',
      lastQuarter: '下弦の月',
      waningCrescent: '有明月'
    },
    intensified: {
      drizzle: {
        light: '弱い霧雨',
        moderate: 'やや強い霧雨',
        heavy: '強い霧雨'
      },
      freezingDrizzle: {
        light: '弱い着氷性の霧雨',
        heavy: '強い着氷性の霧雨'
      },
      rain: {
        light: '弱い雨',
        moderate: 'やや強い雨',
        heavy: '強い雨'
      },
      freezingRain: {
        light: '弱い着氷性の雨',
        heavy: '強い着氷性の雨'
      },
      snow: {
        light: '弱い雪',
        moderate: 'やや強い雪',
        heavy: '強い雪'
      },
      rainShowers: {
        light: '弱いにわか雨',
        moderate: 'やや強いにわか雨',
        heavy: '強いにわか雨'
      },
      snowShowers: { light: '弱いにわか雪', heavy: '強いにわか雪' }
    },
    thunderstormHail: '雹を伴う雷雨',
    panel: {
      feelsLike: '体感温度',
      humidity: '湿度',
      uvIndex: 'UV指数',
      uvScaleInfo:
        'UV指数（WHO）: 0–2 低い、3–5 中程度、6–7 高い、8–10 非常に高い、11+ 極端に高い。',
      wind: '風',
      force: '風力',
      windScaleInfo: 'ビューフォート風力階級: 0(静穏)〜12(暴風)。',
      gusts: '突風',
      sunrise: '日の出',
      sunset: '日の入り',
      daylight: '日照時間',
      moonPhase: '月相',
      moonIllumination: (percent) => `輝面率${percent}%`,
      moonNextFull: (days) =>
        days <= 0 ? '今日は満月' : `満月まであと${days}日`,
      moonNextNew: (days) =>
        days <= 0 ? '今日は新月' : `新月まであと${days}日`,
      tomorrow: '明日',
      noLocation: '天気を見るには場所を設定してください'
    },
    location: {
      searchPlaceholder: '都市を検索',
      searchButton: '検索',
      useMyLocation: '現在地を使用',
      currentLocationName: '現在地',
      gpsDenied: '位置情報へのアクセスが拒否されました',
      gpsFailed:
        '位置を特定できませんでした — 代わりに都市名で検索してください',
      approximate:
        'ネットワークからのおおよその位置情報です — 精度を上げるには都市名で検索してください'
    }
  }
}

const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  fr,
  nl,
  de,
  es,
  it,
  pt,
  ru,
  zh,
  hi,
  ar,
  bn,
  ur,
  id,
  ja
}

export function t(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}

export function conditionLabel(
  weather: Dictionary['weather'],
  visual: WeatherVisual
): string {
  if (visual.hail) return weather.thunderstormHail
  const phrases: Partial<
    Record<ConditionKey, Partial<Record<Intensity, string>>>
  > = weather.intensified
  const phrase = visual.intensity
    ? phrases[visual.conditionKey]?.[visual.intensity]
    : undefined
  return phrase ?? weather.condition[visual.conditionKey]
}

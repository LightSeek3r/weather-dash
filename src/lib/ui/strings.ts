/**
 * Minimal UI string dictionary. Every static label a component shows must
 * come from here, keyed by `settingsStore.locale` — a hardcoded English
 * literal is the same bug twice over: it already happened once (clock/date
 * formatting ignored `settingsStore.locale` entirely until this pass fixed
 * it). Extend this file's `Dictionary` shape + all 10 locale objects together
 * so nothing ships translated for some languages and not others.
 *
 * These are short, common calendar/UI words — confident enough without
 * native review. Weather condition labels (phase 2) are more idiomatic and
 * should get a native-speaker pass for fr/nl/de/ru/zh/hi per the plan's
 * model notes.
 *
 * Font note: the two self-hosted families (Lexend, Atkinson Hyperlegible —
 * see design-tokens.css) cover Latin + Cyrillic, so ru renders in-font; zh
 * and hi glyphs have no coverage there and silently fall back to whatever
 * CJK/Devanagari system font the browser substitutes per-character. That's
 * expected browser behavior, not a bug — bundling CJK/Devanagari webfonts is
 * out of scope (bundle-size concern, tracked in the plan).
 */
import type { Locale } from '../core/storage/settings'
import type { RelativeTimeLabels } from './status'
import type { ConditionKey } from '../weather/mapWmo'
import type { MoonPhaseKey } from '../weather/types'

export interface Dictionary {
  dateLine: {
    week: string
    day: string
    of: string
    /** Overflow marker for the compact holiday item, e.g. "Christmas, Boxing Day" + "+1" more. */
    more: (n: number) => string
  }
  kiosk: { tapToStart: string; openSettings: string }
  /** Fullscreen anti-burn-in scene overlay. */
  scene: { tapToDismiss: string }
  settings: {
    title: string
    placeholder: string
    close: string
    /** Language picker section — the <select>'s own options are each locale's native name for itself (never translated), only this heading is. */
    language: { heading: string }
    holidays: {
      heading: string
      country: string
      region: string
      allRegions: string
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
    /** Modifiers composed onto `condition[key]` by CurrentWeather, e.g. "Heavy" + "Rain". */
    intensity: { light: string; moderate: string; heavy: string }
    /** Appended when `WeatherVisual.hail` is true, e.g. "Thunderstorm" + "with hail". */
    hail: string
    panel: {
      feelsLike: string
      humidity: string
      uvIndex: string
      wind: string
      force: string
      gusts: string
      sunrise: string
      sunset: string
      daylight: string
      moonPhase: string
      tomorrow: string
      /** Timeline's first-hour label. */
      now: string
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
  dateLine: {
    week: 'Week',
    day: 'Day',
    of: 'of',
    more: (n) => `+${n}`
  },
  kiosk: { tapToStart: 'Tap to start', openSettings: 'Open settings' },
  scene: { tapToDismiss: 'Tap to dismiss' },
  settings: {
    title: 'Settings',
    placeholder:
      'Location, units, holidays, photos and effects arrive here as each feature ships.',
    close: 'Close settings',
    language: { heading: 'Language' },
    holidays: {
      heading: 'Holidays',
      country: 'Country',
      region: 'Region',
      allRegions: 'All regions',
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
    intensity: { light: 'Light', moderate: 'Moderate', heavy: 'Heavy' },
    hail: 'with hail',
    panel: {
      feelsLike: 'Feels like',
      humidity: 'Humidity',
      uvIndex: 'UV index',
      wind: 'Wind',
      force: 'force',
      gusts: 'gusts',
      sunrise: 'Sunrise',
      sunset: 'Sunset',
      daylight: 'Daylight',
      moonPhase: 'Moon phase',
      tomorrow: 'Tomorrow',
      now: 'Now',
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
  dateLine: {
    week: 'Semaine',
    day: 'Jour',
    of: 'sur',
    more: (n) => `+${n}`
  },
  kiosk: {
    tapToStart: 'Toucher pour démarrer',
    openSettings: 'Ouvrir les réglages'
  },
  scene: { tapToDismiss: 'Toucher pour fermer' },
  settings: {
    title: 'Réglages',
    placeholder:
      'La localisation, les unités, les jours fériés, les photos et les effets arriveront ici au fil des fonctionnalités.',
    close: 'Fermer les réglages',
    language: { heading: 'Langue' },
    holidays: {
      heading: 'Jours fériés',
      country: 'Pays',
      region: 'Région',
      allRegions: 'Toutes les régions',
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
    intensity: { light: 'Léger', moderate: 'Modéré', heavy: 'Fort' },
    hail: 'avec grêle',
    panel: {
      feelsLike: 'Ressenti',
      humidity: 'Humidité',
      uvIndex: 'Indice UV',
      wind: 'Vent',
      force: 'force',
      gusts: 'rafales',
      sunrise: 'Lever du soleil',
      sunset: 'Coucher du soleil',
      daylight: 'Ensoleillement',
      moonPhase: 'Phase lunaire',
      tomorrow: 'Demain',
      now: 'Maint.',
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
  dateLine: {
    week: 'Week',
    day: 'Dag',
    of: 'van',
    more: (n) => `+${n}`
  },
  kiosk: {
    tapToStart: 'Tik om te starten',
    openSettings: 'Instellingen openen'
  },
  scene: { tapToDismiss: 'Tik om te sluiten' },
  settings: {
    title: 'Instellingen',
    placeholder:
      'Locatie, eenheden, feestdagen, foto’s en effecten komen hier terwijl elke functie wordt uitgebracht.',
    close: 'Instellingen sluiten',
    language: { heading: 'Taal' },
    holidays: {
      heading: 'Feestdagen',
      country: 'Land',
      region: 'Regio',
      allRegions: 'Alle regio’s',
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
    intensity: { light: 'Licht', moderate: 'Matig', heavy: 'Zwaar' },
    hail: 'met hagel',
    panel: {
      feelsLike: 'Voelt als',
      humidity: 'Vochtigheid',
      uvIndex: 'UV-index',
      wind: 'Wind',
      force: 'kracht',
      gusts: 'windstoten',
      sunrise: 'Zonsopgang',
      sunset: 'Zonsondergang',
      daylight: 'Daglicht',
      moonPhase: 'Maanfase',
      tomorrow: 'Morgen',
      now: 'Nu',
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
  dateLine: {
    week: 'Woche',
    day: 'Tag',
    of: 'von',
    more: (n) => `+${n}`
  },
  kiosk: {
    tapToStart: 'Zum Starten tippen',
    openSettings: 'Einstellungen öffnen'
  },
  scene: { tapToDismiss: 'Zum Schließen tippen' },
  settings: {
    title: 'Einstellungen',
    placeholder:
      'Standort, Einheiten, Feiertage, Fotos und Effekte erscheinen hier, sobald die jeweilige Funktion fertig ist.',
    close: 'Einstellungen schließen',
    language: { heading: 'Sprache' },
    holidays: {
      heading: 'Feiertage',
      country: 'Land',
      region: 'Region',
      allRegions: 'Alle Regionen',
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
    intensity: { light: 'Leicht', moderate: 'Mäßig', heavy: 'Stark' },
    hail: 'mit Hagel',
    panel: {
      feelsLike: 'Gefühlt',
      humidity: 'Luftfeuchtigkeit',
      uvIndex: 'UV-Index',
      wind: 'Wind',
      force: 'Stärke',
      gusts: 'Böen',
      sunrise: 'Sonnenaufgang',
      sunset: 'Sonnenuntergang',
      daylight: 'Tageslicht',
      moonPhase: 'Mondphase',
      tomorrow: 'Morgen',
      now: 'Jetzt',
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
  dateLine: {
    week: 'Semana',
    day: 'Día',
    of: 'de',
    more: (n) => `+${n}`
  },
  kiosk: { tapToStart: 'Toca para empezar', openSettings: 'Abrir ajustes' },
  scene: { tapToDismiss: 'Toca para cerrar' },
  settings: {
    title: 'Ajustes',
    placeholder:
      'La ubicación, las unidades, los días festivos, las fotos y los efectos llegarán aquí con cada función.',
    close: 'Cerrar ajustes',
    language: { heading: 'Idioma' },
    holidays: {
      heading: 'Días festivos',
      country: 'País',
      region: 'Región',
      allRegions: 'Todas las regiones',
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
    intensity: { light: 'Ligero', moderate: 'Moderado', heavy: 'Fuerte' },
    hail: 'con granizo',
    panel: {
      feelsLike: 'Sensación',
      humidity: 'Humedad',
      uvIndex: 'Índice UV',
      wind: 'Viento',
      force: 'fuerza',
      gusts: 'rachas',
      sunrise: 'Amanecer',
      sunset: 'Atardecer',
      daylight: 'Horas de luz',
      moonPhase: 'Fase lunar',
      tomorrow: 'Mañana',
      now: 'Ahora',
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
  dateLine: {
    week: 'Settimana',
    day: 'Giorno',
    of: 'di',
    more: (n) => `+${n}`
  },
  kiosk: {
    tapToStart: 'Tocca per iniziare',
    openSettings: 'Apri impostazioni'
  },
  scene: { tapToDismiss: 'Tocca per chiudere' },
  settings: {
    title: 'Impostazioni',
    placeholder:
      'Posizione, unità, festività, foto ed effetti arriveranno qui non appena ogni funzione sarà pronta.',
    close: 'Chiudi impostazioni',
    language: { heading: 'Lingua' },
    holidays: {
      heading: 'Festività',
      country: 'Paese',
      region: 'Regione',
      allRegions: 'Tutte le regioni',
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
    intensity: { light: 'Leggera', moderate: 'Moderata', heavy: 'Forte' },
    hail: 'con grandine',
    panel: {
      feelsLike: 'Percepita',
      humidity: 'Umidità',
      uvIndex: 'Indice UV',
      wind: 'Vento',
      force: 'forza',
      gusts: 'raffiche',
      sunrise: 'Alba',
      sunset: 'Tramonto',
      daylight: 'Ore di luce',
      moonPhase: 'Fase lunare',
      tomorrow: 'Domani',
      now: 'Ora',
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
  dateLine: {
    week: 'Semana',
    day: 'Dia',
    of: 'de',
    more: (n) => `+${n}`
  },
  kiosk: {
    tapToStart: 'Toque para começar',
    openSettings: 'Abrir configurações'
  },
  scene: { tapToDismiss: 'Toque para fechar' },
  settings: {
    title: 'Configurações',
    placeholder:
      'Localização, unidades, feriados, fotos e efeitos chegarão aqui conforme cada funcionalidade for lançada.',
    close: 'Fechar configurações',
    language: { heading: 'Idioma' },
    holidays: {
      heading: 'Feriados',
      country: 'País',
      region: 'Região',
      allRegions: 'Todas as regiões',
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
    intensity: { light: 'Fraca', moderate: 'Moderada', heavy: 'Forte' },
    hail: 'com granizo',
    panel: {
      feelsLike: 'Sensação',
      humidity: 'Humidade',
      uvIndex: 'Índice UV',
      wind: 'Vento',
      force: 'força',
      gusts: 'rajadas',
      sunrise: 'Nascer do sol',
      sunset: 'Pôr do sol',
      daylight: 'Luz do dia',
      moonPhase: 'Fase da lua',
      tomorrow: 'Amanhã',
      now: 'Agora',
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
  dateLine: {
    week: 'Неделя',
    day: 'День',
    of: 'из',
    more: (n) => `+${n}`
  },
  kiosk: {
    tapToStart: 'Нажмите, чтобы начать',
    openSettings: 'Открыть настройки'
  },
  scene: { tapToDismiss: 'Нажмите, чтобы закрыть' },
  settings: {
    title: 'Настройки',
    placeholder:
      'Местоположение, единицы измерения, праздники, фото и эффекты появятся здесь по мере выхода каждой функции.',
    close: 'Закрыть настройки',
    language: { heading: 'Язык' },
    holidays: {
      heading: 'Праздники',
      country: 'Страна',
      region: 'Регион',
      allRegions: 'Все регионы',
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
    intensity: { light: 'Слабый', moderate: 'Умеренный', heavy: 'Сильный' },
    hail: 'с градом',
    panel: {
      feelsLike: 'Ощущается как',
      humidity: 'Влажность',
      uvIndex: 'УФ-индекс',
      wind: 'Ветер',
      force: 'сила',
      gusts: 'порывы',
      sunrise: 'Восход',
      sunset: 'Закат',
      daylight: 'Световой день',
      moonPhase: 'Фаза луны',
      tomorrow: 'Завтра',
      now: 'Сейчас',
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
  dateLine: {
    week: '周',
    day: '天',
    of: '共',
    more: (n) => `+${n}`
  },
  kiosk: { tapToStart: '轻触开始', openSettings: '打开设置' },
  scene: { tapToDismiss: '轻触关闭' },
  settings: {
    title: '设置',
    placeholder:
      '位置、单位、节假日、照片和效果将随着每项功能上线逐步在此显示。',
    close: '关闭设置',
    language: { heading: '语言' },
    holidays: {
      heading: '节假日',
      country: '国家',
      region: '地区',
      allRegions: '所有地区',
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
    // Chinese forecasts naturally prefix intensity onto the condition word
    // (小雨/中雨/大雨), so this composes more idiomatically than most
    // locales' intensity+condition pairing.
    intensity: { light: '小', moderate: '中', heavy: '大' },
    hail: '伴有冰雹',
    panel: {
      feelsLike: '体感温度',
      humidity: '湿度',
      uvIndex: '紫外线指数',
      wind: '风',
      force: '风力',
      gusts: '阵风',
      sunrise: '日出',
      sunset: '日落',
      daylight: '日照时长',
      moonPhase: '月相',
      tomorrow: '明天',
      now: '现在',
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
  dateLine: {
    week: 'सप्ताह',
    day: 'दिन',
    of: 'में से',
    more: (n) => `+${n}`
  },
  kiosk: {
    tapToStart: 'शुरू करने के लिए टैप करें',
    openSettings: 'सेटिंग्स खोलें'
  },
  scene: { tapToDismiss: 'बंद करने के लिए टैप करें' },
  settings: {
    title: 'सेटिंग्स',
    placeholder:
      'स्थान, इकाइयाँ, छुट्टियाँ, फ़ोटो और प्रभाव हर सुविधा के लॉन्च होने पर यहाँ दिखाई देंगे।',
    close: 'सेटिंग्स बंद करें',
    language: { heading: 'भाषा' },
    holidays: {
      heading: 'छुट्टियाँ',
      country: 'देश',
      region: 'क्षेत्र',
      allRegions: 'सभी क्षेत्र',
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
    intensity: { light: 'हल्की', moderate: 'मध्यम', heavy: 'भारी' },
    hail: 'ओलों के साथ',
    panel: {
      feelsLike: 'अनुभव तापमान',
      humidity: 'नमी',
      uvIndex: 'यूवी इंडेक्स',
      wind: 'हवा',
      force: 'गति',
      gusts: 'झोंके',
      sunrise: 'सूर्योदय',
      sunset: 'सूर्यास्त',
      daylight: 'दिन की रोशनी',
      moonPhase: 'चंद्र कला',
      tomorrow: 'कल',
      now: 'अभी',
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
  hi
}

export function t(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}

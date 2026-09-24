/**
 * Minimal UI string dictionary. Every static label a component shows must
 * come from here, keyed by `settingsStore.locale` — a hardcoded English
 * literal is the same bug twice over: it already happened once (clock/date
 * formatting ignored `settingsStore.locale` entirely until this pass fixed
 * it). Extend this file's `Dictionary` shape + all 7 locale objects together
 * so nothing ships translated for some languages and not others.
 *
 * These are short, common calendar/UI words — confident enough without
 * native review. Weather condition labels (phase 2) are more idiomatic and
 * should get a native-speaker pass for fr/nl/de per the plan's model notes.
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
  settings: {
    title: string
    placeholder: string
    close: string
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
      tomorrow: string
      noLocation: string
    }
    location: {
      searchPlaceholder: string
      searchButton: string
      useMyLocation: string
      /** Location name stored after a successful GPS lookup (no reverse geocoding in v1). */
      currentLocationName: string
      gpsUnavailable: string
      gpsDenied: string
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
  settings: {
    title: 'Settings',
    placeholder:
      'Location, units, holidays, photos and effects arrive here as each feature ships.',
    close: 'Close settings',
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
      tomorrow: 'Tomorrow',
      noLocation: 'Set a location to see the weather'
    },
    location: {
      searchPlaceholder: 'Search for a city',
      searchButton: 'Search',
      useMyLocation: 'Use my location',
      currentLocationName: 'Current location',
      gpsUnavailable: 'Location is not available on this device',
      gpsDenied: 'Location access was denied'
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
  settings: {
    title: 'Réglages',
    placeholder:
      'La localisation, les unités, les jours fériés, les photos et les effets arriveront ici au fil des fonctionnalités.',
    close: 'Fermer les réglages',
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
      tomorrow: 'Demain',
      noLocation: 'Définissez un lieu pour voir la météo'
    },
    location: {
      searchPlaceholder: 'Rechercher une ville',
      searchButton: 'Rechercher',
      useMyLocation: 'Utiliser ma position',
      currentLocationName: 'Position actuelle',
      gpsUnavailable: 'La localisation n’est pas disponible sur cet appareil',
      gpsDenied: 'L’accès à la position a été refusé'
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
  settings: {
    title: 'Instellingen',
    placeholder:
      'Locatie, eenheden, feestdagen, foto’s en effecten komen hier terwijl elke functie wordt uitgebracht.',
    close: 'Instellingen sluiten',
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
      tomorrow: 'Morgen',
      noLocation: 'Stel een locatie in om het weer te zien'
    },
    location: {
      searchPlaceholder: 'Zoek een stad',
      searchButton: 'Zoeken',
      useMyLocation: 'Mijn locatie gebruiken',
      currentLocationName: 'Huidige locatie',
      gpsUnavailable: 'Locatie is niet beschikbaar op dit apparaat',
      gpsDenied: 'Toegang tot locatie is geweigerd'
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
  settings: {
    title: 'Einstellungen',
    placeholder:
      'Standort, Einheiten, Feiertage, Fotos und Effekte erscheinen hier, sobald die jeweilige Funktion fertig ist.',
    close: 'Einstellungen schließen',
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
      tomorrow: 'Morgen',
      noLocation: 'Standort festlegen, um das Wetter zu sehen'
    },
    location: {
      searchPlaceholder: 'Stadt suchen',
      searchButton: 'Suchen',
      useMyLocation: 'Meinen Standort verwenden',
      currentLocationName: 'Aktueller Standort',
      gpsUnavailable: 'Standort ist auf diesem Gerät nicht verfügbar',
      gpsDenied: 'Standortzugriff wurde verweigert'
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
  settings: {
    title: 'Ajustes',
    placeholder:
      'La ubicación, las unidades, los días festivos, las fotos y los efectos llegarán aquí con cada función.',
    close: 'Cerrar ajustes',
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
      tomorrow: 'Mañana',
      noLocation: 'Configura una ubicación para ver el tiempo'
    },
    location: {
      searchPlaceholder: 'Buscar una ciudad',
      searchButton: 'Buscar',
      useMyLocation: 'Usar mi ubicación',
      currentLocationName: 'Ubicación actual',
      gpsUnavailable: 'La ubicación no está disponible en este dispositivo',
      gpsDenied: 'Se denegó el acceso a la ubicación'
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
  settings: {
    title: 'Impostazioni',
    placeholder:
      'Posizione, unità, festività, foto ed effetti arriveranno qui non appena ogni funzione sarà pronta.',
    close: 'Chiudi impostazioni',
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
      tomorrow: 'Domani',
      noLocation: 'Imposta una posizione per vedere il meteo'
    },
    location: {
      searchPlaceholder: 'Cerca una città',
      searchButton: 'Cerca',
      useMyLocation: 'Usa la mia posizione',
      currentLocationName: 'Posizione attuale',
      gpsUnavailable: 'La posizione non è disponibile su questo dispositivo',
      gpsDenied: 'Accesso alla posizione negato'
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
  settings: {
    title: 'Configurações',
    placeholder:
      'Localização, unidades, feriados, fotos e efeitos chegarão aqui conforme cada funcionalidade for lançada.',
    close: 'Fechar configurações',
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
      tomorrow: 'Amanhã',
      noLocation: 'Defina uma localização para ver o tempo'
    },
    location: {
      searchPlaceholder: 'Pesquisar uma cidade',
      searchButton: 'Pesquisar',
      useMyLocation: 'Usar a minha localização',
      currentLocationName: 'Localização atual',
      gpsUnavailable: 'A localização não está disponível neste dispositivo',
      gpsDenied: 'O acesso à localização foi negado'
    }
  }
}

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr, nl, de, es, it, pt }

export function t(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}

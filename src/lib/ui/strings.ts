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

export interface Dictionary {
  dateLine: { week: string; day: string; of: string }
  kiosk: { tapToStart: string; openSettings: string }
  settings: { title: string; placeholder: string; close: string }
  status: {
    offline: string
    noDataYet: string
    /** Prefixes `relative`, e.g. "updated" + "5m ago" -> "updated 5m ago". */
    updatedPrefix: string
    relative: RelativeTimeLabels
  }
}

const en: Dictionary = {
  dateLine: { week: 'Week', day: 'Day', of: 'of' },
  kiosk: { tapToStart: 'Tap to start', openSettings: 'Open settings' },
  settings: {
    title: 'Settings',
    placeholder:
      'Location, units, holidays, photos and effects arrive here as each feature ships.',
    close: 'Close settings'
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
  }
}

const fr: Dictionary = {
  dateLine: { week: 'Semaine', day: 'Jour', of: 'sur' },
  kiosk: {
    tapToStart: 'Toucher pour démarrer',
    openSettings: 'Ouvrir les réglages'
  },
  settings: {
    title: 'Réglages',
    placeholder:
      'La localisation, les unités, les jours fériés, les photos et les effets arriveront ici au fil des fonctionnalités.',
    close: 'Fermer les réglages'
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
  }
}

const nl: Dictionary = {
  dateLine: { week: 'Week', day: 'Dag', of: 'van' },
  kiosk: {
    tapToStart: 'Tik om te starten',
    openSettings: 'Instellingen openen'
  },
  settings: {
    title: 'Instellingen',
    placeholder:
      'Locatie, eenheden, feestdagen, foto’s en effecten komen hier terwijl elke functie wordt uitgebracht.',
    close: 'Instellingen sluiten'
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
  }
}

const de: Dictionary = {
  dateLine: { week: 'Woche', day: 'Tag', of: 'von' },
  kiosk: {
    tapToStart: 'Zum Starten tippen',
    openSettings: 'Einstellungen öffnen'
  },
  settings: {
    title: 'Einstellungen',
    placeholder:
      'Standort, Einheiten, Feiertage, Fotos und Effekte erscheinen hier, sobald die jeweilige Funktion fertig ist.',
    close: 'Einstellungen schließen'
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
  }
}

const es: Dictionary = {
  dateLine: { week: 'Semana', day: 'Día', of: 'de' },
  kiosk: { tapToStart: 'Toca para empezar', openSettings: 'Abrir ajustes' },
  settings: {
    title: 'Ajustes',
    placeholder:
      'La ubicación, las unidades, los días festivos, las fotos y los efectos llegarán aquí con cada función.',
    close: 'Cerrar ajustes'
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
  }
}

const it: Dictionary = {
  dateLine: { week: 'Settimana', day: 'Giorno', of: 'di' },
  kiosk: {
    tapToStart: 'Tocca per iniziare',
    openSettings: 'Apri impostazioni'
  },
  settings: {
    title: 'Impostazioni',
    placeholder:
      'Posizione, unità, festività, foto ed effetti arriveranno qui non appena ogni funzione sarà pronta.',
    close: 'Chiudi impostazioni'
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
  }
}

const pt: Dictionary = {
  dateLine: { week: 'Semana', day: 'Dia', of: 'de' },
  kiosk: {
    tapToStart: 'Toque para começar',
    openSettings: 'Abrir configurações'
  },
  settings: {
    title: 'Configurações',
    placeholder:
      'Localização, unidades, feriados, fotos e efeitos chegarão aqui conforme cada funcionalidade for lançada.',
    close: 'Fechar configurações'
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
  }
}

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr, nl, de, es, it, pt }

export function t(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}

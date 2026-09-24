/**
 * Locale plumbing shared by every component that formats a date/number or
 * looks up a translated string. `settingsStore.locale` stores the bare
 * language code the settings schema validates (fr/en/nl/de/es/it/pt) — this
 * maps each to the BCP-47 tag `Intl` APIs expect, picking one sensible
 * region per language rather than exposing region choice as a separate
 * setting (not decided in the plan; revisit if that's ever needed).
 */
import type { Locale } from '../core/storage/settings'

const REGION_TAG: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  nl: 'nl-NL',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT'
}

export function localeTag(locale: Locale): string {
  return REGION_TAG[locale]
}

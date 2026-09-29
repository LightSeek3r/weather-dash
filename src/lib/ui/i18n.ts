/**
 * Locale plumbing shared by every component that formats a date/number or
 * looks up a translated string. `settingsStore.locale` stores the bare
 * language code the settings schema validates
 * (fr/en/nl/de/es/it/pt/ru/zh/hi/ar/bn/ur/id/ja) — this maps each to the
 * BCP-47 tag `Intl` APIs expect, picking one sensible region per language
 * rather than exposing region choice as a separate setting (not decided in
 * the plan; revisit if that's ever needed).
 */
import type { Locale } from '../core/storage/settings'

const REGION_TAG: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  nl: 'nl-NL',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  ru: 'ru-RU',
  zh: 'zh-CN',
  hi: 'hi-IN',
  ar: 'ar-SA',
  bn: 'bn-BD',
  ur: 'ur-PK',
  id: 'id-ID',
  ja: 'ja-JP'
}

export function localeTag(locale: Locale): string {
  return REGION_TAG[locale]
}

/** Arabic and Urdu are the only two of this app's locales written right-to-left. */
const RTL_LOCALES: ReadonlySet<Locale> = new Set(['ar', 'ur'])

export function textDirection(locale: Locale): 'ltr' | 'rtl' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr'
}

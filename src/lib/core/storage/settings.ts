/**
 * Versioned settings schema + localStorage-backed store.
 *
 * This app is a 24/7 unattended kiosk: a corrupted, hand-edited, or
 * old-version localStorage blob must never crash the app or leave the
 * screen blank. `migrate()` is the recovery path — it validates leniently,
 * substituting sane defaults field-by-field (via `v.fallback`) instead of
 * throwing on the first bad value. `importSettings()` is the opposite: an
 * explicit user action, so it validates *strictly* and applies all-or-nothing
 * (see plan decisions: settings export/import JSON, all-local settings).
 */
import * as v from 'valibot'
import { writable, get, type Writable } from 'svelte/store'

export const SCHEMA_VERSION = 2
export const STORAGE_KEY = 'wall-dashboard:settings:v1'

export const LOCALES = [
  'fr',
  'en',
  'nl',
  'de',
  'es',
  'it',
  'pt',
  'ru',
  'zh',
  'hi'
] as const
export type Locale = (typeof LOCALES)[number]
export const PHOTO_ROTATION_VALUES = [
  '1m',
  '5m',
  '10m',
  '15m',
  '30m',
  '1h',
  '2h',
  '6h',
  '12h',
  '24h'
] as const

// --- Strict (no-fallback) leaf schemas -------------------------------------
// Shared by the strict import schema and, wrapped in `v.fallback`, by the
// lenient migrate schema below — one source of truth per field.
const localeInner = v.picklist(LOCALES)
const clockFormatInner = v.picklist(['12h', '24h'])
const showSecondsInner = v.boolean()
const locationInner = v.nullable(
  v.object({
    lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
    lon: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
    name: v.string()
  })
)
const tempUnitInner = v.picklist(['C', 'F'])
const windUnitInner = v.picklist(['kmh', 'ms', 'mph', 'knots'])
const showBeaufortInner = v.boolean()
const baseCountryInner = v.string()
const baseRegionInner = v.nullable(v.string())
const countryListInner = v.array(v.string())
const traditionInner = v.string()
const saintsEnabledInner = v.boolean()
const timeOfDayInner = v.pipe(v.string(), v.regex(/^([01]\d|2[0-3]):[0-5]\d$/))
const intervalSecondsInner = v.pipe(v.number(), v.minValue(0))
const durationSecondsInner = v.pipe(v.number(), v.minValue(0))
const photoRotationInner = v.picklist(PHOTO_ROTATION_VALUES)
const dimOpacityInner = v.pipe(v.number(), v.minValue(0), v.maxValue(1))
const blurPxInner = v.pipe(v.number(), v.minValue(0), v.maxValue(20))
const shuffleInner = v.boolean()
const reducedMotionInner = v.picklist(['auto', 'on', 'off'])
const fxQualityInner = v.picklist(['auto', 'high', 'eco', 'off'])

/** Strict schema: used for user-initiated import, rejects the whole file on any bad field. */
export const StrictSettingsSchema = v.object({
  version: v.number(),
  locale: localeInner,
  clock: v.object({ format: clockFormatInner, showSeconds: showSecondsInner }),
  location: locationInner,
  weather: v.object({
    tempUnit: tempUnitInner,
    windUnit: windUnitInner,
    showBeaufort: showBeaufortInner
  }),
  holidays: v.object({
    baseCountry: baseCountryInner,
    baseRegion: baseRegionInner,
    extraCountries: countryListInner,
    disabledHolidayIds: countryListInner
  }),
  saints: v.object({ tradition: traditionInner, enabled: saintsEnabledInner }),
  nightMode: v.object({ start: timeOfDayInner, end: timeOfDayInner }),
  fullscreenScene: v.object({
    intervalSeconds: intervalSecondsInner,
    durationSeconds: durationSecondsInner
  }),
  photos: v.object({
    rotationDuration: photoRotationInner,
    dimOpacity: dimOpacityInner,
    blurPx: blurPxInner,
    shuffle: shuffleInner
  }),
  reducedMotion: reducedMotionInner,
  fxQuality: fxQualityInner
})

export type Settings = v.InferOutput<typeof StrictSettingsSchema>

const DEFAULT_CLOCK: Settings['clock'] = { format: '24h', showSeconds: false }
const DEFAULT_WEATHER: Settings['weather'] = {
  tempUnit: 'C',
  windUnit: 'kmh',
  showBeaufort: true
}
const DEFAULT_HOLIDAYS: Settings['holidays'] = {
  baseCountry: 'FR',
  baseRegion: null,
  extraCountries: [],
  disabledHolidayIds: []
}
const DEFAULT_SAINTS: Settings['saints'] = {
  tradition: 'roman-catholic',
  enabled: true
}
const DEFAULT_NIGHT_MODE: Settings['nightMode'] = {
  start: '22:00',
  end: '07:00'
}
const DEFAULT_FULLSCREEN_SCENE: Settings['fullscreenScene'] = {
  intervalSeconds: 1800,
  durationSeconds: 20
}
const DEFAULT_PHOTOS: Settings['photos'] = {
  rotationDuration: '10m',
  // deliberate: dim/blur defaults tuned for legibility over an arbitrary
  // photo, not a specific one — see Layout.svelte's [data-photo] scrim,
  // which already assumes a worst-case bright image (see plan decision:
  // "dim/blur slider" is there precisely because no single default suits
  // every photo).
  dimOpacity: 0.55,
  blurPx: 0,
  shuffle: false
}

// --- Lenient (per-field fallback) schema, used by migrate() ----------------
// Each leaf falls back independently so one bad field never discards its
// siblings; each object is *also* wrapped so a non-object value (e.g. the
// whole `clock` key replaced by a string) falls back to the group default
// instead of every leaf inside failing with no object to read from.
const SettingsSchema = v.object({
  version: v.fallback(v.number(), SCHEMA_VERSION),
  locale: v.fallback(localeInner, 'en'),
  clock: v.fallback(
    v.object({
      format: v.fallback(clockFormatInner, DEFAULT_CLOCK.format),
      showSeconds: v.fallback(showSecondsInner, DEFAULT_CLOCK.showSeconds)
    }),
    DEFAULT_CLOCK
  ),
  location: v.fallback(locationInner, null),
  weather: v.fallback(
    v.object({
      tempUnit: v.fallback(tempUnitInner, DEFAULT_WEATHER.tempUnit),
      windUnit: v.fallback(windUnitInner, DEFAULT_WEATHER.windUnit),
      showBeaufort: v.fallback(showBeaufortInner, DEFAULT_WEATHER.showBeaufort)
    }),
    DEFAULT_WEATHER
  ),
  holidays: v.fallback(
    v.object({
      baseCountry: v.fallback(baseCountryInner, DEFAULT_HOLIDAYS.baseCountry),
      baseRegion: v.fallback(baseRegionInner, DEFAULT_HOLIDAYS.baseRegion),
      extraCountries: v.fallback(
        countryListInner,
        DEFAULT_HOLIDAYS.extraCountries
      ),
      disabledHolidayIds: v.fallback(
        countryListInner,
        DEFAULT_HOLIDAYS.disabledHolidayIds
      )
    }),
    DEFAULT_HOLIDAYS
  ),
  saints: v.fallback(
    v.object({
      tradition: v.fallback(traditionInner, DEFAULT_SAINTS.tradition),
      enabled: v.fallback(saintsEnabledInner, DEFAULT_SAINTS.enabled)
    }),
    DEFAULT_SAINTS
  ),
  nightMode: v.fallback(
    v.object({
      start: v.fallback(timeOfDayInner, DEFAULT_NIGHT_MODE.start),
      end: v.fallback(timeOfDayInner, DEFAULT_NIGHT_MODE.end)
    }),
    DEFAULT_NIGHT_MODE
  ),
  fullscreenScene: v.fallback(
    v.object({
      intervalSeconds: v.fallback(
        intervalSecondsInner,
        DEFAULT_FULLSCREEN_SCENE.intervalSeconds
      ),
      durationSeconds: v.fallback(
        durationSecondsInner,
        DEFAULT_FULLSCREEN_SCENE.durationSeconds
      )
    }),
    DEFAULT_FULLSCREEN_SCENE
  ),
  photos: v.fallback(
    v.object({
      rotationDuration: v.fallback(
        photoRotationInner,
        DEFAULT_PHOTOS.rotationDuration
      ),
      dimOpacity: v.fallback(dimOpacityInner, DEFAULT_PHOTOS.dimOpacity),
      blurPx: v.fallback(blurPxInner, DEFAULT_PHOTOS.blurPx),
      shuffle: v.fallback(shuffleInner, DEFAULT_PHOTOS.shuffle)
    }),
    DEFAULT_PHOTOS
  ),
  reducedMotion: v.fallback(reducedMotionInner, 'auto'),
  fxQuality: v.fallback(fxQualityInner, 'auto')
})

export function defaultSettings(): Settings {
  return v.parse(SettingsSchema, { version: SCHEMA_VERSION })
}

type RawRecord = Record<string, unknown>

function isPlainObject(x: unknown): x is RawRecord {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/**
 * Pre-v1 blobs stored locale/clock flat (`lang`, `clockFormat`,
 * `clockSeconds`) instead of nested under `clock`; pre-v2 blobs stored a
 * top-level `photoRotation` instead of nesting it under `photos`. Remap
 * known legacy shapes onto current field names before validation —
 * `v.fallback` only recovers *invalid* values, it can't know an old key was
 * renamed, so without this a valid old blob would silently lose the user's
 * choices to defaults.
 */
function upgradeLegacyShape(raw: RawRecord): RawRecord {
  const version = typeof raw.version === 'number' ? raw.version : 0
  if (version >= SCHEMA_VERSION) return raw

  const legacy = raw as {
    lang?: unknown
    clockFormat?: unknown
    clockSeconds?: unknown
    photoRotation?: unknown
  }
  return {
    ...raw,
    version: SCHEMA_VERSION,
    locale: raw.locale ?? legacy.lang,
    clock: raw.clock ?? {
      format: legacy.clockFormat,
      showSeconds: legacy.clockSeconds
    },
    photos: raw.photos ?? { rotationDuration: legacy.photoRotation }
  }
}

/** Shallow, one-level report of which top-level fields differed from the raw input, for the console warning — not used for anything load-bearing. */
function droppedFields(raw: RawRecord, result: Settings): string[] {
  const dropped: string[] = []
  for (const key of Object.keys(result) as (keyof Settings)[]) {
    const rawValue = raw[key]
    if (rawValue === undefined) continue
    if (JSON.stringify(rawValue) !== JSON.stringify(result[key])) {
      dropped.push(key)
    }
  }
  return dropped
}

/**
 * Parse whatever is in localStorage into a valid `Settings`. Never throws —
 * corrupted JSON, a non-object payload, an old schema version, or individual
 * bad fields all resolve to sane defaults (see plan premortem P6/P7: a
 * blank/crashed kiosk overnight is worse than losing one bad setting).
 */
export function migrate(rawUnknownJson: unknown): Settings {
  let raw: unknown = rawUnknownJson

  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      console.warn('[settings] stored value is not valid JSON, using defaults')
      return defaultSettings()
    }
  }

  if (!isPlainObject(raw)) {
    console.warn('[settings] stored value is not an object, using defaults')
    return defaultSettings()
  }

  const upgraded = upgradeLegacyShape(raw)

  let result: Settings
  try {
    result = v.parse(SettingsSchema, upgraded)
  } catch (err) {
    // Should be unreachable — every field above has a fallback — but a
    // silent-recovery kiosk settings loader must never throw regardless.
    console.warn(
      '[settings] validation failed unexpectedly, using defaults',
      err
    )
    return defaultSettings()
  }

  const dropped = droppedFields(upgraded, result)
  if (dropped.length > 0) {
    console.warn(
      `[settings] invalid/missing fields replaced with defaults: ${dropped.join(', ')}`
    )
  }

  return result
}

function readStoredSettings(): Settings {
  try {
    if (typeof localStorage === 'undefined') return defaultSettings()
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return defaultSettings()
    return migrate(raw)
  } catch (err) {
    console.warn('[settings] could not read localStorage, using defaults', err)
    return defaultSettings()
  }
}

// deliberate: 300ms debounce — the settings sheet has sliders/toggles that
// can fire many `settingsStore.set()` calls per second (e.g. dragging a
// dim/blur slider); writing localStorage on every keystroke would thrash
// synchronous disk I/O on a kiosk that's otherwise idle.
const SAVE_DEBOUNCE_MS = 300

export const settingsStore: Writable<Settings> = writable(readStoredSettings())

let saveTimer: ReturnType<typeof setTimeout> | null = null
settingsStore.subscribe((value) => {
  if (typeof localStorage === 'undefined') return
  if (saveTimer !== null) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch (err) {
      console.warn('[settings] could not persist to localStorage', err)
    }
  }, SAVE_DEBOUNCE_MS)
})

export function exportSettings(): string {
  return JSON.stringify(get(settingsStore), null, 2)
}

function summarizeIssues(issues: readonly v.BaseIssue<unknown>[]): string {
  return issues
    .slice(0, 5)
    .map((issue) => {
      const path =
        issue.path?.map((item) => String(item.key)).join('.') ?? '(root)'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

/**
 * Import a settings JSON export. Strict, all-or-nothing: unlike `migrate()`
 * (which recovers a *stored* blob field-by-field), a bad *import* must not
 * silently apply defaults for the fields it couldn't validate — it errors
 * out and leaves the current settings untouched.
 */
export function importSettings(json: string): Settings | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { error: 'Invalid JSON' }
  }

  if (!isPlainObject(parsed)) {
    return { error: 'Settings file must be a JSON object' }
  }

  const validation = v.safeParse(StrictSettingsSchema, parsed)
  if (!validation.success) {
    return {
      error: `Settings file is not valid: ${summarizeIssues(validation.issues)}`
    }
  }

  settingsStore.set(validation.output)
  return validation.output
}

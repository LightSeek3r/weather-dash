import { describe, it, expect, beforeEach } from 'vitest'
import * as v from 'valibot'
import {
  StrictSettingsSchema,
  SCHEMA_VERSION,
  STORAGE_KEY,
  defaultSettings,
  migrate,
  exportSettings,
  importSettings,
  settingsStore
} from '../../src/lib/core/storage/settings'
import { get } from 'svelte/store'

beforeEach(() => {
  localStorage.clear()
  settingsStore.set(defaultSettings())
})

describe('defaultSettings', () => {
  it('passes strict validation', () => {
    const result = v.safeParse(StrictSettingsSchema, defaultSettings())
    expect(result.success).toBe(true)
  })

  it('is stamped with the current schema version', () => {
    expect(defaultSettings().version).toBe(SCHEMA_VERSION)
  })
})

describe('migrate', () => {
  it('does not crash on garbage JSON and yields valid defaults', () => {
    const result = migrate('{not even close to json')
    expect(v.safeParse(StrictSettingsSchema, result).success).toBe(true)
    expect(result).toEqual(defaultSettings())
  })

  it('does not crash on a JSON value that is not an object (array)', () => {
    const result = migrate(JSON.stringify([1, 2, 3]))
    expect(v.safeParse(StrictSettingsSchema, result).success).toBe(true)
  })

  it('does not crash on a JSON value that is not an object (string)', () => {
    const result = migrate(JSON.stringify('hello'))
    expect(v.safeParse(StrictSettingsSchema, result).success).toBe(true)
  })

  it('does not crash on null', () => {
    const result = migrate(JSON.stringify(null))
    expect(v.safeParse(StrictSettingsSchema, result).success).toBe(true)
  })

  it('replaces an unknown locale with the default and keeps the rest', () => {
    const raw = JSON.stringify({
      version: SCHEMA_VERSION,
      locale: 'klingon',
      clock: { format: '12h', showSeconds: true }
    })
    const result = migrate(raw)
    expect(result.locale).toBe('en')
    expect(result.clock).toEqual({ format: '12h', showSeconds: true })
  })

  it('recovers a single bad field without discarding its siblings', () => {
    const raw = JSON.stringify({
      version: SCHEMA_VERSION,
      clock: { format: 'not-a-format', showSeconds: true }
    })
    const result = migrate(raw)
    expect(result.clock.format).toBe('24h')
    expect(result.clock.showSeconds).toBe(true)
  })

  it('falls back to a default sub-object when the whole group is the wrong type', () => {
    const raw = JSON.stringify({ version: SCHEMA_VERSION, clock: 'nonsense' })
    const result = migrate(raw)
    expect(result.clock).toEqual({ format: '24h', showSeconds: false })
  })

  it('migrates a valid-but-old-version blob cleanly, preserving renamed fields', () => {
    const legacyBlob = JSON.stringify({
      version: 0,
      lang: 'fr',
      clockFormat: '12h',
      clockSeconds: true
    })
    const result = migrate(legacyBlob)
    expect(result.version).toBe(SCHEMA_VERSION)
    expect(result.locale).toBe('fr')
    expect(result.clock).toEqual({ format: '12h', showSeconds: true })
    expect(v.safeParse(StrictSettingsSchema, result).success).toBe(true)
  })

  it('accepts a valid location and rejects an out-of-range one back to null', () => {
    const good = migrate(
      JSON.stringify({
        version: SCHEMA_VERSION,
        location: { lat: 48.85, lon: 2.35, name: 'Paris' }
      })
    )
    expect(good.location).toEqual({ lat: 48.85, lon: 2.35, name: 'Paris' })

    const bad = migrate(
      JSON.stringify({
        version: SCHEMA_VERSION,
        location: { lat: 999, lon: 2.35, name: 'Paris' }
      })
    )
    expect(bad.location).toBeNull()
  })
})

describe('export / import round trip', () => {
  it('round-trips exactly', () => {
    const custom = defaultSettings()
    custom.locale = 'de'
    custom.clock.format = '12h'
    custom.location = { lat: 52.52, lon: 13.4, name: 'Berlin' }
    settingsStore.set(custom)

    const json = exportSettings()
    const imported = importSettings(json)

    expect(imported).not.toHaveProperty('error')
    expect(imported).toEqual(custom)
    expect(get(settingsStore)).toEqual(custom)
  })

  it('returns an error object for invalid JSON and does not mutate current settings', () => {
    const before = get(settingsStore)
    const result = importSettings('{ this is not json')
    expect(result).toHaveProperty('error')
    expect(get(settingsStore)).toEqual(before)
  })

  it('returns an error object for a structurally invalid settings object and does not mutate current settings', () => {
    const before = get(settingsStore)
    const result = importSettings(
      JSON.stringify({ version: 1, locale: 'klingon' })
    )
    expect(result).toHaveProperty('error')
    expect(get(settingsStore)).toEqual(before)
  })

  it('returns an error object for a non-object JSON payload', () => {
    const before = get(settingsStore)
    const result = importSettings(JSON.stringify([1, 2, 3]))
    expect(result).toHaveProperty('error')
    expect(get(settingsStore)).toEqual(before)
  })
})

describe('persistence key', () => {
  it('uses the namespaced storage key', () => {
    expect(STORAGE_KEY).toBe('wall-dashboard:settings:v1')
  })
})

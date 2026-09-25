import { describe, it, expect } from 'vitest'
import { mapWmoCode } from '../../../src/lib/weather/mapWmo'
import { conditionLabel, t } from '../../../src/lib/ui/strings'
import { LOCALES } from '../../../src/lib/core/storage/settings'

const label = (locale: (typeof LOCALES)[number], code: number) =>
  conditionLabel(t(locale).weather, mapWmoCode(code, true))

describe('conditionLabel', () => {
  it('has a whole phrase for every intensity pair mapWmoCode emits', () => {
    for (const locale of LOCALES) {
      const { weather } = t(locale)
      for (let code = 0; code < 100; code++) {
        const visual = mapWmoCode(code, true)
        if (!visual.intensity) continue
        expect(
          conditionLabel(weather, visual),
          `${locale} code ${code}`
        ).not.toBe(weather.condition[visual.conditionKey])
      }
    }
  })

  it('follows each language word order and agreement', () => {
    expect(label('fr', 63)).toBe('Pluie modérée')
    expect(label('fr', 81)).toBe('Averses modérées')
    expect(label('de', 61)).toBe('Leichter Regen')
    expect(label('es', 63)).toBe('Lluvia moderada')
    expect(label('ru', 51)).toBe('Слабая морось')
    expect(label('zh', 63)).toBe('中雨')
    expect(label('en', 65)).toBe('Heavy rain')
  })

  it('uses the bare condition when there is no intensity', () => {
    expect(label('fr', 3)).toBe(t('fr').weather.condition.overcast)
    expect(label('fr', 95)).toBe('Orage')
  })

  it('uses the hail phrase for thunderstorms with hail', () => {
    expect(label('fr', 96)).toBe('Orage avec grêle')
    expect(label('zh', 99)).toBe('雷暴伴有冰雹')
  })
})

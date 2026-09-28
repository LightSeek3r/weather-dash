import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildPresenceField,
  random,
  seedRandom
} from '../../../src/lib/fx/border/common'
import {
  CALM_ATTENUATION,
  calmAt,
  measureCalmZones,
  type CalmZone
} from '../../../src/lib/fx/calm-zones'

describe('seedRandom', () => {
  afterEach(() => seedRandom(null))

  it('replays the same sequence for the same seed', () => {
    seedRandom(42)
    const a = Array.from({ length: 5 }, random)
    seedRandom(42)
    const b = Array.from({ length: 5 }, random)
    expect(b).toEqual(a)
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('returns to Math.random when cleared', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.25)
    seedRandom(7)
    random()
    seedRandom(null)
    expect(random()).toBe(0.25)
    spy.mockRestore()
  })
})

describe('calmAt', () => {
  const text: CalmZone = { kind: 'text', x0: 100, y0: 100, x1: 300, y1: 200 }
  const glass: CalmZone = { kind: 'glass', x0: 400, y0: 100, x1: 700, y1: 400 }
  const F = 20

  it('is 1 away from every zone', () => {
    expect(calmAt([text, glass], 0, 700, F)).toBe(1)
    expect(calmAt([text, glass], 1000, 50, F)).toBe(1)
  })

  it('attenuates to the text level over glyphs, easing out beyond them', () => {
    expect(calmAt([text], 200, 150, F)).toBeCloseTo(CALM_ATTENUATION.text)
    const near = calmAt([text], 300 + F * 2.5, 150, F)
    expect(near).toBeGreaterThan(CALM_ATTENUATION.text)
    expect(near).toBeLessThan(1)
    expect(calmAt([text], 300 + F * 5.4, 150, F)).toBe(1)
  })

  it('ramps inward from a glass edge to the glass level', () => {
    expect(calmAt([glass], 400, 250, F)).toBe(1)
    expect(calmAt([glass], 550, 250, F)).toBeCloseTo(CALM_ATTENUATION.glass)
  })

  it('takes the quietest zone where zones overlap', () => {
    const inner: CalmZone = { kind: 'text', x0: 500, y0: 200, x1: 600, y1: 300 }
    expect(calmAt([glass, inner], 550, 250, F)).toBeCloseTo(
      CALM_ATTENUATION.text
    )
  })
})

describe('measureCalmZones', () => {
  it('reads glass panels as their box and ignores unknown kinds', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<div data-fx-calm="glass"></div><div data-fx-calm="bogus"></div>'
    const [panel] = Array.from(root.children) as HTMLElement[]
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      right: 110,
      bottom: 220,
      width: 100,
      height: 200,
      x: 10,
      y: 20,
      toJSON: () => ({})
    } as DOMRect)
    expect(measureCalmZones(root)).toEqual([
      { kind: 'glass', x0: 10, y0: 20, x1: 110, y1: 220 }
    ])
  })
})

describe('buildPresenceField', () => {
  it('sits at the floor mid-screen and reaches 1 at the edges', () => {
    const f = buildPresenceField(1000, 600, 0.7, [], 1)
    expect(f.at(500, 300)).toBeCloseTo(0.7, 2)
    expect(f.at(0, 300)).toBeCloseTo(1, 2)
    expect(f.at(500, 600)).toBeCloseTo(1, 2)
    expect(f.at(-50, 9999)).toBeCloseTo(1, 2) // clamped, never NaN
  })

  it('floor 1 means uniform full presence', () => {
    const f = buildPresenceField(800, 800, 1, [], 1)
    expect(f.at(400, 400)).toBeCloseTo(1, 5)
  })

  it('multiplies in calm zones, in CSS px scaled to backing-store px', () => {
    const zone: CalmZone = { kind: 'text', x0: 200, y0: 100, x1: 300, y1: 200 }
    // Canvas at 0.5x CSS resolution: the zone lands at 100..150 x 50..100.
    const f = buildPresenceField(500, 300, 1, [zone], 0.5)
    expect(f.at(125, 75)).toBeCloseTo(CALM_ATTENUATION.text, 1)
    expect(f.at(400, 250)).toBeCloseTo(1, 2)
  })
})

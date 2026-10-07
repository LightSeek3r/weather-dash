import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildPresenceField,
  random,
  seedRandom
} from '../../../src/lib/fx/border/common'
import {
  CALM_ATTENUATION,
  CLEAR_MARGIN,
  calmAt,
  clearAt,
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
  const glass: CalmZone = { x0: 400, y0: 100, x1: 700, y1: 400 }
  const F = 20

  it('is 1 away from every zone', () => {
    expect(calmAt([glass], 0, 700, F)).toBe(1)
    expect(calmAt([glass], 1000, 50, F)).toBe(1)
  })

  it('ramps inward from a glass edge to the glass level', () => {
    expect(calmAt([glass], 400, 250, F)).toBe(1)
    const ramp = calmAt([glass], 400 + F / 2, 250, F)
    expect(ramp).toBeGreaterThan(CALM_ATTENUATION)
    expect(ramp).toBeLessThan(1)
    expect(calmAt([glass], 550, 250, F)).toBeCloseTo(CALM_ATTENUATION)
  })

  it('never dents the sky just outside a panel', () => {
    expect(calmAt([glass], 395, 250, F)).toBe(1)
  })
})

describe('clearAt', () => {
  const glass: CalmZone = { x0: 400, y0: 100, x1: 700, y1: 400 }
  const F = 20

  it('cuts a panel and its margin out entirely', () => {
    expect(clearAt([glass], 550, 250, F)).toBe(0)
    expect(clearAt([glass], 400, 250, F)).toBe(0)
    expect(clearAt([glass], 400 - CLEAR_MARGIN, 250, F)).toBe(0)
  })

  it('eases back to full presence outside the margin', () => {
    const edge = 400 - CLEAR_MARGIN
    const mid = clearAt([glass], edge - F / 2, 250, F)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
    expect(clearAt([glass], edge - F, 250, F)).toBe(1)
    expect(clearAt([glass], 0, 700, F)).toBe(1)
  })

  it('rounds the corners of the cut-out', () => {
    // Same per-axis offset: off a corner the Euclidean distance is longer
    // than off a side, so a nearest-edge metric (square corners) would tie.
    const d = (CLEAR_MARGIN + F / 2) / Math.SQRT2
    const diag = clearAt([glass], 400 - d, 100 - d, F)
    const side = clearAt([glass], 400 - d, 250, F)
    expect(diag).toBeGreaterThan(side)
  })
})

describe('measureCalmZones', () => {
  it('reads every tagged element as its box, skipping empty ones', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<div data-fx-calm="glass"></div><div data-fx-calm></div><div></div>'
    const [panel, empty, untagged] = Array.from(root.children) as HTMLElement[]
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
    const emptySpy = vi.spyOn(empty, 'getBoundingClientRect')
    const untaggedSpy = vi.spyOn(untagged, 'getBoundingClientRect')
    expect(measureCalmZones(root)).toEqual([
      { x0: 10, y0: 20, x1: 110, y1: 220 }
    ])
    expect(emptySpy).toHaveBeenCalled()
    expect(untaggedSpy).not.toHaveBeenCalled()
    vi.restoreAllMocks()
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
    const zone: CalmZone = { x0: 200, y0: 100, x1: 400, y1: 300 }
    // Canvas at 0.5x CSS resolution: the zone lands at 100..200 x 50..150.
    const f = buildPresenceField(500, 300, 1, [zone], 0.5)
    expect(f.at(150, 100)).toBeCloseTo(CALM_ATTENUATION, 1)
    expect(f.at(450, 250)).toBeCloseTo(1, 2)
  })

  it('takes the front sampler: glass cut out, sky untouched', () => {
    const zone: CalmZone = { x0: 200, y0: 100, x1: 400, y1: 300 }
    const f = buildPresenceField(500, 300, 1, [zone], 0.5, clearAt)
    expect(f.at(150, 100)).toBeCloseTo(0, 2)
    expect(f.at(450, 250)).toBeCloseTo(1, 2)
  })
})

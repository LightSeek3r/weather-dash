import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildPresenceField,
  random,
  seedRandom
} from '../../../src/lib/fx/border/common'
import {
  CLEAR_MARGIN,
  clearZones,
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

describe('clearZones', () => {
  const glass: CalmZone = { x0: 400, y0: 100, x1: 700, y1: 400 }

  it('erases the panel plus CLEAR_MARGIN, scaled to the backing store', () => {
    const clearRect = vi.fn()
    clearZones(
      { clearRect } as unknown as CanvasRenderingContext2D,
      [glass],
      0.5
    )
    expect(clearRect).toHaveBeenCalledTimes(1)
    const [x, y, w, h] = clearRect.mock.calls[0]
    expect(x).toBeLessThanOrEqual((400 - CLEAR_MARGIN) * 0.5)
    expect(y).toBeLessThanOrEqual((100 - CLEAR_MARGIN) * 0.5)
    expect(x + w).toBeGreaterThanOrEqual((700 + CLEAR_MARGIN) * 0.5)
    expect(y + h).toBeGreaterThanOrEqual((400 + CLEAR_MARGIN) * 0.5)
  })

  it('hugs the panel: the margin stays a couple of px, not a halo', () => {
    expect(CLEAR_MARGIN).toBeLessThanOrEqual(4)
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
    const f = buildPresenceField(1000, 600, 0.7)
    expect(f.at(500, 300)).toBeCloseTo(0.7, 2)
    expect(f.at(0, 300)).toBeCloseTo(1, 2)
    expect(f.at(500, 600)).toBeCloseTo(1, 2)
    expect(f.at(-50, 9999)).toBeCloseTo(1, 2) // clamped, never NaN
  })

  it('floor 1 means uniform full presence', () => {
    const f = buildPresenceField(800, 800, 1)
    expect(f.at(400, 400)).toBeCloseTo(1, 5)
  })
})

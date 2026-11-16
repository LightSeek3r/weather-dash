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

const SQUARE = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0]
] as const

describe('clearZones', () => {
  const glass: CalmZone = {
    x0: 400,
    y0: 100,
    x1: 700,
    y1: 400,
    radii: [
      [20, 20],
      [20, 20],
      [20, 20],
      [20, 20]
    ]
  }

  function recordingContext() {
    // Captured when fill() runs: save/restore must bracket the erase so the
    // caller's blend mode and alpha are untouched afterwards.
    const atFill: { op?: string; alpha?: number; style?: string } = {}
    const ctx = {
      globalCompositeOperation: 'source-over',
      globalAlpha: 0.3,
      // what a scene typically leaves behind: a translucent fill
      fillStyle: 'rgba(255, 255, 255, 0.1)',
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(() => {
        atFill.op = ctx.globalCompositeOperation
        atFill.alpha = ctx.globalAlpha
        atFill.style = ctx.fillStyle
      })
    }
    return { ctx, atFill, as: ctx as unknown as CanvasRenderingContext2D }
  }

  it('erases exactly the panel plus CLEAR_MARGIN, scaled to the backing store (no outward snap)', () => {
    const { ctx, as } = recordingContext()
    clearZones(as, [glass], 0.5)
    expect(ctx.roundRect).toHaveBeenCalledTimes(1)
    const [x, y, w, h] = ctx.roundRect.mock.calls[0]
    expect(x).toBeCloseTo((400 - CLEAR_MARGIN) * 0.5)
    expect(y).toBeCloseTo((100 - CLEAR_MARGIN) * 0.5)
    expect(x + w).toBeCloseTo((700 + CLEAR_MARGIN) * 0.5)
    expect(y + h).toBeCloseTo((400 + CLEAR_MARGIN) * 0.5)
  })

  it('follows the rounded corners instead of erasing a square', () => {
    const { ctx, as } = recordingContext()
    clearZones(as, [glass], 0.5)
    const radii = ctx.roundRect.mock.calls[0][4]
    // 20px corner + the margin, in backing-store px
    expect(radii).toHaveLength(4)
    for (const r of radii) {
      expect(r.x).toBeCloseTo((20 + CLEAR_MARGIN) * 0.5)
      expect(r.y).toBeCloseTo((20 + CLEAR_MARGIN) * 0.5)
    }
  })

  it('keeps a square corner square and rounds only the others', () => {
    const { ctx, as } = recordingContext()
    clearZones(
      as,
      [
        {
          ...glass,
          radii: [
            [0, 0],
            [20, 20],
            [0, 0],
            [20, 20]
          ]
        }
      ],
      1
    )
    const radii = ctx.roundRect.mock.calls[0][4]
    expect(radii.map((r: { x: number }) => r.x)).toEqual([0, 21, 0, 21])
  })

  it('erases with destination-out, fully opaque, then restores the context', () => {
    const { ctx, atFill, as } = recordingContext()
    clearZones(as, [glass], 1)
    // destination-out erases in proportion to the fill's alpha, so a scene's
    // leftover translucent style or globalAlpha must not leak into it
    expect(atFill).toEqual({ op: 'destination-out', alpha: 1, style: '#000' })
    expect(ctx.save).toHaveBeenCalledTimes(1)
    expect(ctx.restore).toHaveBeenCalledTimes(1)
  })

  it('erases every zone in one fill', () => {
    const { ctx, as } = recordingContext()
    clearZones(as, [glass, { ...glass, x0: 0, x1: 100 }], 1)
    expect(ctx.roundRect).toHaveBeenCalledTimes(2)
    expect(ctx.fill).toHaveBeenCalledTimes(1)
  })

  it('falls back to a plain rect where roundRect is missing', () => {
    const { ctx, as } = recordingContext()
    ;(ctx as { roundRect?: unknown }).roundRect = undefined
    clearZones(as, [{ ...glass, radii: SQUARE }], 1)
    expect(ctx.rect).toHaveBeenCalledTimes(1)
    expect(ctx.fill).toHaveBeenCalledTimes(1)
  })

  it('does not touch the canvas when there is nothing to erase', () => {
    const { ctx, as } = recordingContext()
    clearZones(as, [], 1)
    expect(ctx.save).not.toHaveBeenCalled()
    expect(ctx.fill).not.toHaveBeenCalled()
  })

  it('hugs the panel: the margin stays 1px, not a halo', () => {
    expect(CLEAR_MARGIN).toBeLessThanOrEqual(1)
  })
})

describe('measureCalmZones', () => {
  function box(w: number, h: number): DOMRect {
    return {
      left: 10,
      top: 20,
      right: 10 + w,
      bottom: 20 + h,
      width: w,
      height: h,
      x: 10,
      y: 20,
      toJSON: () => ({})
    } as DOMRect
  }

  /** One tagged element with the given box and computed `border-radius` corners (TL, TR, BR, BL). */
  function measuredWith(
    w: number,
    h: number,
    corners: [string, string, string, string]
  ): CalmZone[] {
    const root = document.createElement('div')
    root.innerHTML = '<div data-fx-calm="glass"></div>'
    const panel = root.firstElementChild as HTMLElement
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(box(w, h))
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      borderTopLeftRadius: corners[0],
      borderTopRightRadius: corners[1],
      borderBottomRightRadius: corners[2],
      borderBottomLeftRadius: corners[3]
    } as CSSStyleDeclaration)
    return measureCalmZones(root)
  }

  afterEach(() => vi.restoreAllMocks())

  it('reads every tagged element as its box, skipping empty ones', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<div data-fx-calm="glass"></div><div data-fx-calm></div><div></div>'
    const [panel, empty, untagged] = Array.from(root.children) as HTMLElement[]
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(box(100, 200))
    const emptySpy = vi.spyOn(empty, 'getBoundingClientRect')
    const untaggedSpy = vi.spyOn(untagged, 'getBoundingClientRect')
    expect(measureCalmZones(root)).toEqual([
      { x0: 10, y0: 20, x1: 110, y1: 220, radii: SQUARE }
    ])
    expect(emptySpy).toHaveBeenCalled()
    expect(untaggedSpy).not.toHaveBeenCalled()
  })

  it('reads the px corner radii of a card', () => {
    const [zone] = measuredWith(300, 200, ['36px', '36px', '12px', '0px'])
    expect(zone.radii).toEqual([
      [36, 36],
      [36, 36],
      [12, 12],
      [0, 0]
    ])
  })

  it('resolves percentages against the width (x) and height (y)', () => {
    const [zone] = measuredWith(100, 40, ['50%', '25% 50%', '0px', '0px'])
    expect(zone.radii[0]).toEqual([50, 20])
    expect(zone.radii[1]).toEqual([25, 20])
  })

  it('scales an oversized pill radius down like the browser does', () => {
    const [zone] = measuredWith(59, 59, ['999px', '999px', '999px', '999px'])
    for (const [rx, ry] of zone.radii) {
      expect(rx).toBeCloseTo(29.5)
      expect(ry).toBeCloseTo(29.5)
    }
  })

  it('shrinks all corners by the same factor when one side overflows', () => {
    // top side: 60 + 60 > 80 wide -> f = 80/120; every radius scales by it
    const [zone] = measuredWith(80, 400, ['60px', '60px', '30px', '0px'])
    expect(zone.radii[0][0]).toBeCloseTo(40)
    expect(zone.radii[1][0]).toBeCloseTo(40)
    expect(zone.radii[2][0]).toBeCloseTo(20)
  })

  it('treats a missing or invalid radius as square', () => {
    const [zone] = measuredWith(100, 100, ['', 'auto', '-4px', '0px'])
    expect(zone.radii).toEqual(SQUARE)
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

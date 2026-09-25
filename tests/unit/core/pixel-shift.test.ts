import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { get } from 'svelte/store'
import { scheduler } from '../../../src/lib/core/scheduler'
import {
  createPixelShift,
  nextPixelShift,
  PIXEL_SHIFT_EVERY_MINUTES,
  PIXEL_SHIFT_RADIUS_PX,
  type PixelShift,
  type PixelShiftOffset
} from '../../../src/lib/core/pixel-shift'

const MINUTE_MS = 60_000

function radius({ x, y }: PixelShiftOffset): number {
  return Math.hypot(x, y)
}

describe('nextPixelShift', () => {
  it('moves exactly one pixel step (8-neighbour) at a time', () => {
    let p: PixelShiftOffset = { x: 0, y: 0 }
    for (let i = 0; i < 2000; i++) {
      const next = nextPixelShift(p)
      expect(Math.abs(next.x - p.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(next.y - p.y)).toBeLessThanOrEqual(1)
      expect(next).not.toEqual(p)
      p = next
    }
  })

  it('stays inside the radius even when pushed outward every step', () => {
    // random() -> ~1 always picks the last (most +x/+y) candidate.
    let p: PixelShiftOffset = { x: 0, y: 0 }
    for (let i = 0; i < 500; i++) {
      p = nextPixelShift(p, () => 0.999999)
      expect(radius(p)).toBeLessThanOrEqual(PIXEL_SHIFT_RADIUS_PX)
    }
  })

  it('wanders over many positions rather than a short fixed cycle', () => {
    const seen = new Set<string>()
    let p: PixelShiftOffset = { x: 0, y: 0 }
    for (let i = 0; i < 5000; i++) {
      p = nextPixelShift(p)
      seen.add(`${p.x},${p.y}`)
    }
    // A disc of radius 4 has 49 integer points; a 2-point bounce would hit 2.
    expect(seen.size).toBeGreaterThan(35)
  })
})

describe('createPixelShift', () => {
  let shift: PixelShift | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-25T10:00:00'))
  })

  afterEach(() => {
    shift?.destroy()
    shift = undefined
    scheduler.stop()
    vi.useRealTimers()
  })

  it('starts at the origin and only moves every PIXEL_SHIFT_EVERY_MINUTES', async () => {
    shift = createPixelShift()
    const history: PixelShiftOffset[] = []
    const unsubscribe = shift.offset.subscribe((o) => history.push(o))
    expect(get(shift.offset)).toEqual({ x: 0, y: 0 })

    scheduler.start()
    await vi.advanceTimersByTimeAsync(
      (PIXEL_SHIFT_EVERY_MINUTES - 1) * MINUTE_MS
    )
    expect(history).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(MINUTE_MS)
    expect(history).toHaveLength(2)
    expect(get(shift.offset)).not.toEqual({ x: 0, y: 0 })
    unsubscribe()
  })

  it('keeps changing and stays bounded over a simulated week', async () => {
    shift = createPixelShift()
    const positions = new Set<string>()
    let maxRadius = 0
    const unsubscribe = shift.offset.subscribe((o) => {
      positions.add(`${o.x},${o.y}`)
      maxRadius = Math.max(maxRadius, radius(o))
    })

    scheduler.start()
    // Hour chunks: advancing a whole week at once is slow with 1s ticks.
    for (let h = 0; h < 24 * 7; h++) {
      await vi.advanceTimersByTimeAsync(60 * MINUTE_MS)
    }

    expect(maxRadius).toBeLessThanOrEqual(PIXEL_SHIFT_RADIUS_PX)
    expect(positions.size).toBeGreaterThan(20)
    unsubscribe()
  }, 60_000)

  it('destroy() stops further changes', async () => {
    shift = createPixelShift()
    scheduler.start()
    await vi.advanceTimersByTimeAsync(PIXEL_SHIFT_EVERY_MINUTES * MINUTE_MS)
    shift.destroy()
    const frozen = get(shift.offset)

    await vi.advanceTimersByTimeAsync(60 * MINUTE_MS)
    expect(get(shift.offset)).toEqual(frozen)
  })
})

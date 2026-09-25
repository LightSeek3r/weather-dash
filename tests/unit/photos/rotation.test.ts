import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { get } from 'svelte/store'
import { scheduler } from '../../../src/lib/core/scheduler'
import {
  createPhotoRotation,
  ROTATION_MS
} from '../../../src/lib/photos/rotation'
import type { StoredPhoto } from '../../../src/lib/photos/types'

function makePhoto(id: string, addedAt: number): StoredPhoto {
  return { id, blob: new Blob(['x']), addedAt, width: 100, height: 100 }
}

describe('createPhotoRotation', () => {
  let rotation: ReturnType<typeof createPhotoRotation> | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-24T10:00:00'))
  })

  afterEach(() => {
    rotation?.destroy()
    rotation = undefined
    scheduler.stop()
    vi.useRealTimers()
  })

  it('current is null and nothing throws with an empty photo list', () => {
    rotation = createPhotoRotation([], ROTATION_MS['5m'], false)
    expect(get(rotation.current)).toBeNull()
    expect(() => rotation!.destroy()).not.toThrow()
  })

  it('a single photo stays current forever, no rotation churn', async () => {
    const only = makePhoto('a', 1)
    rotation = createPhotoRotation([only], ROTATION_MS['1m'], false)
    expect(get(rotation.current)).toEqual(only)

    scheduler.start()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(get(rotation.current)).toEqual(only)
  })

  it('does not advance before durationMs has elapsed', async () => {
    const a = makePhoto('a', 1)
    const b = makePhoto('b', 2)
    rotation = createPhotoRotation([a, b], ROTATION_MS['5m'], false)
    expect(get(rotation.current)).toEqual(a)

    scheduler.start()
    await vi.advanceTimersByTimeAsync(4 * 60_000)
    expect(get(rotation.current)).toEqual(a)
  })

  it('cycles in addedAt order once durationMs has elapsed, wrapping around', async () => {
    const a = makePhoto('a', 1)
    const b = makePhoto('b', 2)
    const c = makePhoto('c', 3)
    // Passed deliberately out of order — cycle order must follow addedAt,
    // not array order.
    rotation = createPhotoRotation([c, a, b], ROTATION_MS['5m'], false)
    expect(get(rotation.current)).toEqual(a)

    scheduler.start()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(get(rotation.current)).toEqual(b)

    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(get(rotation.current)).toEqual(c)

    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(get(rotation.current)).toEqual(a) // wraps
  })

  it('shuffle advances on schedule and avoids an immediate repeat', async () => {
    const photos = [makePhoto('a', 1), makePhoto('b', 2), makePhoto('c', 3)]
    // Math.random always returns 0 — deterministic sequence that would
    // repeat the same index every time without the exclude-current logic.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    rotation = createPhotoRotation(photos, ROTATION_MS['1m'], true)

    scheduler.start()
    const seen: string[] = [get(rotation.current)!.id]
    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(60_000)
      seen.push(get(rotation.current)!.id)
    }

    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).not.toBe(seen[i - 1])
    }
    randomSpy.mockRestore()
  })

  it('destroy() unsubscribes from the scheduler — no further advances', async () => {
    const a = makePhoto('a', 1)
    const b = makePhoto('b', 2)
    rotation = createPhotoRotation([a, b], ROTATION_MS['1m'], false)
    scheduler.start()

    rotation.destroy()
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(get(rotation.current)).toEqual(a)
  })
})

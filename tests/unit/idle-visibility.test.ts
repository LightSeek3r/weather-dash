import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { get } from 'svelte/store'
import {
  createIdleVisibility,
  type EventTargetLike
} from '../../src/lib/ui/idle-visibility'

function fakeTarget() {
  const listeners = new Map<string, Set<() => void>>()
  const target: EventTargetLike = {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(listener)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    }
  }
  return {
    target,
    fire(type: string) {
      for (const listener of listeners.get(type) ?? []) listener()
    },
    listenerCount(type: string) {
      return listeners.get(type)?.size ?? 0
    }
  }
}

describe('createIdleVisibility', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts visible', () => {
    const { target } = fakeTarget()
    const idle = createIdleVisibility(5000, target)
    expect(get(idle.visible)).toBe(true)
    idle.destroy()
  })

  it('hides after the timeout with no activity', () => {
    const { target } = fakeTarget()
    const idle = createIdleVisibility(5000, target)
    vi.advanceTimersByTime(5000)
    expect(get(idle.visible)).toBe(false)
    idle.destroy()
  })

  it('activity resets the timer and shows again', () => {
    const { target, fire } = fakeTarget()
    const idle = createIdleVisibility(5000, target)
    vi.advanceTimersByTime(4000)
    fire('pointerdown')
    vi.advanceTimersByTime(4000) // 8s total, but only 4s since last activity
    expect(get(idle.visible)).toBe(true)
    vi.advanceTimersByTime(1000) // now 5s since last activity
    expect(get(idle.visible)).toBe(false)
    idle.destroy()
  })

  it('destroy() removes all listeners and stops the timer', () => {
    const { target, fire, listenerCount } = fakeTarget()
    const idle = createIdleVisibility(5000, target)
    idle.destroy()
    expect(listenerCount('pointerdown')).toBe(0)
    expect(listenerCount('keydown')).toBe(0)

    fire('pointerdown') // no-op, listener already removed
    vi.advanceTimersByTime(10000)
    // destroy() cleared the pending hide timer, so it never fires — visible
    // stays whatever it was at destroy time (true), not forced to false.
    expect(get(idle.visible)).toBe(true)
  })

  it('works with no target (SSR-safe)', () => {
    const idle = createIdleVisibility(5000, undefined)
    expect(get(idle.visible)).toBe(true)
    vi.advanceTimersByTime(5000)
    expect(get(idle.visible)).toBe(false)
    idle.destroy()
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { get } from 'svelte/store'
import {
  toast,
  toasts,
  clearAllToasts,
  DEFAULT_DEDUP_WINDOW_MS
} from '../../src/lib/ui/toast'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-24T10:00:00'))
  clearAllToasts()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('toast dedup / rate-limit', () => {
  it('collapses 5 identical errors within the window into one entity with count 5', () => {
    for (let i = 0; i < 5; i++) {
      toast.error('API failed')
      vi.advanceTimersByTime(1000) // well within the 5 min window
    }

    const list = get(toasts)
    expect(list).toHaveLength(1)
    expect(list[0].count).toBe(5)
    expect(list[0].message).toBe('API failed')
    expect(list[0].kind).toBe('error')
  })

  it('does not dedup across different kinds or messages', () => {
    toast.error('API failed')
    toast.error('Different message')
    toast.info('API failed') // same text, different kind

    expect(get(toasts)).toHaveLength(3)
  })

  it('starts a fresh toast once the dedup window has elapsed', () => {
    toast.error('API failed')
    vi.advanceTimersByTime(DEFAULT_DEDUP_WINDOW_MS + 1000)
    toast.error('API failed')

    // the first one auto-dismissed long before this, so we expect exactly
    // one *live* toast, freshly created (count reset to 1)
    const list = get(toasts)
    expect(list).toHaveLength(1)
    expect(list[0].count).toBe(1)
  })

  it('respects a custom dedup window — a second fire after the window elapses is a fresh, undeduped toast', () => {
    toast.info('short window', { dedupWindowMs: 1000 })
    vi.advanceTimersByTime(1500) // past the 1s window, but before the 4s info auto-dismiss
    toast.info('short window', { dedupWindowMs: 1000 })

    const list = get(toasts)
    expect(list).toHaveLength(2)
    expect(list.every((t) => t.count === 1)).toBe(true)
  })
})

describe('auto-dismiss timing', () => {
  it('dismisses info toasts after their duration', () => {
    toast.info('hello')
    expect(get(toasts)).toHaveLength(1)

    vi.advanceTimersByTime(3999)
    expect(get(toasts)).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(get(toasts)).toHaveLength(0)
  })

  it('gives error toasts a longer (or equal) dismiss time than info toasts', () => {
    toast.info('info message')
    toast.error('error message')

    vi.advanceTimersByTime(4000)
    // info gone, error should still be visible since it has a longer timer
    const list = get(toasts)
    expect(list).toHaveLength(1)
    expect(list[0].kind).toBe('error')
  })

  it('supports a custom duration override', () => {
    toast.success('quick', { durationMs: 100 })
    vi.advanceTimersByTime(99)
    expect(get(toasts)).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(get(toasts)).toHaveLength(0)
  })

  it('renews the dismiss timer when a toast is bumped by a dedup hit', () => {
    toast.error('flaky')
    vi.advanceTimersByTime(7000) // close to the 8s error duration, not past it
    toast.error('flaky') // bump — should restart the 8s timer from now

    vi.advanceTimersByTime(7000) // total 14s since first fire, only 7s since bump
    expect(get(toasts)).toHaveLength(1)

    vi.advanceTimersByTime(1001)
    expect(get(toasts)).toHaveLength(0)
  })
})

describe('manual dismiss', () => {
  it('removes only the targeted toast', () => {
    toast.info('one')
    toast.info('two')
    toast.error('three')

    const list = get(toasts)
    const idToRemove = list.find((t) => t.message === 'two')!.id
    toast.dismiss(idToRemove)

    const after = get(toasts)
    expect(after).toHaveLength(2)
    expect(after.some((t) => t.message === 'two')).toBe(false)
    expect(after.some((t) => t.message === 'one')).toBe(true)
    expect(after.some((t) => t.message === 'three')).toBe(true)
  })

  it('cancels the pending auto-dismiss timer so it does not later remove a reused id incorrectly', () => {
    toast.info('gone')
    const id = get(toasts)[0].id
    toast.dismiss(id)

    // should not throw or affect anything else if the timer still fires
    expect(() => vi.advanceTimersByTime(10000)).not.toThrow()
    expect(get(toasts)).toHaveLength(0)
  })
})

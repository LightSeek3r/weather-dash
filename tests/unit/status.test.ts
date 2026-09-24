import { describe, it, expect, vi } from 'vitest'
import {
  relativeTime,
  getOnlineStatus,
  subscribeOnlineStatus
} from '../../src/lib/ui/status'

describe('relativeTime', () => {
  const now = new Date('2026-09-24T12:00:00Z')

  it('shows "just now" for 0 seconds', () => {
    expect(relativeTime(now, now)).toBe('just now')
  })

  it('shows "just now" right up to the 59s boundary', () => {
    const d = new Date(now.getTime() - 59 * 1000)
    expect(relativeTime(d, now)).toBe('just now')
  })

  it('flips to minutes at exactly 60s', () => {
    const d = new Date(now.getTime() - 60 * 1000)
    expect(relativeTime(d, now)).toBe('1m ago')
  })

  it('shows minutes for 5 minutes', () => {
    const d = new Date(now.getTime() - 5 * 60 * 1000)
    expect(relativeTime(d, now)).toBe('5m ago')
  })

  it('shows "59m ago" right up to the 1h boundary', () => {
    const d = new Date(now.getTime() - 59 * 60 * 1000)
    expect(relativeTime(d, now)).toBe('59m ago')
  })

  it('flips to hours at exactly 60 minutes', () => {
    const d = new Date(now.getTime() - 60 * 60 * 1000)
    expect(relativeTime(d, now)).toBe('1h ago')
  })

  it('shows hours for 90 minutes', () => {
    const d = new Date(now.getTime() - 90 * 60 * 1000)
    expect(relativeTime(d, now)).toBe('1h ago')
  })

  it('shows hours for 2 hours', () => {
    const d = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    expect(relativeTime(d, now)).toBe('2h ago')
  })

  it('shows "23h ago" right up to the 24h boundary', () => {
    const d = new Date(now.getTime() - 23 * 60 * 60 * 1000)
    expect(relativeTime(d, now)).toBe('23h ago')
  })

  it('flips to "yesterday" at exactly 24h', () => {
    const d = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    expect(relativeTime(d, now)).toBe('yesterday')
  })

  it('shows "yesterday" for 25 hours', () => {
    const d = new Date(now.getTime() - 25 * 60 * 60 * 1000)
    expect(relativeTime(d, now)).toBe('yesterday')
  })

  it('shows "yesterday" right up to the 48h boundary', () => {
    const d = new Date(now.getTime() - 47 * 60 * 60 * 1000)
    expect(relativeTime(d, now)).toBe('yesterday')
  })

  it('flips to "{n}d ago" at exactly 48h', () => {
    const d = new Date(now.getTime() - 48 * 60 * 60 * 1000)
    expect(relativeTime(d, now)).toBe('2d ago')
  })

  it('shows days for a week-old date', () => {
    const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    expect(relativeTime(d, now)).toBe('7d ago')
  })

  it('clamps a future date (clock skew) to "just now" instead of a negative duration', () => {
    const future = new Date(now.getTime() + 5 * 60 * 1000)
    expect(relativeTime(future, now)).toBe('just now')
  })

  it('defaults `now` to the current time when omitted', () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const d = new Date(now.getTime() - 30 * 1000)
    expect(relativeTime(d)).toBe('just now')
    vi.useRealTimers()
  })
})

describe('getOnlineStatus', () => {
  it('reads onLine from an injected navigator-like object', () => {
    expect(getOnlineStatus({ onLine: true })).toBe(true)
    expect(getOnlineStatus({ onLine: false })).toBe(false)
  })
})

class FakeEventTarget {
  private listeners = new Map<string, Set<() => void>>()

  addEventListener(type: string, listener: () => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener)
  }

  dispatch(type: string): void {
    for (const l of this.listeners.get(type) ?? []) l()
  }
}

describe('subscribeOnlineStatus', () => {
  it('invokes the callback with true/false on online/offline events from the injected target', () => {
    const target = new FakeEventTarget()
    const cb = vi.fn()
    subscribeOnlineStatus(cb, target)

    target.dispatch('offline')
    expect(cb).toHaveBeenLastCalledWith(false)

    target.dispatch('online')
    expect(cb).toHaveBeenLastCalledWith(true)
  })

  it('the returned unsubscribe function stops further callbacks', () => {
    const target = new FakeEventTarget()
    const cb = vi.fn()
    const unsubscribe = subscribeOnlineStatus(cb, target)

    unsubscribe()
    target.dispatch('offline')
    target.dispatch('online')

    expect(cb).not.toHaveBeenCalled()
  })
})

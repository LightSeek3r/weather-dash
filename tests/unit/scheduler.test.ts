import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Scheduler } from '../../src/lib/core/scheduler'

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    value: hidden,
    configurable: true
  })
}

describe('Scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setHidden(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires a second tick every second', () => {
    vi.setSystemTime(new Date('2026-09-24T10:00:00'))
    const s = new Scheduler()
    const spy = vi.fn()
    s.on('second', spy)
    s.start()

    vi.advanceTimersByTime(3000)

    expect(spy).toHaveBeenCalledTimes(3)
    s.stop()
  })

  it('fires minute tick only when the minute actually changes', () => {
    vi.setSystemTime(new Date('2026-09-24T10:00:59'))
    const s = new Scheduler()
    const spy = vi.fn()
    s.on('minute', spy)
    s.start()

    vi.advanceTimersByTime(1000) // -> 10:01:00, minute changed
    vi.advanceTimersByTime(1000) // -> 10:01:01, same minute

    expect(spy).toHaveBeenCalledTimes(1)
    s.stop()
  })

  it('fires hour tick exactly once at the hour boundary', () => {
    vi.setSystemTime(new Date('2026-09-24T10:59:58'))
    const s = new Scheduler()
    const spy = vi.fn()
    s.on('hour', spy)
    s.start()

    vi.advanceTimersByTime(4000) // crosses 11:00:00

    expect(spy).toHaveBeenCalledTimes(1)
    s.stop()
  })

  it('fires midnight tick exactly once at local day rollover', () => {
    vi.setSystemTime(new Date('2026-09-24T23:59:58'))
    const s = new Scheduler()
    const spy = vi.fn()
    s.on('midnight', spy)
    s.start()

    vi.advanceTimersByTime(4000) // crosses into 2026-09-25

    expect(spy).toHaveBeenCalledTimes(1)
    s.stop()
  })

  it('does not tick while the document is hidden', () => {
    vi.setSystemTime(new Date('2026-09-24T10:00:00'))
    const s = new Scheduler()
    const spy = vi.fn()
    s.on('second', spy)
    s.start()

    setHidden(true)
    vi.advanceTimersByTime(5000)
    expect(spy).not.toHaveBeenCalled()

    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    // catch-up tick fires immediately on visibility return
    expect(spy).toHaveBeenCalledTimes(1)
    s.stop()
  })

  it('still fires hour tick while the document is hidden', () => {
    vi.setSystemTime(new Date('2026-09-24T10:59:58'))
    const s = new Scheduler()
    const spy = vi.fn()
    s.on('hour', spy)
    s.start()

    setHidden(true)
    vi.advanceTimersByTime(4000) // crosses 11:00:00 while hidden

    expect(spy).toHaveBeenCalledTimes(1)
    s.stop()
  })

  it('still fires midnight tick while the document is hidden', () => {
    vi.setSystemTime(new Date('2026-09-24T23:59:58'))
    const s = new Scheduler()
    const spy = vi.fn()
    s.on('midnight', spy)
    s.start()

    setHidden(true)
    vi.advanceTimersByTime(4000) // crosses into 2026-09-25 while hidden

    expect(spy).toHaveBeenCalledTimes(1)
    s.stop()
  })

  it('does not double-fire hour/midnight on the visibility catch-up tick', () => {
    vi.setSystemTime(new Date('2026-09-24T23:59:58'))
    const s = new Scheduler()
    const hourSpy = vi.fn()
    const midnightSpy = vi.fn()
    s.on('hour', hourSpy)
    s.on('midnight', midnightSpy)
    s.start()

    setHidden(true)
    vi.advanceTimersByTime(4000) // crosses into 2026-09-25 while hidden
    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(hourSpy).toHaveBeenCalledTimes(1)
    expect(midnightSpy).toHaveBeenCalledTimes(1)
    s.stop()
  })

  it('stop() clears the timer so no further ticks fire', () => {
    vi.setSystemTime(new Date('2026-09-24T10:00:00'))
    const s = new Scheduler()
    const spy = vi.fn()
    s.on('second', spy)
    s.start()
    s.stop()

    vi.advanceTimersByTime(5000)
    expect(spy).not.toHaveBeenCalled()
  })
})

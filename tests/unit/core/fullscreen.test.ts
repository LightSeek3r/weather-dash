import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isFullscreenSupported,
  enterFullscreen,
  isWakeLockSupported,
  acquireWakeLock,
  watchVisibilityForWakeLock,
  startKiosk
} from '../../../src/lib/core/fullscreen'

describe('fullscreen + wake lock capability guards', () => {
  const originalRequestFullscreen = document.documentElement.requestFullscreen
  const originalWakeLock = (navigator as unknown as { wakeLock?: unknown })
    .wakeLock

  afterEach(() => {
    document.documentElement.requestFullscreen = originalRequestFullscreen
    Object.defineProperty(navigator, 'wakeLock', {
      value: originalWakeLock,
      configurable: true
    })
    vi.restoreAllMocks()
  })

  it('reports unsupported when requestFullscreen is missing', () => {
    // @ts-expect-error simulating a browser without the Fullscreen API (iOS Safari)
    document.documentElement.requestFullscreen = undefined
    expect(isFullscreenSupported()).toBe(false)
  })

  it('does not throw entering fullscreen when unsupported', async () => {
    // @ts-expect-error simulating a browser without the Fullscreen API
    document.documentElement.requestFullscreen = undefined
    await expect(enterFullscreen()).resolves.toBeUndefined()
  })

  it('does not throw entering fullscreen when the browser rejects the request', async () => {
    document.documentElement.requestFullscreen = vi
      .fn()
      .mockRejectedValue(new Error('denied'))
    await expect(enterFullscreen()).resolves.toBeUndefined()
  })

  it('reports unsupported when navigator.wakeLock is missing', () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      configurable: true
    })
    expect(isWakeLockSupported()).toBe(false)
  })

  it('does not throw acquiring a wake lock when unsupported', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      configurable: true
    })
    await expect(acquireWakeLock()).resolves.toBeUndefined()
  })

  it('does not throw acquiring a wake lock when the browser rejects the request', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true
    })
    await expect(acquireWakeLock()).resolves.toBeUndefined()
  })

  it('watchVisibilityForWakeLock returns a working unsubscribe with no wakeLock support', () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      configurable: true
    })
    const unsubscribe = watchVisibilityForWakeLock()
    expect(() => unsubscribe()).not.toThrow()
  })

  it('startKiosk does not throw when neither API is supported', async () => {
    // @ts-expect-error simulating a browser without the Fullscreen API
    document.documentElement.requestFullscreen = undefined
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      configurable: true
    })
    await expect(startKiosk()).resolves.toBeUndefined()
  })
})

describe('fullscreen + wake lock happy path', () => {
  beforeEach(() => {
    document.documentElement.requestFullscreen = vi
      .fn()
      .mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: vi.fn().mockResolvedValue({ release: vi.fn() }) },
      configurable: true
    })
  })

  it('reports supported when both APIs are present', () => {
    expect(isFullscreenSupported()).toBe(true)
    expect(isWakeLockSupported()).toBe(true)
  })

  it('startKiosk calls both APIs when supported', async () => {
    await startKiosk()
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1)
    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen')
  })
})

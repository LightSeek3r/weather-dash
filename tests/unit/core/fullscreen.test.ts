import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isFullscreenSupported,
  enterFullscreen,
  isWakeLockSupported,
  acquireWakeLock,
  watchVisibilityForWakeLock,
  startKiosk,
  isStandalone,
  isFullscreen,
  watchFullscreen
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

describe('isStandalone', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    // @ts-expect-error test-only cleanup of the non-standard iOS flag
    delete (navigator as { standalone?: boolean }).standalone
  })

  function mockMatchMedia(matchingQuery: string | null): void {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === matchingQuery,
      media: query
    })) as unknown as typeof window.matchMedia
  }

  it('is false in a plain browser tab', () => {
    mockMatchMedia(null)
    expect(isStandalone()).toBe(false)
  })

  it('is true when display-mode: standalone matches', () => {
    mockMatchMedia('(display-mode: standalone)')
    expect(isStandalone()).toBe(true)
  })

  it('is true when display-mode: fullscreen matches (the manifest setting here)', () => {
    mockMatchMedia('(display-mode: fullscreen)')
    expect(isStandalone()).toBe(true)
  })

  it('is true on iOS Safari home-screen launch (navigator.standalone)', () => {
    mockMatchMedia(null)
    Object.defineProperty(navigator, 'standalone', {
      value: true,
      configurable: true
    })
    expect(isStandalone()).toBe(true)
  })
})

describe('isFullscreen / watchFullscreen', () => {
  afterEach(() => {
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true
    })
  })

  const setFullscreenElement = (el: Element | null) =>
    Object.defineProperty(document, 'fullscreenElement', {
      value: el,
      configurable: true
    })

  it('reports the current state and notifies on enter and exit until unsubscribed', () => {
    const onChange = vi.fn()
    const stop = watchFullscreen(onChange)
    expect(isFullscreen()).toBe(false)

    setFullscreenElement(document.documentElement)
    document.dispatchEvent(new Event('fullscreenchange'))
    setFullscreenElement(null)
    document.dispatchEvent(new Event('webkitfullscreenchange'))
    expect(onChange.mock.calls).toEqual([[true], [false]])

    stop()
    document.dispatchEvent(new Event('fullscreenchange'))
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})

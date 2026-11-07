import { describe, it, expect } from 'vitest'
import {
  INSTALL_DISMISS_DAYS,
  dismissedRecently,
  installOffer,
  installed,
  isIosSafari,
  type BeforeInstallPromptEvent
} from '../../../src/lib/core/install'

const DAY_MS = 24 * 60 * 60 * 1000

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0 Mobile/15E148 Safari/604.1'
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'

describe('isIosSafari', () => {
  it('accepts Safari on iPhone', () => {
    expect(
      isIosSafari({
        userAgent: IPHONE_SAFARI,
        platform: 'iPhone',
        maxTouchPoints: 5
      })
    ).toBe(true)
  })

  it('accepts iPadOS Safari posing as a Mac, told apart by touch', () => {
    expect(
      isIosSafari({
        userAgent: MAC_SAFARI,
        platform: 'MacIntel',
        maxTouchPoints: 5
      })
    ).toBe(true)
  })

  it('rejects a real Mac', () => {
    expect(
      isIosSafari({
        userAgent: MAC_SAFARI,
        platform: 'MacIntel',
        maxTouchPoints: 0
      })
    ).toBe(false)
  })

  it('rejects other iOS browsers, whose share sheet differs', () => {
    expect(
      isIosSafari({
        userAgent: IPHONE_CHROME,
        platform: 'iPhone',
        maxTouchPoints: 5
      })
    ).toBe(false)
  })
})

describe('dismissedRecently', () => {
  const now = Date.UTC(2026, 10, 7)

  it('is false with nothing stored or junk stored', () => {
    expect(dismissedRecently(null, now)).toBe(false)
    expect(dismissedRecently('', now)).toBe(false)
    expect(dismissedRecently('nope', now)).toBe(false)
  })

  it('is false for a date in the future', () => {
    expect(dismissedRecently(String(now + DAY_MS), now)).toBe(false)
  })

  it('holds for INSTALL_DISMISS_DAYS, then expires', () => {
    const justInside = now - (INSTALL_DISMISS_DAYS * DAY_MS - 1)
    const justOutside = now - INSTALL_DISMISS_DAYS * DAY_MS
    expect(dismissedRecently(String(justInside), now)).toBe(true)
    expect(dismissedRecently(String(justOutside), now)).toBe(false)
  })
})

describe('install events', () => {
  it('keeps the offer and cancels the default mini-infobar', () => {
    installOffer.set(null)
    const event = new Event('beforeinstallprompt', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    let offer: BeforeInstallPromptEvent | null = null
    installOffer.subscribe((o) => (offer = o))()
    expect(offer).toBe(event)
  })

  it('clears the offer and flags the app installed on appinstalled', () => {
    window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }))
    window.dispatchEvent(new Event('appinstalled'))
    let offer: unknown = 'unset'
    let done = false
    installOffer.subscribe((o) => (offer = o))()
    installed.subscribe((v) => (done = v))()
    expect(offer).toBeNull()
    expect(done).toBe(true)
  })
})

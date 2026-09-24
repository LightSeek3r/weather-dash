/**
 * Tap-to-start fullscreen + Wake Lock flow (plan P4). iOS Safari has no
 * Fullscreen API and some browsers lack the Wake Lock API entirely, so every
 * entry point here is capability-checked and swallows rejections — a kiosk
 * that can't go fullscreen should still show the dashboard, not throw.
 */

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.documentElement as FullscreenElement
  return (
    typeof el.requestFullscreen === 'function' ||
    typeof el.webkitRequestFullscreen === 'function'
  )
}

/** Requests fullscreen on the document root. No-ops (never throws) when unsupported or denied. */
export async function enterFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return
  const doc = document as FullscreenDocument
  if (doc.fullscreenElement || doc.webkitFullscreenElement) return

  const el = document.documentElement as FullscreenElement
  try {
    if (typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen()
    } else if (typeof el.webkitRequestFullscreen === 'function') {
      await el.webkitRequestFullscreen()
    }
  } catch {
    // Denied, needs a user gesture, or unsupported (e.g. iOS Safari) — the
    // dashboard still works without fullscreen, so swallow and move on.
  }
}

export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.wakeLock
}

let wakeLock: WakeLockSentinel | null = null

/** Acquires a screen wake lock. No-ops (never throws) when unsupported or denied. */
export async function acquireWakeLock(): Promise<void> {
  if (!isWakeLockSupported()) return
  try {
    wakeLock = await navigator.wakeLock.request('screen')
  } catch {
    // Denied (e.g. low battery) or lost focus mid-request — just retry later
    // via the visibilitychange re-acquire below.
    wakeLock = null
  }
}

/** Current wake lock sentinel, if one is held — exposed for a future status pill. */
export function getWakeLock(): WakeLockSentinel | null {
  return wakeLock
}

/**
 * Re-acquires the wake lock whenever the tab regains visibility — the OS
 * releases it automatically when a screen locks or a tab is hidden, so a
 * 24/7 kiosk needs to ask again every time it comes back.
 * Returns an unsubscribe function; no-ops (returns a no-op) when unsupported.
 */
export function watchVisibilityForWakeLock(): () => void {
  if (typeof document === 'undefined') return () => {}

  const handler = () => {
    if (document.visibilityState === 'visible') {
      void acquireWakeLock()
    }
  }
  document.addEventListener('visibilitychange', handler)
  return () => document.removeEventListener('visibilitychange', handler)
}

/** Full "tap to start" flow: fullscreen first, then wake lock. */
export async function startKiosk(): Promise<void> {
  await enterFullscreen()
  await acquireWakeLock()
}

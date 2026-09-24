/**
 * Drives the settings-gear reveal: "tap anywhere → gear fades in, hides
 * after N seconds idle" (plan decision — a kiosk screen has no always-visible
 * chrome, both to stay uncluttered and to avoid one more static pixel group
 * for burn-in). Visible immediately on creation (so a fresh page load shows
 * the gear briefly) and on any pointer/touch/key activity; hides after
 * `timeoutMs` of no activity.
 *
 * Injectable target (defaults to `window`) for the same reason as
 * status.ts's subscribeOnlineStatus — testable without dispatching real
 * browser events.
 */
import { writable, type Readable } from 'svelte/store'

export interface EventTargetLike {
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

const ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'touchstart'
] as const

export interface IdleVisibility {
  visible: Readable<boolean>
  destroy(): void
}

export function createIdleVisibility(
  timeoutMs: number,
  target: EventTargetLike | undefined = typeof window !== 'undefined'
    ? window
    : undefined
): IdleVisibility {
  const visible = writable(true)
  let timer: ReturnType<typeof setTimeout> | null = null

  function scheduleHide(): void {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => visible.set(false), timeoutMs)
  }

  function onActivity(): void {
    visible.set(true)
    scheduleHide()
  }

  scheduleHide()
  for (const type of ACTIVITY_EVENTS) target?.addEventListener(type, onActivity)

  return {
    visible,
    destroy() {
      if (timer !== null) clearTimeout(timer)
      for (const type of ACTIVITY_EVENTS)
        target?.removeEventListener(type, onActivity)
    }
  }
}

/**
 * "A newer version of the app is ready" signal.
 *
 * The service worker (vite-plugin-pwa, `registerType: 'prompt'`) downloads a
 * new build in the background and parks it as "waiting" instead of swapping
 * it in under a running page. `updateReady` flips to `true` when that
 * happens; `applyAppUpdate` lets the waiting worker take over and reloads
 * the page onto it. The status dot (StatusPill.svelte) turns the signal into
 * an invitation, and the nightly reload applies it unattended.
 */
import { registerSW } from 'virtual:pwa-register'
import { get, writable, type Readable } from 'svelte/store'
import { debugParams } from './debug-params'

/** An always-open kiosk tab never navigates, so the browser's own update check would only run about daily. */
const UPDATE_CHECK_MS = 60 * 60 * 1000

const ready = writable(false)

export const updateReady: Readable<boolean> = { subscribe: ready.subscribe }

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null

export function initAppUpdate(): void {
  // `?update=1` shows the invitation without a real service worker (tests, design review).
  if (debugParams.update) {
    ready.set(true)
    return
  }
  updateServiceWorker = registerSW({
    onNeedRefresh: () => ready.set(true),
    onRegisteredSW: (_url, registration) => {
      if (!registration) return
      setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => {})
      }, UPDATE_CHECK_MS)
    }
  })
}

/** Activates the waiting version and reloads onto it; a plain reload when nothing is waiting. */
export function applyAppUpdate(): void {
  if (get(ready) && updateServiceWorker) void updateServiceWorker(true)
  else location.reload()
}

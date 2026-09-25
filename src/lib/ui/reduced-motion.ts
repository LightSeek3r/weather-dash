/**
 * Effective reduced-motion preference: the user's explicit setting wins,
 * `'auto'` defers to the OS `prefers-reduced-motion` media query (plan
 * P13). Same resolution Background.svelte does inline, shared here so each
 * new overlay doesn't grow its own matchMedia listener.
 */
import { derived, readable, type Readable } from 'svelte/store'
import { settingsStore } from '../core/storage/settings'

const osPrefersReducedMotion: Readable<boolean> = readable(false, (set) => {
  if (typeof window === 'undefined' || !window.matchMedia) return
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  set(media.matches)
  const onChange = (e: MediaQueryListEvent): void => set(e.matches)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
})

export const reducedMotion: Readable<boolean> = derived(
  [settingsStore, osPrefersReducedMotion],
  ([$settings, $os]) =>
    $settings.reducedMotion === 'on'
      ? true
      : $settings.reducedMotion === 'off'
        ? false
        : $os
)

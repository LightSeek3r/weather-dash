/**
 * Tiny change signal for the photo library. `listPhotos()` is a one-shot
 * Promise, not a reactive store, so anything that fetches once and keeps its
 * own state after that (Background.svelte, which drives its own rotation
 * from a snapshot array) needs an explicit nudge to notice photos
 * added/removed later. SettingsSheet.svelte calls `notifyPhotosChanged()`
 * after every successful mutation; Background.svelte subscribes and refetches.
 */
import { writable, type Readable } from 'svelte/store'

const version = writable(0)
export const photosChanged: Readable<number> = version

export function notifyPhotosChanged(): void {
  version.update((n) => n + 1)
}

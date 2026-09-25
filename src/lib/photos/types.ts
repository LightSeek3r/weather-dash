/**
 * Shared shape for a photo persisted in IndexedDB. Owned by the phase-4
 * photos feature (import.ts/store.ts/rotation.ts); Background.svelte and
 * SettingsSheet.svelte only ever see this type, never the storage details.
 */
export interface StoredPhoto {
  id: string
  blob: Blob
  addedAt: number
  width: number
  height: number
}

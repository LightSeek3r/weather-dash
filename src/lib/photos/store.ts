/**
 * Photo library persistence via `idb-keyval` (approved dep, see
 * `.claude/rules/dependencies.md`) — same default-store, prefixed-key
 * pattern as `weather/cache.ts`. One IndexedDB entry per photo rather than
 * one giant serialized array: a 24/7 kiosk photo library can grow to dozens
 * of multi-MB blobs, and IndexedDB handles many small-ish records far
 * better than rewriting one huge array on every add/remove (plan P2).
 */
import { get, set, del, keys } from 'idb-keyval'
import { processImage, PhotoImportError } from './import'
import type { StoredPhoto } from './types'

const KEY_PREFIX = 'wall-dashboard:photos:v1:'

function keyFor(id: string): string {
  return `${KEY_PREFIX}${id}`
}

function isPhotoKey(key: IDBValidKey): key is string {
  return typeof key === 'string' && key.startsWith(KEY_PREFIX)
}

async function listPhotoKeys(): Promise<string[]> {
  const allKeys = await keys()
  return allKeys.filter(isPhotoKey)
}

/** All stored photos, ordered by `addedAt` (stable ordering for non-shuffle rotation). */
export async function listPhotos(): Promise<StoredPhoto[]> {
  const photoKeys = await listPhotoKeys()
  const photos = await Promise.all(
    photoKeys.map((key) => get<StoredPhoto>(key))
  )
  return photos
    .filter((p): p is StoredPhoto => p !== undefined)
    .sort((a, b) => a.addedAt - b.addedAt)
}

/**
 * Imports each file through `processImage` and stores the successes.
 * Per-file try/catch so one bad file in a multi-file picker can't abort
 * the rest of the batch — failures are collected and returned, not thrown.
 */
export async function addPhotos(
  files: File[],
  maxDim: number
): Promise<{
  added: StoredPhoto[]
  failed: { file: File; error: string }[]
}> {
  const added: StoredPhoto[] = []
  const failed: { file: File; error: string }[] = []

  for (const file of files) {
    try {
      const { blob, width, height } = await processImage(file, maxDim)
      const photo: StoredPhoto = {
        id: crypto.randomUUID(),
        blob,
        addedAt: Date.now(),
        width,
        height
      }
      await set(keyFor(photo.id), photo)
      added.push(photo)
    } catch (err) {
      const message =
        err instanceof PhotoImportError || err instanceof Error
          ? err.message
          : 'Unknown import error'
      failed.push({ file, error: message })
    }
  }

  return { added, failed }
}

export async function removePhoto(id: string): Promise<void> {
  await del(keyFor(id))
}

export async function clearAllPhotos(): Promise<void> {
  const photoKeys = await listPhotoKeys()
  await Promise.all(photoKeys.map((key) => del(key)))
}

export interface StorageEstimate {
  usageMB: number
  quotaMB: number
}

/** `null` when `navigator.storage.estimate()` is unsupported — capability-guarded, never throws. */
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return null
  }
  try {
    const { usage, quota } = await navigator.storage.estimate()
    if (usage === undefined || quota === undefined) return null
    const BYTES_PER_MB = 1024 * 1024
    return { usageMB: usage / BYTES_PER_MB, quotaMB: quota / BYTES_PER_MB }
  } catch (err) {
    console.warn('[photos] could not read storage estimate', err)
    return null
  }
}

/** Wraps `navigator.storage.persist()` (plan P2: survive reload) — capability-guarded, never throws, resolves `false` on any failure or lack of support. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false
  }
  try {
    return await navigator.storage.persist()
  } catch (err) {
    console.warn('[photos] could not request persistent storage', err)
    return false
  }
}

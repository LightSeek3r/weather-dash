import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// In-memory stand-in for IndexedDB, sharing `idb-keyval`'s get/set/del/keys
// contract — the cleanest boundary here: store.ts's own logic (key
// filtering/prefixing, per-file try/catch, sorting) is what's under test,
// not idb-keyval's own IndexedDB wiring (already exercised by weather/cache.ts
// against the real API surface).
const { memoryStore } = vi.hoisted(() => ({
  memoryStore: new Map<string, unknown>()
}))

vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(memoryStore.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    memoryStore.set(key, value)
    return Promise.resolve()
  }),
  del: vi.fn((key: string) => {
    memoryStore.delete(key)
    return Promise.resolve()
  }),
  keys: vi.fn(() => Promise.resolve(Array.from(memoryStore.keys())))
}))

vi.mock('../../../src/lib/photos/import', () => {
  class PhotoImportError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'PhotoImportError'
    }
  }
  return { processImage: vi.fn(), PhotoImportError }
})

import { processImage, PhotoImportError } from '../../../src/lib/photos/import'
import {
  listPhotos,
  addPhotos,
  removePhoto,
  clearAllPhotos,
  getStorageEstimate,
  requestPersistentStorage
} from '../../../src/lib/photos/store'

function makeFile(name: string): File {
  return new File(['bytes'], name, { type: 'image/jpeg' })
}

describe('photos store', () => {
  beforeEach(() => {
    memoryStore.clear()
    vi.clearAllMocks()
  })

  it('add/list/remove/clear round-trip', async () => {
    vi.mocked(processImage).mockResolvedValue({
      blob: new Blob(['x']),
      width: 1000,
      height: 800
    })

    const { added, failed } = await addPhotos([makeFile('a.jpg')], 2560)
    expect(failed).toEqual([])
    expect(added).toHaveLength(1)
    expect(added[0].width).toBe(1000)
    expect(added[0].height).toBe(800)
    expect(typeof added[0].id).toBe('string')

    const listed = await listPhotos()
    expect(listed).toHaveLength(1)
    expect(listed[0].id).toBe(added[0].id)

    await removePhoto(added[0].id)
    expect(await listPhotos()).toHaveLength(0)
  })

  it('clearAllPhotos removes every stored photo but nothing else', async () => {
    vi.mocked(processImage).mockResolvedValue({
      blob: new Blob(['x']),
      width: 100,
      height: 100
    })
    await addPhotos([makeFile('a.jpg'), makeFile('b.jpg')], 2560)
    memoryStore.set('wall-dashboard:weather:v1', { unrelated: true })

    expect(await listPhotos()).toHaveLength(2)
    await clearAllPhotos()
    expect(await listPhotos()).toHaveLength(0)
    // A differently-prefixed key (another domain's cache entry) must survive.
    expect(memoryStore.has('wall-dashboard:weather:v1')).toBe(true)
  })

  it('lists photos ordered by addedAt regardless of insertion order', async () => {
    let now = 1000
    vi.mocked(processImage).mockImplementation(async () => {
      return { blob: new Blob(['x']), width: 10, height: 10 }
    })
    const realDateNow = Date.now
    vi.spyOn(Date, 'now').mockImplementation(() => now++)

    await addPhotos([makeFile('first.jpg')], 2560)
    await addPhotos([makeFile('second.jpg')], 2560)

    const listed = await listPhotos()
    expect(listed[0].addedAt).toBeLessThan(listed[1].addedAt)

    vi.mocked(Date.now).mockRestore()
    Date.now = realDateNow
  })

  it('a bad file in a multi-file batch is reported in failed[] without aborting the rest', async () => {
    vi.mocked(processImage).mockImplementation(async (file: File) => {
      if (file.name === 'bad.jpg') {
        throw new PhotoImportError('Not an image file: text/plain')
      }
      return { blob: new Blob(['x']), width: 50, height: 50 }
    })

    const { added, failed } = await addPhotos(
      [makeFile('good1.jpg'), makeFile('bad.jpg'), makeFile('good2.jpg')],
      2560
    )

    expect(added).toHaveLength(2)
    expect(failed).toHaveLength(1)
    expect(failed[0].file.name).toBe('bad.jpg')
    expect(failed[0].error).toMatch(/not an image/i)
    expect(await listPhotos()).toHaveLength(2)
  })

  it('a non-PhotoImportError thrown by processImage is still captured, not rethrown', async () => {
    vi.mocked(processImage).mockRejectedValue(new Error('unexpected crash'))
    const { added, failed } = await addPhotos([makeFile('x.jpg')], 2560)
    expect(added).toHaveLength(0)
    expect(failed).toHaveLength(1)
    expect(failed[0].error).toBe('unexpected crash')
  })
})

describe('photos store — storage capability guards', () => {
  const originalStorage = (navigator as unknown as { storage?: StorageManager })
    .storage

  afterEach(() => {
    Object.defineProperty(navigator, 'storage', {
      value: originalStorage,
      configurable: true
    })
  })

  it('getStorageEstimate returns null without throwing when navigator.storage is unsupported', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: undefined,
      configurable: true
    })
    await expect(getStorageEstimate()).resolves.toBeNull()
  })

  it('getStorageEstimate converts bytes to MB when supported', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: {
        estimate: vi.fn().mockResolvedValue({
          usage: 10 * 1024 * 1024,
          quota: 100 * 1024 * 1024
        })
      },
      configurable: true
    })
    await expect(getStorageEstimate()).resolves.toEqual({
      usageMB: 10,
      quotaMB: 100
    })
  })

  it('getStorageEstimate returns null without throwing when estimate() rejects', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { estimate: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true
    })
    await expect(getStorageEstimate()).resolves.toBeNull()
  })

  it('requestPersistentStorage returns false without throwing when unsupported', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: undefined,
      configurable: true
    })
    await expect(requestPersistentStorage()).resolves.toBe(false)
  })

  it('requestPersistentStorage returns the API result when supported', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { persist: vi.fn().mockResolvedValue(true) },
      configurable: true
    })
    await expect(requestPersistentStorage()).resolves.toBe(true)
  })

  it('requestPersistentStorage returns false without throwing when persist() rejects', async () => {
    Object.defineProperty(navigator, 'storage', {
      value: { persist: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true
    })
    await expect(requestPersistentStorage()).resolves.toBe(false)
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  processImage,
  computeResizedDimensions,
  PhotoImportError
} from '../../../src/lib/photos/import'

/**
 * Environment note: this project's `vitest.config.ts` runs on `jsdom`,
 * which implements neither `createImageBitmap` nor a working
 * `<canvas>` 2D context (`getContext('2d')` returns `null`, confirmed by
 * probing it directly — no `canvas` npm package is installed to back it).
 * `OffscreenCanvas` is also undefined. So the real decode -> downscale ->
 * encode path cannot be exercised here at all; there is no jsdom-compatible
 * way to get a real decodable image through `createImageBitmap` in this
 * test environment.
 *
 * What *is* tested for real:
 * - `computeResizedDimensions`, the pure resize-math helper, exhaustively.
 * - `processImage`'s guard/error paths, which fire correctly *because*
 *   jsdom lacks these APIs (non-image rejection, unsupported-decode
 *   rejection) or via a minimal mocked `createImageBitmap` (decode-failure
 *   rejection, canvas-unavailable rejection) — without needing a real image.
 */

describe('computeResizedDimensions', () => {
  it('never upscales a source already within maxDim', () => {
    expect(computeResizedDimensions(800, 600, 2560)).toEqual({
      width: 800,
      height: 600
    })
  })

  it('leaves a source exactly at maxDim unchanged', () => {
    expect(computeResizedDimensions(2560, 1440, 2560)).toEqual({
      width: 2560,
      height: 1440
    })
  })

  it('downscales a landscape image so width caps at maxDim', () => {
    expect(computeResizedDimensions(5120, 2880, 2560)).toEqual({
      width: 2560,
      height: 1440
    })
  })

  it('downscales a portrait image so height caps at maxDim', () => {
    expect(computeResizedDimensions(2880, 5120, 2560)).toEqual({
      width: 1440,
      height: 2560
    })
  })

  it('preserves aspect ratio for a square image', () => {
    expect(computeResizedDimensions(4000, 4000, 2560)).toEqual({
      width: 2560,
      height: 2560
    })
  })

  it('never produces a zero dimension for an extreme aspect ratio', () => {
    const { width, height } = computeResizedDimensions(10000, 10, 2560)
    expect(width).toBe(2560)
    expect(height).toBeGreaterThanOrEqual(1)
  })
})

function setGlobalCreateImageBitmap(fn: unknown): void {
  const g = globalThis as { createImageBitmap?: unknown }
  g.createImageBitmap = fn
}

describe('processImage guard paths', () => {
  const originalCreateImageBitmap = (
    globalThis as { createImageBitmap?: unknown }
  ).createImageBitmap

  afterEach(() => {
    setGlobalCreateImageBitmap(originalCreateImageBitmap)
  })

  function makeFile(type: string, name = 'photo'): File {
    return new File(['not-real-image-bytes'], name, { type })
  }

  it('rejects a non-image file without attempting decode', async () => {
    const file = makeFile('text/plain')
    await expect(processImage(file, 2560)).rejects.toThrow(PhotoImportError)
    await expect(processImage(file, 2560)).rejects.toThrow(/not an image/i)
  })

  it('rejects when createImageBitmap is unsupported in this environment', async () => {
    // jsdom genuinely has no createImageBitmap — this exercises the real
    // capability guard, not a simulated one.
    expect(typeof globalThis.createImageBitmap).toBe('undefined')
    const file = makeFile('image/png')
    await expect(processImage(file, 2560)).rejects.toThrow(PhotoImportError)
    await expect(processImage(file, 2560)).rejects.toThrow(/not supported/i)
  })

  it('wraps a decode failure as PhotoImportError', async () => {
    setGlobalCreateImageBitmap(
      vi.fn().mockRejectedValue(new Error('corrupt image data'))
    )
    const file = makeFile('image/jpeg')
    await expect(processImage(file, 2560)).rejects.toThrow(PhotoImportError)
    await expect(processImage(file, 2560)).rejects.toThrow(/failed to decode/i)
  })

  it('rejects when no canvas backend is available to re-encode', async () => {
    // jsdom's <canvas> has no 2D context backend and no OffscreenCanvas, so
    // a bitmap that decodes "successfully" still can't be re-encoded here —
    // this exercises the real (not simulated) canvas-unavailable guard.
    const close = vi.fn()
    setGlobalCreateImageBitmap(
      vi.fn().mockResolvedValue({ width: 4000, height: 3000, close })
    )
    const file = makeFile('image/jpeg')
    await expect(processImage(file, 2560)).rejects.toThrow(PhotoImportError)
    await expect(processImage(file, 2560)).rejects.toThrow(/no canvas backend/i)
    // The decoded bitmap is released even though re-encoding failed.
    expect(close).toHaveBeenCalled()
  })
})

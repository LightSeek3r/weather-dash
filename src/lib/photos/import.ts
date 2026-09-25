/**
 * Import pipeline for one photo file: decode -> downscale -> re-encode.
 *
 * `createImageBitmap` decodes according to the image's EXIF orientation by
 * spec default (`imageOrientation: 'from-image'`) in every evergreen browser
 * this kiosk targets (Chrome/Edge/Firefox/Safari on iPad, Android tablet,
 * PC/TV) — passed explicitly below rather than relied on implicitly, since
 * older engines defaulted to `'none'`. No manual EXIF-parsing fallback is
 * built: a browser old enough to lack `createImageBitmap` entirely (there
 * is no evergreen browser in that state) isn't a realistic target for a
 * kiosk PWA, so `processImage` just fails cleanly (`PhotoImportError`) on
 * that environment instead of carrying a second decode path for it.
 */

/** Thrown for a single bad file — never a hard crash. Caller (`store.ts`) catches this per-file so one bad file in a multi-file picker can't abort the whole batch. */
export class PhotoImportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'PhotoImportError'
    if (options?.cause !== undefined) {
      // `Error`'s `cause` constructor option is ES2022; this project targets
      // ES2020, so assign it directly instead (still readable via `.cause`).
      const withCause = this as Error & { cause?: unknown }
      withCause.cause = options.cause
    }
  }
}

/**
 * Pure resize math, factored out so it's unit-testable without needing a
 * real image decode (jsdom has neither `createImageBitmap` nor a working
 * canvas backend — see import.test.ts for the environment note).
 * Preserves aspect ratio; never upscales a source already within `maxDim`.
 */
export function computeResizedDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxDim: number
): { width: number; height: number } {
  if (sourceWidth <= maxDim && sourceHeight <= maxDim) {
    return { width: sourceWidth, height: sourceHeight }
  }
  const scale = maxDim / Math.max(sourceWidth, sourceHeight)
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale))
  }
}

// deliberate: memoized across calls in the same session — probing WebP
// encode support redraws a throwaway 1x1 canvas, cheap but pointless to
// repeat for every file in a multi-file batch.
let webpSupportCache: boolean | null = null

function supportsWebpEncoding(): boolean {
  if (webpSupportCache !== null) return webpSupportCache
  webpSupportCache = false
  try {
    if (typeof document === 'undefined') return webpSupportCache
    const probe = document.createElement('canvas')
    probe.width = 1
    probe.height = 1
    // Canvas silently falls back to PNG on an unsupported requested type
    // instead of throwing, per spec — feature-detect via the returned MIME.
    webpSupportCache = probe
      .toDataURL('image/webp')
      .startsWith('data:image/webp')
  } catch {
    webpSupportCache = false
  }
  return webpSupportCache
}

interface DrawTarget {
  toBlob(mime: string, quality: number): Promise<Blob>
}

function makeOffscreenTarget(
  bitmap: ImageBitmap,
  width: number,
  height: number
): DrawTarget | null {
  if (typeof OffscreenCanvas === 'undefined') return null
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, width, height)
  return {
    toBlob: (mime, quality) => canvas.convertToBlob({ type: mime, quality })
  }
}

function makeRegularCanvasTarget(
  bitmap: ImageBitmap,
  width: number,
  height: number
): DrawTarget | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, 0, 0, width, height)
  return {
    toBlob: (mime, quality) =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('canvas.toBlob returned null'))
          },
          mime,
          quality
        )
      })
  }
}

/**
 * Decode `file`, downscale so neither dimension exceeds `maxDim` (caller
 * picks the value — e.g. screen size, ~2560 — this function stays
 * resolution-agnostic), and re-encode as WebP (falling back to JPEG when
 * WebP encoding isn't available in this environment).
 *
 * Throws `PhotoImportError` for a non-image file, a decode failure, or an
 * environment that can't decode/encode at all — never a raw/unclassified
 * exception, so the caller can distinguish "this file didn't work" from a
 * genuine crash.
 */
export async function processImage(
  file: File,
  maxDim: number
): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith('image/')) {
    throw new PhotoImportError(
      `Not an image file: ${file.type || 'unknown type'}`
    )
  }

  if (typeof createImageBitmap !== 'function') {
    throw new PhotoImportError(
      'createImageBitmap is not supported in this browser'
    )
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (err) {
    throw new PhotoImportError('Failed to decode image', { cause: err })
  }

  try {
    const { width, height } = computeResizedDimensions(
      bitmap.width,
      bitmap.height,
      maxDim
    )

    const target =
      makeOffscreenTarget(bitmap, width, height) ??
      makeRegularCanvasTarget(bitmap, width, height)
    if (!target) {
      throw new PhotoImportError(
        'No canvas backend available to re-encode image'
      )
    }

    const mime = supportsWebpEncoding() ? 'image/webp' : 'image/jpeg'
    let blob: Blob
    try {
      blob = await target.toBlob(mime, 0.85)
    } catch (err) {
      throw new PhotoImportError('Failed to encode resized image', {
        cause: err
      })
    }

    return { blob, width, height }
  } finally {
    // Release decoded pixel memory immediately — a 24/7 kiosk importing
    // many photos over time can't wait for GC (plan P2/P3: leak hardening).
    bitmap.close?.()
  }
}

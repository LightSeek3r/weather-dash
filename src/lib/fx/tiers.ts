/**
 * Border-FX quality tier selection (plan premortem P13: an old wall phone's
 * GPU may be too weak for WebGL). `high` = WebGL where an effect has a WebGL
 * variant, `eco` = Canvas2D only at reduced density/resolution, `off` = no
 * border effect at all.
 *
 * Auto-detection deliberately errs toward `eco`: no single capability signal
 * is authoritative, and several are simply absent outside Chromium
 * (`deviceMemory`, `connection`) — "unknown" must never be read as
 * "powerful", or an old tablet with no `deviceMemory` API ends up running a
 * fragment shader 24/7 it can't sustain.
 */
import type { Settings } from '../core/storage/settings'

export type FxTier = 'high' | 'eco' | 'off'

export interface FxCapabilities {
  /** A hardware-accelerated WebGL(2) context is obtainable (software rasterizers excluded). */
  webgl: boolean
  canvas2d: boolean
  /** `navigator.hardwareConcurrency`, absent when the browser doesn't expose it. */
  cores?: number
  /** `navigator.deviceMemory` in GB (Chromium-only, bucketed/clamped by the browser). */
  memoryGb?: number
  saveData?: boolean
}

interface NavigatorWithHints {
  hardwareConcurrency?: number
  deviceMemory?: number
  connection?: { saveData?: boolean }
}

function positiveNumber(x: unknown): number | undefined {
  return typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : undefined
}

const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|softpipe|software|basic render driver/i

function rendererName(gl: WebGLRenderingContext): string {
  const generic = String(gl.getParameter(gl.RENDERER) ?? '')
  // Chromium/Safari report a generic "WebKit WebGL" here; Firefox reports the
  // real (sanitised) name and deprecates the debug extension, so only fall
  // back to it when needed.
  if (generic && !/^webkit webgl$/i.test(generic)) return generic
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '') : ''
}

function probeWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas')
    // failIfMajorPerformanceCaveat makes the browser refuse (null) instead of
    // silently handing back a software rasterizer — but Chromium doesn't flag
    // SwiftShader as a caveat when it's enabled, hence the name check too.
    const opts: WebGLContextAttributes = { failIfMajorPerformanceCaveat: true }
    const gl = (canvas.getContext('webgl2', opts) ??
      canvas.getContext('webgl', opts)) as WebGLRenderingContext | null
    if (!gl) return false
    const software = SOFTWARE_RENDERER.test(rendererName(gl))
    // Contexts are a scarce per-page resource; don't hold the probe's until GC.
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return !software
  } catch {
    return false
  }
}

function probeCanvas2d(): boolean {
  try {
    return document.createElement('canvas').getContext('2d') !== null
  } catch {
    return false
  }
}

/** Reads every capability hint that exists in this browser. Never throws — each probe is individually optional. */
export function probeCapabilities(): FxCapabilities {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') {
    return { webgl: false, canvas2d: false }
  }
  const nav = navigator as unknown as NavigatorWithHints
  return {
    webgl: probeWebgl(),
    canvas2d: probeCanvas2d(),
    cores: positiveNumber(nav.hardwareConcurrency),
    memoryGb: positiveNumber(nav.deviceMemory),
    saveData: nav.connection?.saveData === true || undefined
  }
}

/** Pure decision table over probed capabilities — see module doc for the "unknown ≠ powerful" rule. */
export function tierFromCapabilities(c: FxCapabilities): FxTier {
  if (!c.canvas2d) return 'off'
  // deviceMemory buckets are 0.25/0.5/1/2/4/8: sub-1GB devices are the ones
  // that visibly stutter the clock under any continuous animation.
  if (c.memoryGb !== undefined && c.memoryGb < 1) return 'off'
  if (c.saveData) return 'eco'
  if (!c.webgl) return 'eco'
  if (c.cores === undefined) return 'eco'
  if (c.memoryGb !== undefined) {
    return c.cores >= 4 && c.memoryGb >= 4 ? 'high' : 'eco'
  }
  // No memory hint (Safari/Firefox): only a clearly desktop-class core count
  // is trusted with WebGL; everything else stays on Canvas2D.
  return c.cores >= 8 ? 'high' : 'eco'
}

let cachedTier: FxTier | null = null

/** Capability probe → tier. Memoized: hardware doesn't change mid-session, and each probe costs a WebGL context. */
export function detectFxTier(): FxTier {
  if (cachedTier === null) {
    try {
      cachedTier = tierFromCapabilities(probeCapabilities())
    } catch {
      cachedTier = 'eco'
    }
  }
  return cachedTier
}

/** Test helper — clears the `detectFxTier` memo (module-level, like weather store's `resetWeatherStoreForTests`). */
export function resetFxTierCacheForTests(): void {
  cachedTier = null
}

/** Settings `reducedMotion` + the OS `prefers-reduced-motion` query → effective boolean (`'auto'` defers to the OS). */
export function resolveReducedMotion(
  setting: Settings['reducedMotion'],
  osPrefersReduced: boolean
): boolean {
  if (setting === 'on') return true
  if (setting === 'off') return false
  return osPrefersReduced
}

export function resolveFxTier(
  setting: Settings['fxQuality'],
  reducedMotion: boolean
): FxTier {
  // Accessibility beats every quality preference, including an explicit 'high'.
  if (reducedMotion) return 'off'
  if (setting === 'auto') return detectFxTier()
  return setting
}

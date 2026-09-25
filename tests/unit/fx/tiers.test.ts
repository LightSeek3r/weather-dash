import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  detectFxTier,
  probeCapabilities,
  resetFxTierCacheForTests,
  resolveFxTier,
  resolveReducedMotion,
  tierFromCapabilities,
  type FxCapabilities
} from '../../../src/lib/fx/tiers'

interface FakeEnv {
  webgl2?: boolean
  webgl1?: boolean
  canvas2d?: boolean
  cores?: number
  memoryGb?: number
  saveData?: boolean
  throwOnGetContext?: boolean
  renderer?: string
  unmaskedRenderer?: string
}

const loseContext = vi.fn()

function installEnv(env: FakeEnv): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    function (this: HTMLCanvasElement, kind: string) {
      if (env.throwOnGetContext) throw new Error('boom')
      if (kind === '2d') return env.canvas2d === false ? null : ({} as never)
      const ok =
        (kind === 'webgl2' && env.webgl2) || (kind === 'webgl' && env.webgl1)
      if (!ok) return null
      const RENDERER = 0x1f01
      const UNMASKED_RENDERER_WEBGL = 0x9246
      return {
        RENDERER,
        getParameter: (p: number) =>
          p === RENDERER
            ? (env.renderer ?? 'WebKit WebGL')
            : p === UNMASKED_RENDERER_WEBGL
              ? (env.unmaskedRenderer ?? 'ANGLE (NVIDIA T1000, D3D11)')
              : null,
        getExtension: (name: string) =>
          name === 'WEBGL_lose_context'
            ? { loseContext }
            : name === 'WEBGL_debug_renderer_info'
              ? { UNMASKED_RENDERER_WEBGL }
              : null
      } as never
    } as never
  )
  const nav: Record<string, unknown> = {
    hardwareConcurrency: env.cores,
    deviceMemory: env.memoryGb
  }
  if (env.saveData !== undefined) nav.connection = { saveData: env.saveData }
  for (const [key, value] of Object.entries(nav)) {
    Object.defineProperty(navigator, key, { value, configurable: true })
  }
}

describe('probeCapabilities', () => {
  beforeEach(() => {
    resetFxTierCacheForTests()
    loseContext.mockClear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    for (const key of ['hardwareConcurrency', 'deviceMemory', 'connection']) {
      Object.defineProperty(navigator, key, {
        value: undefined,
        configurable: true
      })
    }
  })

  it('reads every hint and releases the WebGL probe context', () => {
    installEnv({ webgl2: true, cores: 8, memoryGb: 8, saveData: false })
    expect(probeCapabilities()).toEqual({
      webgl: true,
      canvas2d: true,
      cores: 8,
      memoryGb: 8,
      saveData: undefined
    })
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('falls back to WebGL1 when WebGL2 is unavailable', () => {
    installEnv({ webgl1: true, cores: 4 })
    expect(probeCapabilities().webgl).toBe(true)
  })

  it('rejects software rasterizers the caveat flag lets through', () => {
    installEnv({
      webgl2: true,
      unmaskedRenderer:
        'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'
    })
    expect(probeCapabilities().webgl).toBe(false)
    expect(loseContext).toHaveBeenCalledTimes(1) // still released
    installEnv({ webgl1: true, renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' })
    expect(probeCapabilities().webgl).toBe(false)
    installEnv({ webgl1: true, renderer: 'Microsoft Basic Render Driver' })
    expect(probeCapabilities().webgl).toBe(false)
  })

  it('reads the real renderer name when RENDERER is not generic (Firefox)', () => {
    installEnv({
      webgl2: true,
      renderer: 'Mali-G52',
      unmaskedRenderer: 'SwiftShader'
    })
    expect(probeCapabilities().webgl).toBe(true)
  })

  it('treats absent APIs as unknown, not as zero', () => {
    installEnv({})
    const caps = probeCapabilities()
    expect(caps.webgl).toBe(false)
    expect(caps.cores).toBeUndefined()
    expect(caps.memoryGb).toBeUndefined()
    expect(caps.saveData).toBeUndefined()
  })

  it('never throws when every canvas probe throws', () => {
    installEnv({ throwOnGetContext: true, cores: 8 })
    expect(() => probeCapabilities()).not.toThrow()
    expect(probeCapabilities()).toMatchObject({ webgl: false, canvas2d: false })
    expect(detectFxTier()).toBe('off')
  })

  it('detectFxTier combines probes and memoizes the result', () => {
    installEnv({ webgl2: true, cores: 8, memoryGb: 8 })
    expect(detectFxTier()).toBe('high')
    installEnv({ cores: 2 })
    expect(detectFxTier()).toBe('high') // memoized — hardware doesn't change mid-session
    resetFxTierCacheForTests()
    expect(detectFxTier()).toBe('eco')
  })

  it('downgrades on saveData even with strong hardware', () => {
    installEnv({ webgl2: true, cores: 8, memoryGb: 8, saveData: true })
    expect(detectFxTier()).toBe('eco')
  })
})

describe('tierFromCapabilities', () => {
  const strong: FxCapabilities = {
    webgl: true,
    canvas2d: true,
    cores: 8,
    memoryGb: 8
  }

  it('high only with WebGL + enough cores + enough memory', () => {
    expect(tierFromCapabilities(strong)).toBe('high')
    expect(tierFromCapabilities({ ...strong, cores: 4, memoryGb: 4 })).toBe(
      'high'
    )
  })

  it('no WebGL → eco', () => {
    expect(tierFromCapabilities({ ...strong, webgl: false })).toBe('eco')
  })

  it('low core count → eco', () => {
    expect(tierFromCapabilities({ ...strong, cores: 2 })).toBe('eco')
  })

  it('low (but not tiny) memory → eco', () => {
    expect(tierFromCapabilities({ ...strong, memoryGb: 2 })).toBe('eco')
  })

  it('sub-1GB memory → off', () => {
    expect(tierFromCapabilities({ ...strong, memoryGb: 0.5 })).toBe('off')
  })

  it('no Canvas2D at all → off', () => {
    expect(tierFromCapabilities({ ...strong, canvas2d: false })).toBe('off')
  })

  it('unknown core count → eco (never assumed powerful)', () => {
    expect(tierFromCapabilities({ ...strong, cores: undefined })).toBe('eco')
  })

  it('unknown memory: only a desktop-class core count earns high', () => {
    const noMem = { ...strong, memoryGb: undefined }
    expect(tierFromCapabilities({ ...noMem, cores: 4 })).toBe('eco')
    expect(tierFromCapabilities({ ...noMem, cores: 8 })).toBe('high')
  })

  it('saveData → eco', () => {
    expect(tierFromCapabilities({ ...strong, saveData: true })).toBe('eco')
  })
})

describe('resolveReducedMotion', () => {
  it('explicit on/off beat the OS preference; auto defers to it', () => {
    expect(resolveReducedMotion('on', false)).toBe(true)
    expect(resolveReducedMotion('off', true)).toBe(false)
    expect(resolveReducedMotion('auto', true)).toBe(true)
    expect(resolveReducedMotion('auto', false)).toBe(false)
  })
})

describe('resolveFxTier', () => {
  beforeEach(() => resetFxTierCacheForTests())
  afterEach(() => vi.restoreAllMocks())

  it('reduced motion beats every setting, including explicit high', () => {
    for (const setting of ['auto', 'high', 'eco', 'off'] as const) {
      expect(resolveFxTier(setting, true)).toBe('off')
    }
  })

  it('explicit settings beat auto-detection', () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    expect(resolveFxTier('high', false)).toBe('high')
    expect(resolveFxTier('eco', false)).toBe('eco')
    expect(resolveFxTier('off', false)).toBe('off')
    expect(spy).not.toHaveBeenCalled() // no probe unless 'auto'
  })

  it("'auto' runs the capability probe", () => {
    installEnv({ webgl2: true, cores: 8, memoryGb: 8 })
    expect(resolveFxTier('auto', false)).toBe('high')
    resetFxTierCacheForTests()
    installEnv({ cores: 8, memoryGb: 8 })
    expect(resolveFxTier('auto', false)).toBe('eco')
  })
})

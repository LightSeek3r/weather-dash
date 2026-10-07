import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  densityFor,
  loadEffect,
  pickEffect,
  type EffectId
} from '../../../src/lib/fx/border'
import type {
  ActiveTier,
  EffectOptions
} from '../../../src/lib/fx/border/types'
import { scheduler } from '../../../src/lib/core/scheduler'
import { edgeFactor } from '../../../src/lib/fx/border/common'

describe('edgeFactor', () => {
  const W = 1000
  const H = 600
  const B = 100

  it('is 1 at the edge and 0 past the band', () => {
    expect(edgeFactor(0, 300, W, H, B)).toBe(1)
    expect(edgeFactor(500, 300, W, H, B)).toBe(0)
    expect(edgeFactor(500, B + 1, W, H, B)).toBe(0)
  })

  it('rounds the inner corner instead of meeting at a right angle', () => {
    // On the inner rect's corner diagonal, a nearest-edge ring would still
    // be at its band-edge value (0); the rounded ring must be too, and a
    // point just inside the corner's arc must be lit less than the same
    // depth along a straight edge.
    expect(edgeFactor(B, B, W, H, B)).toBe(0)
    const straight = edgeFactor(500, B * 0.6, W, H, B)
    const corner = edgeFactor(B * 0.72, B * 0.72, W, H, B)
    expect(corner).toBeGreaterThan(0)
    expect(Math.abs(corner - straight)).toBeLessThan(0.05)
  })
})

describe('pickEffect', () => {
  it('clear splits by day/night', () => {
    expect(pickEffect('clear', true, 'high')).toBe('sun')
    expect(pickEffect('clear', false, 'eco')).toBe('stars')
  })

  it('rain and drizzle use the WebGL drops only on the high tier', () => {
    expect(pickEffect('rain', true, 'high')).toBe('rain-webgl')
    expect(pickEffect('drizzle', false, 'high')).toBe('rain-webgl')
    expect(pickEffect('rain', true, 'eco')).toBe('rain-eco')
    expect(pickEffect('drizzle', true, 'eco')).toBe('rain-eco')
  })

  it('maps the remaining categories one-to-one regardless of tier', () => {
    for (const tier of ['high', 'eco'] as const) {
      expect(pickEffect('cloudy', true, tier)).toBe('cloudy')
      expect(pickEffect('fog', false, tier)).toBe('fog')
      expect(pickEffect('snow', true, tier)).toBe('snow')
      expect(pickEffect('storm', false, tier)).toBe('storm')
    }
  })
})

describe('densityFor', () => {
  it('scales with intensity and keeps drizzle lighter than rain', () => {
    expect(densityFor('rain', 'light')).toBeLessThan(
      densityFor('rain', 'heavy')
    )
    expect(densityFor('drizzle', 'heavy')).toBeLessThan(
      densityFor('rain', 'heavy')
    )
    expect(densityFor('rain', 'heavy')).toBe(1)
  })

  it('storms are always near-full density; no intensity → moderate', () => {
    expect(densityFor('storm', 'light')).toBeGreaterThanOrEqual(0.85)
    expect(densityFor('snow', undefined)).toBe(densityFor('snow', 'moderate'))
  })
})

// --- Mount/unmount lifecycle against stubbed canvas contexts --------------

/** Accepts any property read/call/write — stands in for a 2D context or gradient. */
function universalStub(overrides: Record<string, unknown> = {}): unknown {
  const fn = function () {}
  return new Proxy(fn, {
    get(_t, prop) {
      if (prop in overrides) return overrides[prop as string]
      if (prop === 'then') return undefined
      return () => universalStub()
    },
    set: () => true
  })
}

function fakeRaf() {
  let nextId = 1
  const pending = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++
    pending.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id))
  let now = 0
  return {
    pendingCount: () => pending.size,
    frames(count: number, ms: number) {
      for (let i = 0; i < count; i++) {
        now += ms
        const cbs = [...pending.values()]
        pending.clear()
        for (const cb of cbs) cb(now)
      }
    }
  }
}

const loseContext = vi.fn()
let webglAvailable = true

function installCanvasStubs(): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((
    kind: string
  ) => {
    if (kind === '2d') return universalStub()
    if (!webglAvailable) return null
    return universalStub({
      isContextLost: () => false,
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getAttribLocation: () => 0,
      getExtension: (name: string) =>
        name === 'WEBGL_lose_context' ? { loseContext } : null
    })
  }) as never)
}

const ALL: EffectId[] = [
  'sun',
  'stars',
  'cloudy',
  'fog',
  'rain-webgl',
  'rain-eco',
  'snow',
  'storm'
]

describe('border effect lifecycle', () => {
  let host: HTMLDivElement

  beforeEach(() => {
    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true
    })
    webglAvailable = true
    loseContext.mockClear()
    installCanvasStubs()
    host = document.createElement('div')
    document.body.appendChild(host)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    host.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  for (const id of ALL) {
    for (const tier of ['high', 'eco'] as ActiveTier[]) {
      it(`${id} (${tier}) draws, then unmount leaves nothing behind`, async () => {
        const raf = fakeRaf()
        const addWin = vi.spyOn(window, 'addEventListener')
        const removeWin = vi.spyOn(window, 'removeEventListener')
        const addDoc = vi.spyOn(document, 'addEventListener')
        const removeDoc = vi.spyOn(document, 'removeEventListener')

        const fx = (await loadEffect(id))()
        fx.mount(host, { tier, density: 0.8 })
        expect(host.querySelector('canvas')).not.toBeNull()
        expect(raf.pendingCount()).toBe(1)
        expect(() => raf.frames(90, 1000 / 60)).not.toThrow()

        fx.unmount()
        expect(host.childElementCount).toBe(0)
        expect(raf.pendingCount()).toBe(0)
        expect(removeWin.mock.calls.length).toBe(addWin.mock.calls.length)
        // jsdom lazily adds its own mouseover/mouseout document listeners on first use.
        const visibility = (spy: typeof addDoc) =>
          spy.mock.calls.filter((c) => c[0] === 'visibilitychange').length
        expect(visibility(addDoc)).toBeGreaterThan(0)
        expect(visibility(removeDoc)).toBe(visibility(addDoc))
        if (id === 'rain-webgl' || (id === 'storm' && tier === 'high')) {
          expect(loseContext).toHaveBeenCalledTimes(1)
        }
        // Idempotent: a second unmount (e.g. racing teardown) is harmless.
        expect(() => fx.unmount()).not.toThrow()
      })
    }
  }

  it('rain-webgl falls back to Canvas2D when no WebGL context exists', async () => {
    webglAvailable = false
    const raf = fakeRaf()
    const fx = (await loadEffect('rain-webgl'))()
    fx.mount(host, { tier: 'high', density: 1 })
    const canvases = host.querySelectorAll('canvas')
    expect(canvases).toHaveLength(1)
    expect(canvases[0].dataset.renderer).toBe('2d')
    fx.unmount()
    expect(host.childElementCount).toBe(0)
    expect(raf.pendingCount()).toBe(0)
  })

  it('rain-webgl degrades to Canvas2D under sustained slow frames, releasing its context', async () => {
    const raf = fakeRaf()
    const fx = (await loadEffect('rain-webgl'))()
    fx.mount(host, { tier: 'high', density: 1 })
    expect(host.querySelector('canvas')?.dataset.renderer).toBe('webgl')

    raf.frames(60, 1000 / 60) // healthy: stays on WebGL
    expect(host.querySelector('canvas')?.dataset.renderer).toBe('webgl')

    raf.frames(150, 100) // ~10fps for 15s
    const canvases = host.querySelectorAll('canvas')
    expect(canvases).toHaveLength(1)
    expect(canvases[0].dataset.renderer).toBe('2d')
    expect(loseContext).toHaveBeenCalledTimes(1)
    expect(raf.pendingCount()).toBe(1) // only the eco loop remains

    fx.unmount()
    expect(host.childElementCount).toBe(0)
    expect(raf.pendingCount()).toBe(0)
  })

  it('storm strikes via the scheduler second tick and unsubscribes on unmount', async () => {
    fakeRaf()
    let tick: (() => void) | null = null
    const unsubscribe = vi.fn()
    vi.spyOn(scheduler, 'on').mockImplementation((kind, fn) => {
      expect(kind).toBe('second')
      tick = () => fn(new Date())
      return unsubscribe
    })
    const animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation)
    const proto = HTMLElement.prototype as unknown as { animate?: unknown }
    const hadAnimate = 'animate' in proto
    proto.animate = animate

    const fx = (await loadEffect('storm'))()
    fx.mount(host, { tier: 'eco', density: 1 })
    expect(host.querySelector('[data-fx-flash]')).not.toBeNull()
    const ticksUntilStrike = (max: number): number => {
      const before = animate.mock.calls.length
      for (let i = 1; i <= max; i++) {
        tick!()
        if (animate.mock.calls.length > before) return i
      }
      return Infinity
    }
    const first = ticksUntilStrike(20)
    expect(first).toBeGreaterThanOrEqual(3)
    expect(first).toBeLessThanOrEqual(8)
    const second = ticksUntilStrike(40)
    expect(second).toBeGreaterThanOrEqual(6)
    expect(second).toBeLessThanOrEqual(20)

    fx.unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(host.childElementCount).toBe(0)
    if (!hadAnimate) delete proto.animate
  })

  it('repeated mount/unmount cycles never accumulate canvases or loops', async () => {
    const raf = fakeRaf()
    for (let i = 0; i < 40; i++) {
      const id = ALL[i % ALL.length]
      const fx = (await loadEffect(id))()
      fx.mount(host, { tier: i % 2 ? 'eco' : 'high', density: 0.6 })
      raf.frames(3, 1000 / 60)
      expect(host.querySelectorAll('canvas').length).toBe(1)
      fx.unmount()
    }
    expect(host.childElementCount).toBe(0)
    expect(raf.pendingCount()).toBe(0)
  })

  for (const id of ALL) {
    it(`${id} frozen renders one still frame with no loop`, async () => {
      const raf = fakeRaf()
      const addDoc = vi.spyOn(document, 'addEventListener')
      const fx = (await loadEffect(id))()
      fx.mount(host, { tier: 'high', density: 0.8, frozen: true })
      expect(host.querySelectorAll('canvas')).toHaveLength(1)
      expect(raf.pendingCount()).toBe(0)
      expect(
        addDoc.mock.calls.filter((c) => c[0] === 'visibilitychange')
      ).toHaveLength(0)
      fx.unmount()
      expect(host.childElementCount).toBe(0)
    })
  }

  it('icy precipitation runs on Canvas2D, including from the WebGL rain module', async () => {
    const raf = fakeRaf()
    const cases: [EffectId, EffectOptions][] = [
      [
        'rain-webgl',
        { tier: 'high', density: 1, conditionKey: 'freezingRain' }
      ],
      ['rain-webgl', { tier: 'high', density: 1, hail: true }],
      [
        'rain-eco',
        { tier: 'eco', density: 0.75, conditionKey: 'freezingDrizzle' }
      ],
      ['snow', { tier: 'high', density: 0.75, conditionKey: 'snowGrains' }],
      ['snow', { tier: 'eco', density: 1, hail: true }]
    ]
    for (const [id, opts] of cases) {
      const fx = (await loadEffect(id))()
      fx.mount(host, opts)
      const canvases = host.querySelectorAll('canvas')
      expect(canvases).toHaveLength(1)
      expect(canvases[0].dataset.renderer).toBe('2d')
      expect(() => raf.frames(60, 1000 / 30)).not.toThrow()
      fx.unmount()
      expect(host.childElementCount).toBe(0)
      expect(raf.pendingCount()).toBe(0)
    }
    expect(loseContext).not.toHaveBeenCalled()
  })

  it('sun and stars read the live celestial position every frame without remounting', async () => {
    const raf = fakeRaf()
    for (const id of ['sun', 'stars'] as const) {
      const celestial = vi.fn(() => ({
        body: id === 'sun' ? ('sun' as const) : ('moon' as const),
        fraction: 0.4,
        x: 0.4,
        y: 0.3
      }))
      const fx = (await loadEffect(id))()
      fx.mount(host, { tier: 'high', density: 0.5, celestial })
      raf.frames(30, 1000 / 30)
      expect(celestial.mock.calls.length).toBeGreaterThan(1)
      fx.unmount()
    }
    expect(host.childElementCount).toBe(0)
  })

  describe('with a front host', () => {
    let front: HTMLDivElement
    // Effects that let some of their elements pass in front of the page text.
    const FRONT: EffectId[] = [
      'sun',
      'cloudy',
      'snow',
      'rain-eco',
      'rain-webgl',
      'storm'
    ]
    const frontCount = (id: EffectId) => (FRONT.includes(id) ? 1 : 0)

    beforeEach(() => {
      front = document.createElement('div')
      document.body.appendChild(front)
    })
    afterEach(() => front.remove())

    for (const id of ALL) {
      for (const tier of ['high', 'eco'] as ActiveTier[]) {
        it(`${id} (${tier}) draws ${frontCount(id)} front canvas in the same loop, released on unmount`, async () => {
          const raf = fakeRaf()
          const fx = (await loadEffect(id))()
          fx.mount(host, { tier, density: 0.8, front })
          expect(host.querySelectorAll('canvas')).toHaveLength(1)
          expect(front.querySelectorAll('canvas')).toHaveLength(frontCount(id))
          expect(raf.pendingCount()).toBe(1)
          expect(() => raf.frames(90, 1000 / 60)).not.toThrow()

          fx.unmount()
          expect(host.childElementCount).toBe(0)
          expect(front.childElementCount).toBe(0)
          expect(raf.pendingCount()).toBe(0)
          if (id === 'rain-webgl' || (id === 'storm' && tier === 'high')) {
            expect(loseContext).toHaveBeenCalledTimes(1)
          }
        })
      }

      it(`${id} frozen fills the front canvas too, with no loop`, async () => {
        const raf = fakeRaf()
        const fx = (await loadEffect(id))()
        fx.mount(host, { tier: 'high', density: 0.8, frozen: true, front })
        expect(front.querySelectorAll('canvas')).toHaveLength(frontCount(id))
        expect(raf.pendingCount()).toBe(0)
        fx.unmount()
        expect(front.childElementCount).toBe(0)
      })
    }

    it('rain-webgl without WebGL hands the front layer to the Canvas2D rain', async () => {
      webglAvailable = false
      fakeRaf()
      const fx = (await loadEffect('rain-webgl'))()
      fx.mount(host, { tier: 'high', density: 1, front })
      expect(host.querySelectorAll('canvas')).toHaveLength(1)
      expect(front.querySelectorAll('canvas')).toHaveLength(1)
      fx.unmount()
      expect(front.childElementCount).toBe(0)
    })

    it('rain-webgl degrading mid-run swaps its front canvas, never doubling it', async () => {
      const raf = fakeRaf()
      const fx = (await loadEffect('rain-webgl'))()
      fx.mount(host, { tier: 'high', density: 1, front })
      raf.frames(150, 100)
      expect(host.querySelector('canvas')?.dataset.renderer).toBe('2d')
      expect(front.querySelectorAll('canvas')).toHaveLength(1)
      expect(raf.pendingCount()).toBe(1)
      fx.unmount()
      expect(front.childElementCount).toBe(0)
      expect(raf.pendingCount()).toBe(0)
    })
  })
})

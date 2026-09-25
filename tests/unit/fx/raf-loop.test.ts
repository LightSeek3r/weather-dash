import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createCappedLoop } from '../../../src/lib/fx/raf-loop'

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    value: hidden,
    configurable: true
  })
}

/** Manual rAF: frames only run when the test says so, at timestamps the test picks. */
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
    /** Advance the display clock by `ms` and run one vsync. */
    frame(ms: number) {
      now += ms
      const callbacks = [...pending.values()]
      pending.clear()
      for (const cb of callbacks) cb(now)
    },
    /** Run `count` vsyncs at a fixed refresh interval. */
    frames(count: number, ms: number) {
      for (let i = 0; i < count; i++) this.frame(ms)
    }
  }
}

describe('createCappedLoop', () => {
  beforeEach(() => setHidden(false))
  afterEach(() => {
    vi.unstubAllGlobals()
    setHidden(false)
  })

  it('throttles a 60Hz display to ~30fps', () => {
    const raf = fakeRaf()
    const onFrame = vi.fn()
    const loop = createCappedLoop(30, onFrame)
    loop.start()
    raf.frames(61, 1000 / 60) // first vsync + 1s of vsyncs
    // 1 baseline frame + 30 in the following second
    expect(onFrame).toHaveBeenCalledTimes(31)
    loop.stop()
  })

  it('throttles a 144Hz display to ~30fps on average', () => {
    const raf = fakeRaf()
    const onFrame = vi.fn()
    const loop = createCappedLoop(30, onFrame)
    loop.start()
    raf.frames(1 + 144 * 2, 1000 / 144)
    const calls = onFrame.mock.calls.length - 1
    expect(calls).toBeGreaterThanOrEqual(58)
    expect(calls).toBeLessThanOrEqual(61)
    loop.stop()
  })

  it('tolerates vsync jitter instead of dropping to 20fps', () => {
    const raf = fakeRaf()
    const onFrame = vi.fn()
    const loop = createCappedLoop(30, onFrame)
    loop.start()
    raf.frame(0)
    // Alternating slightly-early/late 60Hz vsyncs.
    for (let i = 0; i < 60; i++) raf.frame(i % 2 ? 16.9 : 16.4)
    expect(onFrame.mock.calls.length - 1).toBeGreaterThanOrEqual(29)
    loop.stop()
  })

  it('passes real elapsed ms since the last executed frame, not the rAF delta', () => {
    const raf = fakeRaf()
    const deltas: number[] = []
    const loop = createCappedLoop(30, (d) => deltas.push(d))
    loop.start()
    raf.frames(7, 1000 / 60)
    expect(deltas[0]).toBe(0)
    for (const d of deltas.slice(1)) expect(d).toBeCloseTo(1000 / 30, 5)
    loop.stop()
  })

  it('clamps a long stall to 250ms', () => {
    const raf = fakeRaf()
    const deltas: number[] = []
    const loop = createCappedLoop(30, (d) => deltas.push(d))
    loop.start()
    raf.frame(0)
    raf.frame(5000)
    expect(deltas).toEqual([0, 250])
    loop.stop()
  })

  it('pauses while hidden and resumes (with a fresh baseline) on return', () => {
    const raf = fakeRaf()
    const deltas: number[] = []
    const loop = createCappedLoop(30, (d) => deltas.push(d))
    loop.start()
    raf.frames(5, 1000 / 60)
    const before = deltas.length

    setHidden(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(raf.pendingCount()).toBe(0)
    raf.frames(120, 1000 / 60)
    expect(deltas.length).toBe(before)

    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(raf.pendingCount()).toBe(1)
    raf.frame(1000 / 60)
    // Resumed frame is a new baseline, not a 2-second jump.
    expect(deltas[deltas.length - 1]).toBe(0)
    loop.stop()
  })

  it('does not schedule anything when started while hidden', () => {
    const raf = fakeRaf()
    setHidden(true)
    const onFrame = vi.fn()
    const loop = createCappedLoop(30, onFrame)
    loop.start()
    expect(raf.pendingCount()).toBe(0)
    setHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))
    raf.frame(16)
    expect(onFrame).toHaveBeenCalledTimes(1)
    loop.stop()
  })

  it('stop() cancels the pending frame and removes the visibility listener', () => {
    const raf = fakeRaf()
    const remove = vi.spyOn(document, 'removeEventListener')
    const onFrame = vi.fn()
    const loop = createCappedLoop(30, onFrame)
    loop.start()
    raf.frame(16)
    loop.stop()
    expect(raf.pendingCount()).toBe(0)
    expect(remove).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    )

    // A visibility flip after stop() must not revive the loop.
    document.dispatchEvent(new Event('visibilitychange'))
    raf.frames(10, 16)
    expect(onFrame).toHaveBeenCalledTimes(1)
    remove.mockRestore()
  })

  it('start() is idempotent — never two rAF chains', () => {
    const raf = fakeRaf()
    const loop = createCappedLoop(30, () => {})
    loop.start()
    loop.start()
    expect(raf.pendingCount()).toBe(1)
    loop.stop()
  })
})

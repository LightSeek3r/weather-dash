/**
 * Frame-capped `requestAnimationFrame` loop shared by every FX module (plan
 * premortem P3: FX capped ~30fps, paused on `document.hidden`). A 24/7 wall
 * display has no use for 60/120Hz ambient animation — halving the frame
 * count halves the GPU/CPU heat for no visible loss at these motion speeds.
 */

export interface CappedLoop {
  start(): void
  stop(): void
}

// A frame that lands this close under the interval still counts — rAF
// timestamps jitter by a fraction of a ms, and without slack a 30fps cap on
// a 60Hz display would randomly skip to 20fps (every third vsync).
const JITTER_SLACK_MS = 1.5
// Clamp so one long stall (debugger, GC, tab thaw) can't teleport every
// particle; still far above any real frame interval the loop produces.
const MAX_DELTA_MS = 250

export function createCappedLoop(
  fps: number,
  onFrame: (deltaMs: number) => void
): CappedLoop {
  const interval = 1000 / Math.max(1, fps)
  let running = false
  let rafId: number | null = null
  // Cadence anchor (advanced in whole intervals) vs the real time of the
  // last executed frame — the anchor keeps the average rate on target, the
  // real time is what callers get as their delta.
  let anchor = -1
  let lastExec = -1

  const hasDocument = typeof document !== 'undefined'
  const isHidden = (): boolean => hasDocument && document.hidden

  function tick(now: number): void {
    rafId = requestAnimationFrame(tick)
    if (anchor < 0) {
      anchor = now
      lastExec = now
      onFrame(0)
      return
    }
    const sinceAnchor = now - anchor
    if (sinceAnchor < interval - JITTER_SLACK_MS) return
    // Advance the anchor by exactly one interval so the average rate stays
    // on target; if we fell far behind, resync instead of bursting.
    anchor = sinceAnchor > interval * 2 ? now : anchor + interval
    const delta = Math.min(now - lastExec, MAX_DELTA_MS)
    lastExec = now
    onFrame(delta)
  }

  function schedule(): void {
    if (rafId !== null) return
    anchor = -1
    lastExec = -1
    rafId = requestAnimationFrame(tick)
  }

  function cancel(): void {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
  }

  function onVisibility(): void {
    if (!running) return
    if (isHidden()) cancel()
    else schedule()
  }

  return {
    start() {
      if (running) return
      running = true
      if (hasDocument) {
        document.addEventListener('visibilitychange', onVisibility)
      }
      if (!isHidden()) schedule()
    },
    stop() {
      if (!running) return
      running = false
      cancel()
      if (hasDocument) {
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }
}

/**
 * Night-mode schedule check (plan decision: scheduled dim overlay, FX +
 * fullscreen scenes paused). Pure — callers pass `now` so tests and the
 * minute tick share one code path.
 *
 * Window semantics: `[start, end)` at minute resolution — `start` itself is
 * inside the window, `end` itself is outside. With the default 22:00-07:00,
 * 22:00 is night and 07:00 is day. `start > end` wraps past midnight;
 * `start === end` is an empty window (never night), which doubles as the
 * "night mode off" setting without needing a separate toggle.
 */

const TIME_RE = /^(\d{1,2}):(\d{2})$/

/** Minutes since local midnight for an `"HH:MM"` string, or `null` if malformed. Exported for `nightly-reload.ts`, which parses the same format. */
export function parseTimeOfDay(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = TIME_RE.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function isNightMode(now: Date, start: string, end: string): boolean {
  const startMin = parseTimeOfDay(start)
  const endMin = parseTimeOfDay(end)
  // Malformed schedule -> day. A kiosk stuck permanently dimmed because of
  // one bad settings value is worse than one that never dims.
  if (startMin === null || endMin === null) return false
  if (startMin === endMin) return false

  const nowMin = now.getHours() * 60 + now.getMinutes()
  return startMin < endMin
    ? nowMin >= startMin && nowMin < endMin
    : nowMin >= startMin || nowMin < endMin
}

import { describe, it, expect } from 'vitest'
import { readDebugParams } from '../../../src/lib/core/debug-params'

describe('readDebugParams', () => {
  it('defaults to not frozen, no now, no weather for an empty query string', () => {
    const params = readDebugParams('')
    expect(params).toEqual({
      freeze: false,
      now: null,
      weather: null,
      update: false
    })
  })

  it('freeze=1 without ?now defaults now to "real now" at read time', () => {
    const before = Date.now()
    const params = readDebugParams('?freeze=1')
    const after = Date.now()

    expect(params.freeze).toBe(true)
    expect(params.now).toBeInstanceOf(Date)
    expect(params.now!.getTime()).toBeGreaterThanOrEqual(before)
    expect(params.now!.getTime()).toBeLessThanOrEqual(after)
  })

  it('?now= alone implies freeze (a fixed now with a running clock makes no sense)', () => {
    const params = readDebugParams('?now=2026-01-15T12:00:00.000Z')
    expect(params.freeze).toBe(true)
    expect(params.now?.toISOString()).toBe('2026-01-15T12:00:00.000Z')
  })

  it('freeze=1 with an explicit ?now uses that exact instant', () => {
    const params = readDebugParams('?freeze=1&now=2026-06-01T08:30:00.000Z')
    expect(params.freeze).toBe(true)
    expect(params.now?.toISOString()).toBe('2026-06-01T08:30:00.000Z')
  })

  it('an unparsable ?now falls back to real "now" rather than crashing', () => {
    const params = readDebugParams('?freeze=1&now=not-a-date')
    expect(params.freeze).toBe(true)
    expect(params.now).toBeInstanceOf(Date)
    expect(Number.isNaN(params.now!.getTime())).toBe(false)
  })

  it('freeze=0 or any other value is not treated as freeze=1', () => {
    expect(readDebugParams('?freeze=0').freeze).toBe(false)
    expect(readDebugParams('?freeze=true').freeze).toBe(false)
  })

  it("passes ?weather= through verbatim, unvalidated (validation is the caller's job)", () => {
    expect(readDebugParams('?weather=rain').weather).toBe('rain')
    expect(readDebugParams('?weather=not-a-real-state').weather).toBe(
      'not-a-real-state'
    )
    expect(readDebugParams('').weather).toBeNull()
  })

  it('all three params combine independently', () => {
    const params = readDebugParams(
      '?freeze=1&now=2026-01-15T23:00:00.000Z&weather=storm'
    )
    expect(params).toEqual({
      freeze: true,
      now: new Date('2026-01-15T23:00:00.000Z'),
      weather: 'storm',
      update: false
    })
  })
})

describe('readDebugParams update', () => {
  it('?update=1 simulates a waiting app version, anything else does not', () => {
    expect(readDebugParams('?update=1').update).toBe(true)
    expect(readDebugParams('?update=0').update).toBe(false)
    expect(readDebugParams('').update).toBe(false)
  })
})

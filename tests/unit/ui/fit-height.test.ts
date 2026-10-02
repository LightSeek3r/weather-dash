import { describe, it, expect } from 'vitest'
import { shrinkFit, MIN_FIT } from '../../../src/lib/ui/fit-height'

describe('shrinkFit', () => {
  it('keeps full size when the content already fits', () => {
    expect(shrinkFit(0, 300)).toBe(1)
    expect(shrinkFit(-40, 300)).toBe(1)
  })

  it('shrinks the target by exactly the overflow, plus a rounding pixel', () => {
    // 300px clock, 59px too much: 240px left for it.
    expect(shrinkFit(59, 300)).toBeCloseTo(0.8)
  })

  it('never goes below the floor', () => {
    expect(shrinkFit(1000, 300)).toBe(MIN_FIT)
  })

  it('ignores a target that is not rendered', () => {
    expect(shrinkFit(50, 0)).toBe(1)
  })
})

import { describe, it, expect } from 'vitest'
import { beaufortForce } from '../../../src/lib/weather/beaufort'

describe('beaufortForce', () => {
  it.each([
    [0, 0],
    [1, 0],
    [2, 1],
    [5, 1],
    [6, 2],
    [11, 2],
    [12, 3],
    [19, 3],
    [20, 4],
    [28, 4],
    [29, 5],
    [38, 5],
    [39, 6],
    [49, 6],
    [50, 7],
    [61, 7],
    [62, 8],
    [74, 8],
    [75, 9],
    [88, 9],
    [89, 10],
    [102, 10],
    [103, 11],
    [117, 11],
    [118, 12],
    [200, 12]
  ])('%i km/h -> force %i', (kmh, expected) => {
    expect(beaufortForce(kmh)).toBe(expected)
  })

  it('clamps negative input to force 0', () => {
    expect(beaufortForce(-5)).toBe(0)
  })
})

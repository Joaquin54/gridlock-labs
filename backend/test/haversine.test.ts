import { describe, expect, test } from 'bun:test'
import { haversineMi } from '../src/lib/haversine'

describe('haversineMi', () => {
  test('matches a known pair', () => {
    // Augusta GA -> Columbia SC. Cross-checked against the haversine SQL in
    // queries/overlaps.ts, which agrees to the last float digit.
    expect(haversineMi(33.4735, -82.0105, 34.0007, -81.0348)).toBeCloseTo(66.86, 2)
  })

  test('agrees with the SQL expression on the fixture pair', () => {
    // 3.63029384422508 is what Postgres returns for DESC:6810 A x GPC:20793.
    expect(haversineMi(33.65, -82.175, 33.5985, -82.1625)).toBeCloseTo(3.63029384422508, 10)
  })

  test('is zero for identical points', () => {
    expect(haversineMi(33.64, -82.16, 33.64, -82.16)).toBe(0)
  })

  test('is symmetric', () => {
    const forward = haversineMi(33.64, -82.16, 33.663, -82.195)
    const back = haversineMi(33.663, -82.195, 33.64, -82.16)
    expect(forward).toBeCloseTo(back, 10)
  })

  test('the fixture Thurmond points count as one shared asset', () => {
    expect(haversineMi(33.66, -82.19, 33.663, -82.195)).toBeLessThan(0.5)
  })
})

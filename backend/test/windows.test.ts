import { describe, expect, test } from 'bun:test'
import { inServiceGapDays, windowGapDays, windowOverlapDays } from '../src/lib/windows'

describe('inServiceGapDays', () => {
  test('is the absolute difference in days', () => {
    expect(inServiceGapDays('2024-12-31', '2033-06-01')).toBe(3074)
    expect(inServiceGapDays('2033-06-01', '2024-12-31')).toBe(3074)
  })

  test('is zero for the same date', () => {
    expect(inServiceGapDays('2024-12-31', '2024-12-31')).toBe(0)
  })
})

describe('windowOverlapDays / windowGapDays', () => {
  test('overlapping windows: overlap is positive, gap is zero', () => {
    const a = { start: '2024-01-01', inService: '2025-01-01' }
    const b = { start: '2024-07-01', inService: '2026-01-01' }
    expect(windowOverlapDays(a, b)).toBe(184)
    expect(windowGapDays(a, b)).toBe(0)
  })

  test('disjoint windows: gap is positive, overlap is zero', () => {
    const a = { start: '2021-12-31', inService: '2024-12-31' }
    const b = { start: '2030-06-01', inService: '2033-06-01' }
    expect(windowGapDays(a, b)).toBe(1978)
    expect(windowOverlapDays(a, b)).toBe(0)
  })

  test('identical windows overlap over their whole length', () => {
    const a = { start: '2024-01-01', inService: '2024-12-31' }
    expect(windowOverlapDays(a, { ...a })).toBe(365)
    expect(windowGapDays(a, { ...a })).toBe(0)
  })

  test('windows that just touch give zero for both', () => {
    const a = { start: '2024-01-01', inService: '2025-01-01' }
    const b = { start: '2025-01-01', inService: '2026-01-01' }
    expect(windowOverlapDays(a, b)).toBe(0)
    expect(windowGapDays(a, b)).toBe(0)
  })

  test('at most one of the two is non-zero', () => {
    const pairs = [
      [{ start: '2024-01-01', inService: '2025-01-01' }, { start: '2024-06-01', inService: '2026-01-01' }],
      [{ start: '2021-12-31', inService: '2024-12-31' }, { start: '2030-06-01', inService: '2033-06-01' }],
      [{ start: '2024-01-01', inService: '2024-12-31' }, { start: '2024-01-01', inService: '2024-12-31' }],
    ] as const
    for (const [a, b] of pairs) {
      const overlap = windowOverlapDays(a, b) as number
      const gap = windowGapDays(a, b) as number
      expect(overlap === 0 || gap === 0).toBe(true)
    }
  })

  test('an unknown start date makes both fields null', () => {
    const a = { start: null, inService: '2026-06-30' }
    const b = { start: '2030-06-01', inService: '2033-06-01' }
    expect(windowOverlapDays(a, b)).toBeNull()
    expect(windowGapDays(a, b)).toBeNull()
    expect(windowOverlapDays(b, a)).toBeNull()
    expect(windowGapDays(b, a)).toBeNull()
  })
})

import { describe, expect, test } from 'bun:test'
import { clampConfidence, confidenceRank, lowerConfidence, MANUAL_CONFIDENCE } from '../src/lib/confidence'

describe('clampConfidence', () => {
  test('passes wire values through', () => {
    expect(clampConfidence('high')).toBe('high')
    expect(clampConfidence('medium')).toBe('medium')
    expect(clampConfidence('low')).toBe('low')
  })

  test('collapses the dropped verified level onto high', () => {
    expect(clampConfidence('verified')).toBe('high')
  })
})

describe('confidenceRank', () => {
  test('ranks high > medium > low and treats verified as high', () => {
    expect(confidenceRank('high')).toBeGreaterThan(confidenceRank('medium'))
    expect(confidenceRank('medium')).toBeGreaterThan(confidenceRank('low'))
    expect(confidenceRank('verified')).toBe(confidenceRank('high'))
  })
})

describe('lowerConfidence', () => {
  test('returns the weaker of the two', () => {
    expect(lowerConfidence('high', 'medium')).toBe('medium')
    expect(lowerConfidence('low', 'high')).toBe('low')
    expect(lowerConfidence('medium', 'medium')).toBe('medium')
    expect(lowerConfidence('verified', 'medium')).toBe('medium')
  })
})

test('a manual edit is saved as high confidence', () => {
  expect(MANUAL_CONFIDENCE).toBe('high')
})

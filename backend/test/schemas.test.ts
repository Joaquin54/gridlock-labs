import { describe, expect, test } from 'bun:test'
import { overlapQuerySchema, projectQuerySchema } from '../src/schemas'

describe('projectQuerySchema bbox', () => {
  test('accepts four numbers with west < east and south < north', () => {
    const parsed = projectQuerySchema.parse({ bbox: '-82.2,33.6,-82.1,33.7' })
    expect(parsed.bbox).toEqual([-82.2, 33.6, -82.1, 33.7])
  })

  test('rejects the wrong number of values', () => {
    expect(projectQuerySchema.safeParse({ bbox: '1,2,3' }).success).toBe(false)
    expect(projectQuerySchema.safeParse({ bbox: '1,2,3,4,5' }).success).toBe(false)
  })

  test('rejects non-numeric values', () => {
    expect(projectQuerySchema.safeParse({ bbox: 'a,b,c,d' }).success).toBe(false)
  })

  test('rejects an inverted box', () => {
    expect(projectQuerySchema.safeParse({ bbox: '-82.1,33.6,-82.2,33.7' }).success).toBe(false)
    expect(projectQuerySchema.safeParse({ bbox: '-82.2,33.7,-82.1,33.6' }).success).toBe(false)
  })
})

describe('projectQuerySchema other params', () => {
  test('parses a confidence list', () => {
    expect(projectQuerySchema.parse({ confidence: 'high, medium' }).confidence).toEqual([
      'high',
      'medium',
    ])
  })

  test('rejects the dropped verified level on the wire', () => {
    expect(projectQuerySchema.safeParse({ confidence: 'verified' }).success).toBe(false)
  })

  test('has no default filters', () => {
    expect(projectQuerySchema.parse({})).toEqual({})
  })
})

describe('overlapQuerySchema', () => {
  test('defaults to 25 miles, in scope, sorted by distance', () => {
    expect(overlapQuerySchema.parse({})).toEqual({
      maxMiles: 25,
      inScope: true,
      sort: 'distance',
    })
  })

  test('rejects a non-positive maxMiles', () => {
    expect(overlapQuerySchema.safeParse({ maxMiles: '0' }).success).toBe(false)
    expect(overlapQuerySchema.safeParse({ maxMiles: '-5' }).success).toBe(false)
    expect(overlapQuerySchema.safeParse({ maxMiles: 'abc' }).success).toBe(false)
  })

  test('rejects an unknown sort', () => {
    expect(overlapQuerySchema.safeParse({ sort: 'savings' }).success).toBe(false)
  })
})

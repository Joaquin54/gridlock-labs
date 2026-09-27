import { describe, expect, test } from 'bun:test'
import type { NewProjectPoint } from '../src/db/schema'
import { buildPoints, pointId } from '../src/lib/points'

const pt = (over: Partial<NewProjectPoint>): NewProjectPoint => ({
  projectId: 'GPC:1',
  seq: 1,
  name: 'Somewhere',
  lat: 33.5,
  lon: -82.5,
  method: 'hifld',
  confidence: 'low',
  ...over,
})

describe('pointId', () => {
  test('is the parsed coordinate, so a trailing zero does not fork a point', () => {
    expect(pointId(32.35212, -81.17511)).toBe('32.35212,-81.17511')
    expect(pointId(Number('32.352120'), Number('-81.175110'))).toBe('32.35212,-81.17511')
  })

  test('is null for an unlocated row', () => {
    expect(pointId(null, null)).toBeNull()
  })
})

describe('buildPoints', () => {
  test('the same coordinate becomes one point', () => {
    const built = buildPoints([
      pt({ projectId: 'GPC:1', name: 'Thurmond' }),
      pt({ projectId: 'GPC:2', name: 'Thurmond' }),
    ])
    expect(built).toHaveLength(1)
    expect(built[0].id).toBe('33.5,-82.5')
  })

  test('the same name at different coordinates stays two points', () => {
    const built = buildPoints([
      pt({ projectId: 'GPC:1', name: 'Goshen', lat: 32.248701, lon: -81.209472 }),
      pt({ projectId: 'GPC:2', name: 'Goshen', lat: 33.31976, lon: -81.995312 }),
    ])
    expect(built).toHaveLength(2)
    expect(built.map((p) => p.name)).toEqual(['Goshen', 'Goshen'])
  })

  test('an unlocated row produces no point', () => {
    expect(buildPoints([pt({ lat: null, lon: null })])).toEqual([])
  })

  test('the strongest confidence wins and brings its own provenance', () => {
    const built = buildPoints([
      pt({ projectId: 'GPC:1', confidence: 'low', method: 'hifld', verifiedBy: 'auto' }),
      pt({ projectId: 'GPC:2', confidence: 'verified', method: 'manual', verifiedBy: 'a-teammate' }),
      pt({ projectId: 'GPC:3', confidence: 'medium', method: 'osm', verifiedBy: 'bot' }),
    ])
    expect(built[0].confidence).toBe('verified')
    expect(built[0].method).toBe('manual')
    expect(built[0].verifiedBy).toBe('a-teammate')
  })

  test('aliases collect every distinct printed name, sorted', () => {
    const built = buildPoints([
      pt({ projectId: 'GPC:2', name: 'Cameron Jct' }),
      pt({ projectId: 'GPC:1', name: 'Cameron' }),
      pt({ projectId: 'GPC:3', name: 'Cameron Jct' }),
    ])
    expect(built[0].aliases).toEqual(['Cameron', 'Cameron Jct'])
  })

  test('the name is the most common one, not the first seen', () => {
    const built = buildPoints([
      pt({ projectId: 'GPC:1', name: 'Frogmore Distribution' }),
      pt({ projectId: 'GPC:2', name: 'Frogmore' }),
      pt({ projectId: 'GPC:3', name: 'Frogmore' }),
    ])
    expect(built[0].name).toBe('Frogmore')
  })

  test('ties break on (projectId, seq), so input order does not matter', () => {
    const rows = [
      pt({ projectId: 'GPC:9', seq: 2, name: 'Zeta', confidence: 'verified', method: 'osm' }),
      pt({ projectId: 'GPC:1', seq: 1, name: 'Alpha', confidence: 'verified', method: 'manual' }),
    ]
    const forward = buildPoints(rows)
    expect(forward[0].name).toBe('Alpha')
    expect(forward[0].method).toBe('manual')
    expect(buildPoints([...rows].reverse())).toEqual(forward)
  })

  test('output is sorted by id, so two runs agree exactly', () => {
    const built = buildPoints([
      pt({ projectId: 'GPC:1', lat: 34.1, lon: -84.1 }),
      pt({ projectId: 'GPC:2', lat: 32.1, lon: -81.1 }),
    ])
    expect(built.map((p) => p.id)).toEqual(['32.1,-81.1', '34.1,-84.1'])
  })

  test('a point used twice inside one project is still one point', () => {
    const built = buildPoints([
      pt({ projectId: 'GPC:20150', seq: 1, name: 'Hill View' }),
      pt({ projectId: 'GPC:20150', seq: 2, name: 'Grassy Hollow' }),
    ])
    expect(built).toHaveLength(1)
    expect(built[0].aliases).toEqual(['Grassy Hollow', 'Hill View'])
  })
})

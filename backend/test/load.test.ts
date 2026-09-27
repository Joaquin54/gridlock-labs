import { describe, expect, test } from 'bun:test'
import { computeCenter } from '../scripts/load-checks'
import {
  emptyToNull,
  generatedId,
  generatedOwnerInScope,
  parseBoolean,
  toPointInsert,
  toProjectInsert,
  validatePoints,
  validateProjects,
  type RawRow,
} from '../scripts/load-tiger'

const PROJECT: RawRow = {
  id: 'GPC:16007',
  utility: 'GPC',
  project_key: '16007',
  name: 'FENWICK STREET - SAND BAR FERRY 115KV',
  description: 'Rebuild the line.',
  owner: 'GPC',
  owner_in_scope: 'true',
  project_type: 'line',
  work_type: 'rebuild',
  voltage_kv: '115',
  zone: 'East',
  status: '',
  start_date: '2024-01-01',
  start_date_source: 'published',
  in_service_date: '2025-06-01',
  in_service_raw: '',
  cost_usd: '',
  confidence: 'verified',
  is_border: 'true',
  evidence: 'miles 2.72 stated (section) vs 2.6 straight ✓',
  source_doc: 'gpc.pdf',
}

const POINT: RawRow = {
  project_id: 'GPC:16007',
  seq: '1',
  name: 'Fenwick Street',
  lat: '33.446143',
  lon: '-81.950468',
  method: 'hifld',
  confidence: 'verified',
  match_name: 'Fenwick St Substation',
  osm_url: 'https://www.openstreetmap.org/way/170166804',
  match_score: '',
  source_url: 'hifld:ID=101541:end=SUB_2',
  verified_by: 'auto:hifld_walk',
  note: 'endpoint confirmed against the HIFLD line walk',
}

const row = (base: RawRow, over: Record<string, string>): RawRow => ({ ...base, ...over })
const ids = new Set(['GPC:16007'])

describe('validation rejects bad rows', () => {
  test('a bad enum', () => {
    const { failures } = validateProjects([row(PROJECT, { work_type: 'demolition' })])
    expect(failures.some((f) => f.column === 'workType')).toBe(true)
  })

  test('a method outside the approved list', () => {
    const { failures } = validatePoints([row(POINT, { method: 'guesswork' })], ids)
    expect(failures.some((f) => f.column === 'method')).toBe(true)
  })

  test('a non-ISO date', () => {
    const { failures } = validateProjects([row(PROJECT, { in_service_date: '12/31/23' })])
    expect(
      failures.some((f) => f.column === 'in_service_date' && /ISO/.test(f.reason)),
    ).toBe(true)
  })

  test('a missing foreign key', () => {
    const { failures } = validatePoints([row(POINT, { project_id: 'GPC:99999' })], ids)
    expect(failures.some((f) => f.column === 'project_id')).toBe(true)
  })

  test('a half-empty lat/lon', () => {
    const { failures } = validatePoints([row(POINT, { lon: '' })], ids)
    expect(failures.some((f) => f.column === 'lat/lon')).toBe(true)
  })

  test('an id the generated column would not reproduce', () => {
    const { failures } = validateProjects([row(PROJECT, { id: 'GPC:16008' })])
    expect(failures.some((f) => f.column === 'id')).toBe(true)
  })

  test('an owner_in_scope the generated column would not reproduce', () => {
    const { failures } = validateProjects([row(PROJECT, { owner: 'GTC' })])
    expect(failures.some((f) => f.column === 'owner_in_scope')).toBe(true)
  })

  test('a clean pair passes both files', () => {
    const projects = validateProjects([PROJECT])
    const points = validatePoints([POINT], ids)
    expect(projects.failures).toEqual([])
    expect(points.failures).toEqual([])
  })
})

describe('mappings do exactly what was approved', () => {
  test('an empty cell becomes NULL, never an empty string', () => {
    expect(emptyToNull('')).toBeNull()
    expect(emptyToNull(undefined)).toBeNull()
    expect(emptyToNull('x')).toBe('x')
    expect(toProjectInsert(PROJECT).status).toBeNull()
    expect(toProjectInsert(PROJECT).inServiceRaw).toBeNull()
  })

  test('source_url and osm_url stay separate — no coalesce either way', () => {
    const point = toPointInsert(POINT)
    expect(point.sourceUrl).toBe('hifld:ID=101541:end=SUB_2')
    expect(point.osmUrl).toBe('https://www.openstreetmap.org/way/170166804')
    const osmOnly = toPointInsert(row(POINT, { source_url: '' }))
    expect(osmOnly.sourceUrl).toBeNull()
    expect(osmOnly.osmUrl).toBe('https://www.openstreetmap.org/way/170166804')
  })

  test('a blank point confidence stays NULL and is not defaulted to low', () => {
    expect(toPointInsert(row(POINT, { confidence: '' })).confidence).toBeNull()
  })

  test("verified is loaded as-is, not mapped to high", () => {
    expect(toProjectInsert(PROJECT).confidence).toBe('verified')
    expect(toPointInsert(POINT).confidence).toBe('verified')
  })

  test('the free-text note is kept and does not touch verification_note', () => {
    const point = toPointInsert(POINT)
    expect(point.note).toBe('endpoint confirmed against the HIFLD line walk')
    expect(point.verificationNote).toBeUndefined()
  })

  test('project_key stays text, keeping leading zeros and punctuation', () => {
    expect(toProjectInsert(row(PROJECT, { id: 'GPC:09661', project_key: '09661' })).projectKey).toBe(
      '09661',
    )
    expect(generatedId('DESC', '06367 A - C, H')).toBe('DESC:06367 A - C, H')
  })

  test('the generated columns are never inserted', () => {
    const insert = toProjectInsert(PROJECT) as Record<string, unknown>
    expect('id' in insert).toBe(false)
    expect('ownerInScope' in insert).toBe(false)
  })

  test('owner_in_scope is DESC, GPC and SAV only', () => {
    expect(['DESC', 'GPC', 'SAV'].map(generatedOwnerInScope)).toEqual([true, true, true])
    expect(['GTC', 'MEAG', 'DU'].map(generatedOwnerInScope)).toEqual([false, false, false])
  })

  test('booleans come from the CSV literals', () => {
    expect(parseBoolean('true')).toBe(true)
    expect(parseBoolean('false')).toBe(false)
    expect(parseBoolean('TRUE')).toBeNull()
  })
})

describe('the centre rule', () => {
  const pt = (seq: number, lat: string, lon: string): RawRow =>
    ({ seq: String(seq), lat, lon }) as RawRow

  test('a two-point line takes the midpoint', () => {
    expect(computeCenter([pt(1, '10', '20'), pt(2, '20', '40')], 'line')).toEqual([15, 30])
  })

  test('a station takes its single point', () => {
    expect(computeCenter([pt(1, '10', '20')], 'station')).toEqual([10, 20])
  })

  test('a line with one unlocated end falls back to the located point', () => {
    expect(computeCenter([pt(1, '10', '20'), pt(2, '', '')], 'line')).toEqual([10, 20])
    expect(computeCenter([pt(1, '', ''), pt(2, '20', '40')], 'line')).toEqual([20, 40])
  })

  test('a three-point line uses the outer located points, not the middle', () => {
    const center = computeCenter([pt(1, '10', '20'), pt(2, '99', '99'), pt(3, '20', '40')], 'line')
    expect(center).toEqual([15, 30])
  })

  test('multi_station takes the mean of every located point', () => {
    const center = computeCenter(
      [pt(1, '10', '10'), pt(2, '20', '20'), pt(3, '30', '30')],
      'multi_station',
    )
    expect(center).toEqual([20, 20])
  })

  test('no located point means no centre', () => {
    expect(computeCenter([pt(1, '', '')], 'line')).toBeNull()
  })
})

import { beforeAll, describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { createPgliteDb, type Database, findMissingRelations } from '../src/db/client'
import { toCsv } from '../src/lib/csv'
import {
  OVERLAP_HEADERS,
  OVERRIDE_HEADERS,
  PROJECT_HEADERS,
} from '../src/lib/exportTables'
import { findManualOverrides } from '../src/queries/points'
import { findOverlaps } from '../src/queries/overlaps'
import { findProjects } from '../src/queries/projects'
import { getStats } from '../src/queries/stats'

/**
 * Rule 4: every route has to work against a database that has the schema but no
 * rows. Builds the schema without the fixture, so nothing here depends on seed
 * data or on the singleton in src/db.
 */
let db: Database

beforeAll(async () => {
  db = await createPgliteDb()
})

describe('an empty database', () => {
  test('has the schema pushed', async () => {
    expect(await findMissingRelations(db)).toEqual([])
  })

  test('yields no project features', async () => {
    expect(await findProjects(db)).toEqual([])
  })

  test('yields no overlaps, whatever the params', async () => {
    expect(await findOverlaps(db)).toEqual([])
    expect(await findOverlaps(db, { inScope: false, sort: 'gap', maxMiles: 500 })).toEqual([])
    expect(await findOverlaps(db, { projectId: 'DESC:6810 A' })).toEqual([])
  })

  test('yields zero counts', async () => {
    expect(await getStats(db)).toEqual({
      projects: { DESC: 0, GPC: 0 },
      located: { DESC: 0, GPC: 0 },
      unlocated: { DESC: 0, GPC: 0 },
      confidence: { high: 0, medium: 0, low: 0 },
      overlaps: { total: 0, high: 0, medium: 0, low: 0 },
    })
  })

  test('yields no manual overrides', async () => {
    expect(await findManualOverrides(db)).toEqual([])
  })

  test('yields header-only CSVs', async () => {
    const projects = await findProjects(db, { utility: 'DESC' })
    expect(toCsv(PROJECT_HEADERS, projects.map(() => []))).toBe(
      `${PROJECT_HEADERS.join(',')}\r\n`,
    )
    expect(toCsv(OVERLAP_HEADERS, [])).toBe(`${OVERLAP_HEADERS.join(',')}\r\n`)
    expect(toCsv(OVERRIDE_HEADERS, [])).toBe(`${OVERRIDE_HEADERS.join(',')}\r\n`)
  })

  test('yields an empty FeatureCollection', async () => {
    const features = await findProjects(db)
    expect({ type: 'FeatureCollection', features }).toEqual({
      type: 'FeatureCollection',
      features: [],
    })
  })
})

describe('a database whose schema was never pushed', () => {
  test('names the relations that are missing', async () => {
    const bare = await createPgliteDb()
    await bare.execute(sql`drop view project_geo`)
    expect(await findMissingRelations(bare)).toEqual(['project_geo'])

    await bare.execute(sql`drop view point_usage`)
    await bare.execute(sql`drop table project_points`)
    await bare.execute(sql`drop table projects`)
    expect(await findMissingRelations(bare)).toEqual([
      'projects',
      'project_points',
      'project_geo',
    ])
  })
})

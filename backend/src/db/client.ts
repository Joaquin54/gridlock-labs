import { type SQL, sql } from 'drizzle-orm'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import { FIXTURE_POINTS, FIXTURE_PROJECTS } from './fixture'
import * as schema from './schema'
import { buildPoints, pointId } from '../lib/points'
import { points, projectPoints, projects } from './schema'

export type Database = PgDatabase<any, any, any>

export type DbMode = 'postgres' | 'pglite'

/** Relations every route needs. `drizzle-kit push` creates all three. */
export const REQUIRED_RELATIONS = ['projects', 'project_points', 'project_geo'] as const

/**
 * Columns declared `numeric` in the schema. postgres.js and PGlite both return
 * `numeric` as a string, and `db.execute` bypasses Drizzle's column mapping, so
 * every raw row goes through `rows()` to get real JSON numbers back.
 */
const NUMERIC_COLUMNS = new Set(['line_miles', 'cost_usd', 'cost_low', 'cost_high', 'match_score'])

async function createPostgres(url: string): Promise<Database> {
  const [{ drizzle }, postgres] = await Promise.all([
    import('drizzle-orm/postgres-js'),
    import('postgres'),
  ])
  return drizzle(postgres.default(url), { schema }) as unknown as Database
}

export async function createPgliteDb(): Promise<Database> {
  const [{ PGlite }, { drizzle }, { pushSchema }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('drizzle-kit/api'),
  ])
  const db = drizzle(new PGlite(), { schema }) as unknown as Database
  // Applies schema.ts directly — no migration files, nothing written to disk.
  const pushed = await pushSchema(schema as never, db as never)
  await pushed.apply()
  return db
}

/** Inserts the fixture. Exported so tests can build an empty DB instead. */
export async function seedFixture(db: Database): Promise<void> {
  // point_id is derived, exactly as the loader derives it, so the fixture exercises
  // the join rather than hard-coding a second copy of the rule.
  const linked = FIXTURE_POINTS.map((row) => ({ ...row, pointId: pointId(row.lat, row.lon) }))
  await db.insert(projects).values(FIXTURE_PROJECTS)
  await db.insert(points).values(buildPoints(linked))
  await db.insert(projectPoints).values(linked)
}

export async function createDb(): Promise<{ db: Database; mode: DbMode }> {
  const url = process.env.DATABASE_URL
  if (url) return { db: await createPostgres(url), mode: 'postgres' }
  const db = await createPgliteDb()
  await seedFixture(db)
  console.log('dev mode: PGlite in-memory, fixture data')
  return { db, mode: 'pglite' }
}

function coerceNumerics(row: Record<string, unknown>): Record<string, unknown> {
  for (const column of NUMERIC_COLUMNS) {
    const value = row[column]
    if (typeof value === 'string') row[column] = Number(value)
  }
  return row
}

/** Normalizes PGlite's `{ rows }` and postgres.js's array into one shape. */
export function rows<T>(result: unknown): T[] {
  const raw = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] } | null)?.rows ?? [])
  return raw.map((row) => coerceNumerics(row as Record<string, unknown>)) as T[]
}

export async function query<T>(db: Database, statement: SQL): Promise<T[]> {
  return rows<T>(await db.execute(statement))
}

/** Which of REQUIRED_RELATIONS are absent. Empty array means the schema is pushed. */
export async function findMissingRelations(db: Database): Promise<string[]> {
  const present = await query<{ table_name: string }>(
    db,
    sql`select table_name from information_schema.tables where table_schema = 'public'`,
  )
  const names = new Set(present.map((r) => r.table_name))
  return REQUIRED_RELATIONS.filter((relation) => !names.has(relation))
}

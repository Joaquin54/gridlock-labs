/**
 * Loads context-files/projects_load.csv and points_load.csv into projects and
 * project_points. Every value comes from a CSV cell; nothing is defaulted,
 * dropped, deduplicated or rounded. Validation runs over both whole files before
 * anything is written, and the parity checks run inside the load transaction, so
 * a failing check rolls the whole load back.
 *
 *   bun scripts/load-tiger.ts --dry-run
 *   bun scripts/load-tiger.ts --target=pglite
 *   bun scripts/load-tiger.ts --target=tiger
 *
 * --replace reloads a populated target: inside the same transaction it deletes
 * project_points then projects, re-inserts both files, applies POST_INSERT_DDL and
 * runs the checks. Without it a populated target is refused.
 */
import { parse } from 'csv-parse/sync'
import { sql } from 'drizzle-orm'
import { type Database, createPgliteDb, query } from '../src/db/client'
import {
  type NewPoint,
  type NewProject,
  type NewProjectPoint,
  points,
  projectPoints,
  projects,
} from '../src/db/schema'
import { buildPoints, pointId } from '../src/lib/points'
import { insertProjectPointSchema, insertProjectSchema } from '../src/db/validators'

export { buildPoints, pointId }
import { type CheckRow, reportConfidenceDrift, runChecks } from './load-checks'

const ROOT = new URL('../../context-files/', import.meta.url)

/**
 * Reviewed DDL applied inside the load transaction, after the rows are in. Kept
 * here rather than run through `drizzle-kit push`, which cannot be used against
 * Tiger (see docs/load_gap_report.md §6). SET NOT NULL rescans the table, so a
 * single NULL confidence aborts the whole reload.
 */
export const POST_INSERT_DDL = [
  'ALTER TABLE project_points ALTER COLUMN confidence SET NOT NULL',
] as const

export type Failure = {
  file: string
  line: number
  column: string
  value: string
  reason: string
}

export type RawRow = Record<string, string>

// --- mappings (one named function each) --------------------------------------

/** Empty cell means NULL, never an empty string. */
export function emptyToNull(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value
}

/** `true` / `false` exactly as the CSV writes them. */
export function parseBoolean(value: string): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

export function parseIntegerOrNull(value: string): number | null {
  const raw = emptyToNull(value)
  if (raw === null) return null
  return /^-?\d+$/.test(raw) ? Number(raw) : Number.NaN
}

export function parseNumberOrNull(value: string): number | null {
  const raw = emptyToNull(value)
  if (raw === null) return null
  return /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : Number.NaN
}

export function isIsoDate(value: string | null): boolean {
  if (value === null) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** projects.id is GENERATED ALWAYS AS (utility || ':' || project_key) STORED. */
export function generatedId(utility: string, projectKey: string): string {
  return `${utility}:${projectKey}`
}

/** projects.owner_in_scope is GENERATED ALWAYS AS (owner IN ('DESC','GPC','SAV')) STORED. */
export function generatedOwnerInScope(owner: string): boolean {
  return owner === 'DESC' || owner === 'GPC' || owner === 'SAV'
}

/** Neither id nor owner_in_scope is inserted: Postgres generates both. */
export function toProjectInsert(raw: RawRow): NewProject {
  return {
    utility: raw.utility as NewProject['utility'],
    projectKey: raw.project_key,
    name: raw.name,
    description: emptyToNull(raw.description),
    owner: raw.owner as NewProject['owner'],
    projectType: emptyToNull(raw.project_type) as NewProject['projectType'],
    workType: emptyToNull(raw.work_type) as NewProject['workType'],
    voltageKv: parseIntegerOrNull(raw.voltage_kv),
    zone: emptyToNull(raw.zone),
    status: emptyToNull(raw.status) as NewProject['status'],
    startDate: emptyToNull(raw.start_date),
    startDateSource: emptyToNull(raw.start_date_source) as NewProject['startDateSource'],
    inServiceDate: raw.in_service_date,
    inServiceRaw: emptyToNull(raw.in_service_raw),
    costUsd: parseNumberOrNull(raw.cost_usd),
    confidence: raw.confidence as NewProject['confidence'],
    isBorder: parseBoolean(raw.is_border) as boolean,
    evidence: emptyToNull(raw.evidence),
    sourceDoc: raw.source_doc,
  } satisfies NewProject
}

/** source_url and osm_url stay separate columns — no coalesce in either direction. */
export function toPointInsert(raw: RawRow): NewProjectPoint {
  return {
    projectId: raw.project_id,
    seq: parseIntegerOrNull(raw.seq) as number,
    name: raw.name,
    lat: parseNumberOrNull(raw.lat),
    lon: parseNumberOrNull(raw.lon),
    method: emptyToNull(raw.method) as NewProjectPoint['method'],
    matchName: emptyToNull(raw.match_name),
    osmUrl: emptyToNull(raw.osm_url),
    matchScore: parseNumberOrNull(raw.match_score),
    sourceUrl: emptyToNull(raw.source_url),
    confidence: emptyToNull(raw.confidence) as NewProjectPoint['confidence'],
    note: emptyToNull(raw.note),
    verifiedBy: emptyToNull(raw.verified_by),
    pointId: pointId(parseNumberOrNull(raw.lat), parseNumberOrNull(raw.lon)),
  } satisfies NewProjectPoint
}

// --- validation --------------------------------------------------------------

async function loadCsv(name: string): Promise<RawRow[]> {
  const text = await Bun.file(new URL(name, ROOT)).text()
  return parse(text, { columns: true, bom: true, relaxQuotes: false }) as RawRow[]
}

export function validateProjects(rows: RawRow[]): { inserts: NewProject[]; failures: Failure[] } {
  const failures: Failure[] = []
  const inserts: NewProject[] = []
  const file = 'projects_load.csv'
  const seenIds = new Set<string>()
  const seenKeys = new Set<string>()

  rows.forEach((raw, index) => {
    const line = index + 2 // header is line 1
    const add = (column: string, value: string, reason: string) =>
      failures.push({ file, line, column, value, reason })

    const insert = toProjectInsert(raw)
    const parsed = insertProjectSchema.safeParse(insert)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const column = String(issue.path[0] ?? '?')
        add(column, String((insert as Record<string, unknown>)[column] ?? ''), issue.message)
      }
    }
    if (!isIsoDate(insert.inServiceDate)) {
      add('in_service_date', raw.in_service_date, 'not an ISO YYYY-MM-DD date')
    }
    if (insert.startDate != null && !isIsoDate(insert.startDate)) {
      add('start_date', raw.start_date, 'not an ISO YYYY-MM-DD date')
    }
    if (Number.isNaN(insert.voltageKv)) add('voltage_kv', raw.voltage_kv, 'not an integer')
    if (Number.isNaN(insert.costUsd)) add('cost_usd', raw.cost_usd, 'not a number')
    if (parseBoolean(raw.is_border) === null) {
      add('is_border', raw.is_border, "expected 'true' or 'false'")
    }

    // The two generated columns must reproduce the CSV exactly, or skipping them loses data.
    const id = generatedId(raw.utility, raw.project_key)
    if (id !== raw.id) {
      add('id', raw.id, `utility || ':' || project_key would generate '${id}'`)
    }
    const inScope = generatedOwnerInScope(raw.owner)
    if (String(inScope) !== raw.owner_in_scope) {
      add('owner_in_scope', raw.owner_in_scope, `owner '${raw.owner}' would generate '${inScope}'`)
    }
    if (seenIds.has(raw.id)) add('id', raw.id, 'duplicate id')
    seenIds.add(raw.id)
    const key = `${raw.utility}\u0000${raw.project_key}`
    if (seenKeys.has(key)) add('project_key', raw.project_key, 'duplicate (utility, project_key)')
    seenKeys.add(key)

    inserts.push(insert)
  })

  return { inserts, failures }
}

export function validatePoints(
  rows: RawRow[],
  projectIds: Set<string>,
): { inserts: NewProjectPoint[]; failures: Failure[] } {
  const failures: Failure[] = []
  const inserts: NewProjectPoint[] = []
  const file = 'points_load.csv'
  const seen = new Set<string>()

  rows.forEach((raw, index) => {
    const line = index + 2
    const add = (column: string, value: string, reason: string) =>
      failures.push({ file, line, column, value, reason })

    const insert = toPointInsert(raw)
    const parsed = insertProjectPointSchema.safeParse(insert)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const column = String(issue.path[0] ?? '?')
        add(column, String((insert as Record<string, unknown>)[column] ?? ''), issue.message)
      }
    }
    if (!projectIds.has(raw.project_id)) {
      add('project_id', raw.project_id, 'no such project in projects_load.csv')
    }
    if (!Number.isInteger(insert.seq) || insert.seq < 1 || insert.seq > 3) {
      add('seq', raw.seq, 'expected 1, 2 or 3')
    }
    if ((insert.lat === null) !== (insert.lon === null)) {
      add('lat/lon', `${raw.lat}/${raw.lon}`, 'lat and lon must both be set or both be empty')
    }
    if (Number.isNaN(insert.lat)) add('lat', raw.lat, 'not a number')
    if (Number.isNaN(insert.lon)) add('lon', raw.lon, 'not a number')
    if (Number.isNaN(insert.matchScore)) add('match_score', raw.match_score, 'not a number')

    const key = `${raw.project_id}\u0000${raw.seq}`
    if (seen.has(key)) add('seq', raw.seq, 'duplicate (project_id, seq)')
    seen.add(key)

    inserts.push(insert)
  })

  return { inserts, failures }
}

function reportFailures(failures: Failure[]): never {
  console.error(`\n${failures.length} row(s) failed validation. Nothing was written.\n`)
  for (const f of failures.slice(0, 50)) {
    console.error(`  ${f.file}:${f.line}  ${f.column}=${JSON.stringify(f.value)}  ${f.reason}`)
  }
  if (failures.length > 50) console.error(`  … and ${failures.length - 50} more`)
  process.exit(1)
}

// --- the load ----------------------------------------------------------------

async function connect(
  target: 'pglite' | 'tiger',
): Promise<{ db: Database; close: () => Promise<void> }> {
  if (target === 'pglite') return { db: await createPgliteDb(), close: async () => {} }
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is unset. Put it in backend/.env for --target=tiger.')
    process.exit(1)
  }
  const { host, database } = describeTarget(url)
  console.log(`target: tiger  host=${host}  database=${database}`)
  const [{ drizzle }, postgres] = await Promise.all([
    import('drizzle-orm/postgres-js'),
    import('postgres'),
  ])
  const client = postgres.default(url)
  return {
    db: drizzle(client, { schema: {} }) as unknown as Database,
    close: () => client.end({ timeout: 5 }),
  }
}

/** Host and database name only — never the credentials. */
export function describeTarget(url: string): { host: string; database: string } {
  const parsed = new URL(url)
  return { host: parsed.hostname, database: parsed.pathname.replace(/^\//, '') }
}

async function rowCounts(db: Database): Promise<{ projects: number; points: number }> {
  const counts = await query<{ projects: number; points: number }>(
    db,
    sql`select
          (select count(*) from projects)::int as projects,
          (select count(*) from project_points)::int as points`,
  )
  return counts[0]
}

export async function load(
  db: Database,
  projectRows: NewProject[],
  pointRows: NewProjectPoint[],
  pointBuilt: NewPoint[],
  projectRaw: RawRow[],
  pointRaw: RawRow[],
  replace = false,
): Promise<CheckRow[]> {
  let checks: CheckRow[] = []
  await db.transaction(async (tx) => {
    checks = await loadInTx(
      tx as unknown as Database,
      projectRows,
      pointRows,
      pointBuilt,
      projectRaw,
      pointRaw,
      replace,
    )
  })
  return checks
}

/**
 * The load itself, without opening a transaction. `load()` wraps it in one; the Tiger
 * migration script calls it inside a transaction that also carries the schema DDL, so
 * a failing check rolls the DDL back too. Throws if any check fails, which is what
 * aborts the caller's transaction.
 */
export async function loadInTx(
  tx: Database,
  projectRows: NewProject[],
  pointRows: NewProjectPoint[],
  pointBuilt: NewPoint[],
  projectRaw: RawRow[],
  pointRaw: RawRow[],
  replace = false,
): Promise<CheckRow[]> {
  if (replace) {
    // The join first, so neither foreign key is left dangling; then the two
    // parents. Nothing is left to the cascade.
    await tx.execute(sql`delete from project_points`)
    await tx.execute(sql`delete from projects`)
    await tx.execute(sql`delete from points`)
  }
  await tx.insert(projects).values(projectRows)
  await tx.insert(points).values(pointBuilt)
  await tx.insert(projectPoints).values(pointRows)
  for (const statement of POST_INSERT_DDL) {
    console.log(`applying: ${statement}`)
    await tx.execute(sql.raw(statement))
  }
  const checks = await runChecks(tx, projectRaw, pointRaw)
  if (checks.some((check) => !check.pass)) {
    printChecks(checks)
    throw new Error('parity checks failed')
  }
  return checks
}

export function printChecks(checks: CheckRow[]): void {
  const width = Math.max(...checks.map((c) => c.name.length))
  console.log(`\n${'Check'.padEnd(width)}  ${'Expected'.padEnd(34)}  Actual`)
  for (const c of checks) {
    const mark = c.pass ? '✓' : '✗'
    console.log(`${mark} ${c.name.padEnd(width)}  ${c.expected.padEnd(34)}  ${c.actual}`)
  }
  const failed = checks.filter((c) => !c.pass).length
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const replace = args.includes('--replace')
  const targetArg = args.find((a) => a.startsWith('--target='))?.split('=')[1]
  if (!dryRun && targetArg !== 'pglite' && targetArg !== 'tiger') {
    console.error('Pass --dry-run, or --target=pglite, or --target=tiger.')
    process.exit(1)
  }

  const [projectRaw, pointRaw] = await Promise.all([
    loadCsv('projects_load.csv'),
    loadCsv('points_load.csv'),
  ])
  console.log(`parsed projects_load.csv: ${projectRaw.length} rows`)
  console.log(`parsed points_load.csv:   ${pointRaw.length} rows`)

  const projectResult = validateProjects(projectRaw)
  const ids = new Set(projectRaw.map((r) => r.id))
  const pointResult = validatePoints(pointRaw, ids)
  const failures = [...projectResult.failures, ...pointResult.failures]
  if (failures.length > 0) reportFailures(failures)
  const built = buildPoints(pointResult.inserts)
  console.log(
    `validated: ${projectResult.inserts.length} projects, ${pointResult.inserts.length} point rows, ` +
      `0 failures`,
  )
  console.log(
    `derived: ${built.length} distinct points; ` +
      `${pointResult.inserts.filter((r) => r.pointId !== null).length} join rows linked, ` +
      `${pointResult.inserts.filter((r) => r.pointId === null).length} unlocated`,
  )

  if (dryRun) {
    console.log('--dry-run: nothing written.')
    return
  }

  const target = targetArg as 'pglite' | 'tiger'
  const { db, close } = await connect(target)
  try {
    await run(db, target, projectResult.inserts, pointResult.inserts, projectRaw, pointRaw, replace)
  } finally {
    await close()
  }
}

async function run(
  db: Database,
  target: 'pglite' | 'tiger',
  projectInserts: NewProject[],
  pointInserts: NewProjectPoint[],
  projectRaw: RawRow[],
  pointRaw: RawRow[],
  replace: boolean,
): Promise<void> {
  const counts = await rowCounts(db)
  const populated = counts.projects > 0 || counts.points > 0
  if (populated && !replace) {
    console.error(
      `\nThe target already holds rows: projects=${counts.projects}, ` +
        `project_points=${counts.points}.\nStopping. Pass --replace to reload it.`,
    )
    process.exit(1)
  }
  if (populated) {
    console.log(
      `--replace: deleting ${counts.points} point(s) and ${counts.projects} project(s) ` +
        'inside the load transaction',
    )
  }

  const started = Date.now()
  const checks = await load(db, projectInserts, pointInserts, buildPoints(pointInserts), projectRaw, pointRaw, replace)
  const elapsed = ((Date.now() - started) / 1000).toFixed(1)
  printChecks(checks)
  console.log(`committed to ${target} in ${elapsed}s`)

  // Decision 9 asked for this to be reported, not enforced.
  const drift = await reportConfidenceDrift(db)
  console.log(`\nhardened project_geo.location_confidence: ${JSON.stringify(drift.distribution)}`)
  console.log(`disagrees with projects.confidence on ${drift.disagreements.length} project(s):`)
  for (const row of drift.disagreements) {
    console.log(`  ${row.id.padEnd(22)} stored=${row.stored.padEnd(8)} derived=${row.derived}`)
  }
}

if (import.meta.main) {
  await main().catch((error) => {
    console.error(`\nload failed, transaction rolled back: ${(error as Error).message}`)
    process.exit(1)
  })
}

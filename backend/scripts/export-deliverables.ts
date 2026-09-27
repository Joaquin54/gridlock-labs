/**
 * Writes the challenge deliverable — the organizers' "Project | Overlap Table"
 * format — straight out of the `overlap_table` and `project_table` views, so a point
 * correction in the database flows into the submission with no hand editing.
 *
 *   bun scripts/export-deliverables.ts --target=pglite|tiger --out <dir>
 *
 * The golden copies in context-files/deliverable/ are the spec: the output is compared
 * byte for byte against them. Formatting rules live in `formatCsv` and its helpers,
 * which the two export routes reuse so the HTTP response and the file agree.
 */
import { parse } from 'csv-parse/sync'
import { sql } from 'drizzle-orm'
import { type Database, createPgliteDb } from '../src/db/client'
import { overlapTableCsv, projectTableCsv } from '../src/lib/deliverable'
import { buildPoints } from '../src/lib/points'
import { load, validatePoints, validateProjects } from './load-tiger'

/**
 * The two view definitions, split into statements. Applied to the throwaway PGlite
 * before exporting; on Tiger they are applied once by the migration step.
 */
export async function viewStatements(): Promise<string[]> {
  const ddl = await Bun.file(new URL('./deliverable-views.sql', import.meta.url)).text()
  return ddl
    .split(/;\s*\n(?=CREATE|$)/)
    .map((statement) => statement.trim().replace(/;$/, ''))
    .filter(Boolean)
}

async function connect(target: string): Promise<{ db: Database; close: () => Promise<void> }> {
  if (target === 'pglite') {
    // A throwaway database loaded from the CSVs, so --target=pglite is self-contained.
    const db = await createPgliteDb()
    const read = async (name: string) =>
      parse(await Bun.file(new URL(`../../context-files/${name}`, import.meta.url)).text(), {
        columns: true,
        bom: true,
      }) as Record<string, string>[]
    const projectRaw = await read('projects_load.csv')
    const pointRaw = await read('points_load.csv')
    const p = validateProjects(projectRaw)
    const pt = validatePoints(pointRaw, new Set(projectRaw.map((r) => r.id)))
    if (p.failures.length + pt.failures.length > 0) throw new Error('CSV validation failed')
    await load(db, p.inserts, pt.inserts, buildPoints(pt.inserts), projectRaw, pointRaw, false)
    for (const statement of await viewStatements()) await db.execute(sql.raw(statement))
    return { db, close: async () => {} }
  }
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is unset')
  const [{ drizzle }, postgres] = await Promise.all([
    import('drizzle-orm/postgres-js'),
    import('postgres'),
  ])
  const client = postgres.default(url, { max: 1 })
  return {
    db: drizzle(client, { schema: {} }) as unknown as Database,
    close: () => client.end({ timeout: 5 }),
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const target = args.find((a) => a.startsWith('--target='))?.split('=')[1]
  const out = args[args.indexOf('--out') + 1]
  if ((target !== 'pglite' && target !== 'tiger') || args.indexOf('--out') === -1 || !out) {
    console.error('usage: bun scripts/export-deliverables.ts --target=pglite|tiger --out <dir>')
    process.exit(1)
  }
  const { db, close } = await connect(target)
  try {
    const overlaps = await overlapTableCsv(db)
    const projects = await projectTableCsv(db)
    await Bun.write(`${out}/overlaps.csv`, overlaps)
    await Bun.write(`${out}/projects.csv`, projects)
    const nOverlaps = overlaps.trimEnd().split('\n').length - 1
    const nProjects = projects.trimEnd().split('\n').length - 1
    console.log(`wrote ${out}/overlaps.csv  (${nOverlaps} pairs)`)
    console.log(`wrote ${out}/projects.csv  (${nProjects} projects)`)
  } finally {
    await close()
  }
}

if (import.meta.main) {
  await main().catch((error) => {
    console.error(`export failed: ${(error as Error).message}`)
    process.exit(1)
  })
}

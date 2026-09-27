/**
 * Loads the committed, tracked inputs for the coordination-savings deliverable, so the
 * build script and the parity test read and map the CSVs exactly the same way.
 *
 * Paths resolve relative to this module (backend/scripts/), so callers get the same
 * inputs regardless of where they live. Nothing here touches the gitignored
 * context-files/ — the deliverable is reproducible from a clean checkout.
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'csv-parse/sync'
import type { OverlapPair, RateRow, SavingsProject } from '../src/lib/savings'

/** Repo root locally; override in Docker (e.g. DOCS_ROOT=/workspace → /workspace/docs/deliverable/…). */
const repoRoot = (): string =>
  process.env.DOCS_ROOT?.replace(/\/?$/, '') ??
  fileURLToPath(new URL('../../', import.meta.url))

const read = async (path: string): Promise<Record<string, string>[]> =>
  parse(await Bun.file(join(repoRoot(), path)).text(), { columns: true, bom: true }) as Record<
    string,
    string
  >[]

const num = (value: string | undefined): number | null => {
  const text = (value ?? '').trim()
  if (text === '') return null
  const n = Number(text)
  return Number.isNaN(n) ? null : n
}

export type SavingsInputs = {
  pairs: OverlapPair[]
  projects: SavingsProject[]
  reference: RateRow[]
}

export async function loadSavingsInputs(): Promise<SavingsInputs> {
  const pairs: OverlapPair[] = (await read('docs/deliverable/overlaps.csv')).map((r) => ({
    overlapId: r['overlap_id'],
    descId: r['project_id_a'],
    gpcId: r['project_id_b'],
    distanceMi: Number(r['distance_mi']),
  }))
  const projects: SavingsProject[] = (await read('docs/deliverable/savings/overlap_projects.csv')).map((r) => ({
    projectId: r['project_id'],
    utility: r['utility'] as 'DESC' | 'GPC',
    voltageKv: num(r['voltage_kv']),
    workType: r['work_type'],
    statedMiles: num(r['stated_miles']),
    startDate: (r['start_date'] ?? '').trim() || null,
    inServiceDate: r['in_service_date'],
    costUsd: num(r['cost_usd']),
    description: r['description'] ?? '',
  }))
  const reference: RateRow[] = (await read('docs/deliverable/savings/desc_cost_reference.csv')).map((r) => ({
    projectId: r['project_id'],
    voltageKv: num(r['voltage_kv']),
    workType: r['work_type'],
    projectType: r['project_type'],
    costUsd: num(r['cost_usd']),
    costPerMileUsd: num(r['cost_per_mile_usd']),
  }))
  return { pairs, projects, reference }
}

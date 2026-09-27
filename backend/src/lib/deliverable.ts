import { sql } from 'drizzle-orm'
import { type Database, query } from '../db/client'

/**
 * The organizers' "Project | Overlap Table" format, rendered from the `overlap_table`
 * and `project_table` views. The golden copies in context-files/deliverable/ are the
 * spec and the output is compared against them byte for byte, so the number formats
 * below are not preferences — they are what those files contain.
 *
 * Shared by scripts/export-deliverables.ts and the two /export routes, so the file on
 * disk and the HTTP response cannot drift apart.
 */
export const OVERLAP_HEADERS = [
  'overlap_id',
  'distance_mi',
  'time_gap (day)',
  'utility_a',
  'project_id_a',
  'project_name_a',
  'utility_b',
  'project_id_b',
  'project_name_b',
  'confidence_a',
  'confidence_b',
] as const

export const PROJECT_HEADERS = [
  'project_id',
  'utility',
  'state',
  'project_name',
  'name_a',
  'lat_a',
  'lon_a',
  'name_b',
  'lat_b',
  'lon_b',
  'lat_center',
  'lon_center',
  'in_service_date',
  'overlap_count',
  ...Array.from({ length: 16 }, (_, i) => `overlap_${i + 1}`),
  'confidence',
] as const

/** Minimal RFC 4180 quoting: only for a comma, a quote or a newline. */
export function csvField(value: string): string {
  if (!/[",\n\r]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

/** A point coordinate: always 6 decimals, matching the golden files. */
export function coord(value: number | string | null): string {
  if (value === null) return ''
  return Number(value).toFixed(6)
}

/** A centre: up to 7 decimals, trailing zeros stripped. */
export function center(value: number | string | null): string {
  if (value === null) return ''
  return String(Number(Number(value).toFixed(7)))
}

/** A distance: exactly 2 decimals. */
export function miles(value: number | string | null): string {
  if (value === null) return ''
  return Number(value).toFixed(2)
}

/** An empty value is an empty field — never `null`, never `NaN`. */
function plain(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

/** Header row plus one line per row, `\n` endings, final newline, nothing after it. */
export function formatCsv(headers: readonly string[], rows: string[][]): string {
  const lines = [headers.map(csvField).join(','), ...rows.map((r) => r.map(csvField).join(','))]
  return `${lines.join('\n')}\n`
}

type OverlapRow = Record<string, unknown>
type ProjectRow = Record<string, unknown>

export async function overlapTableCsv(db: Database): Promise<string> {
  const rows = await query<OverlapRow>(
    db,
    // Ordered by the id itself, so the file order always equals the view's numbering.
    // Ordering by distance_mi instead would be the rounded value, which can tie where
    // the unrounded distance that assigned the ids does not.
    sql`select * from overlap_table order by (split_part(overlap_id, '_', 2))::int`,
  )
  return formatCsv(
    OVERLAP_HEADERS,
    rows.map((r) => [
      plain(r.overlap_id),
      miles(r.distance_mi as number),
      plain(r['time_gap (day)']),
      plain(r.utility_a),
      plain(r.project_id_a),
      plain(r.project_name_a),
      plain(r.utility_b),
      plain(r.project_id_b),
      plain(r.project_name_b),
      plain(r.confidence_a),
      plain(r.confidence_b),
    ]),
  )
}

export async function projectTableCsv(db: Database): Promise<string> {
  const rows = await query<ProjectRow>(
    db,
    sql`select * from project_table
        order by case when project_id like 'DESC_%' then 0 else 1 end, project_id`,
  )
  return formatCsv(
    PROJECT_HEADERS,
    rows.map((r) => [
      plain(r.project_id),
      plain(r.utility),
      plain(r.state),
      plain(r.project_name),
      plain(r.name_a),
      coord(r.lat_a as number | null),
      coord(r.lon_a as number | null),
      plain(r.name_b),
      coord(r.lat_b as number | null),
      coord(r.lon_b as number | null),
      center(r.lat_center as number | null),
      center(r.lon_center as number | null),
      plain(r.in_service_date),
      plain(r.overlap_count),
      ...Array.from({ length: 16 }, (_, i) => plain(r[`overlap_${i + 1}`])),
      plain(r.confidence),
    ]),
  )
}


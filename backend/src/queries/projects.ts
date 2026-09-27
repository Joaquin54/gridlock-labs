import { sql, type SQL } from 'drizzle-orm'
import { type Database, query } from '../db/client'
import type { Confidence, ProjectType, Utility } from '../db/schema'
import { clampConfidence, type WireConfidence } from '../lib/confidence'
import { buildGeometry, type Coordinate, type Geometry } from '../lib/geometry'
import { findOverlaps, type Overlap } from './overlaps'

export type Bbox = [west: number, south: number, east: number, north: number]

export type ProjectFilters = {
  utility?: Utility
  confidence?: WireConfidence[]
  located?: boolean
  inScope?: boolean
  bbox?: Bbox
}

export type ProjectPointOut = {
  seq: number
  name: string
  lat: number | null
  lon: number | null
  method: string | null
  confidence: WireConfidence
  match_name: string | null
  match_score: number | null
  source_url: string | null
}

export type ProjectProperties = {
  id: string
  utility: Utility
  project_key: string
  name: string
  description: string | null
  owner: string
  owner_in_scope: boolean
  project_type: ProjectType | null
  work_type: string | null
  voltage_kv: number | null
  zone: string | null
  is_border: boolean
  status: string | null
  start_date: string | null
  start_date_source: string | null
  in_service_date: string
  in_service_raw: string | null
  line_miles: number | null
  miles_source: string | null
  cost_usd: number | null
  cost_low: number | null
  cost_high: number | null
  source_doc: string
  source_page: number
  center: Coordinate | null
  located: boolean
  location_confidence: WireConfidence | null
  points_located: number
  points_total: number
  points: ProjectPointOut[]
}

export type ProjectFeature = {
  type: 'Feature'
  id: string
  geometry: Geometry | null
  properties: ProjectProperties
}

/** A detail Feature: the same shape, with the project's overlaps attached. */
export type ProjectDetailFeature = ProjectFeature & {
  properties: ProjectProperties & { overlaps: Overlap[] }
}

type ProjectRow = {
  id: string
  utility: Utility
  project_key: string
  name: string
  description: string | null
  owner: string
  owner_in_scope: boolean
  project_type: ProjectType | null
  work_type: string | null
  voltage_kv: number | null
  zone: string | null
  is_border: boolean
  status: string | null
  start_date: string | null
  start_date_source: string | null
  in_service_date: string
  in_service_raw: string | null
  line_miles: number | null
  miles_source: string | null
  cost_usd: number | null
  cost_low: number | null
  cost_high: number | null
  source_doc: string
  source_page: number
  center_lat: number | null
  center_lon: number | null
  shape: Coordinate[]
  points_located: number
  points_total: number
  location_confidence: Confidence
}

type PointRow = {
  project_id: string
  seq: number
  name: string
  lat: number | null
  lon: number | null
  method: string | null
  confidence: Confidence
  match_name: string | null
  match_score: number | null
  osm_url: string | null
}

const PROJECT_SELECT = sql`
  select
    p.id, p.utility, p.project_key, p.name, p.description, p.owner, p.owner_in_scope,
    p.project_type, p.work_type, p.voltage_kv, p.zone, p.is_border, p.status,
    p.start_date, p.start_date_source, p.in_service_date, p.in_service_raw,
    p.line_miles, p.miles_source, p.cost_usd, p.cost_low, p.cost_high,
    p.source_doc, p.source_page,
    g.center_lat, g.center_lon, g.shape, g.points_located, g.points_total, g.location_confidence
  from projects p
  join project_geo g on g.project_id = p.id
`

function filterClauses(filters: ProjectFilters): SQL {
  const clauses: SQL[] = []
  if (filters.utility) clauses.push(sql`p.utility = ${filters.utility}`)
  if (filters.located !== undefined) {
    clauses.push(filters.located ? sql`g.points_located > 0` : sql`g.points_located = 0`)
  }
  // inScope=false means "do not filter", matching /overlaps.
  if (filters.inScope === true) clauses.push(sql`p.owner_in_scope`)
  if (filters.confidence && filters.confidence.length > 0) {
    // 'verified' is a dropped level that still reads as high (see lib/confidence).
    const levels = filters.confidence.flatMap((level) =>
      level === 'high' ? ['high', 'verified'] : [level],
    )
    clauses.push(
      sql`g.points_located > 0 and g.location_confidence in (${sql.join(
        levels.map((level) => sql`${level}`),
        sql`, `,
      )})`,
    )
  }
  if (filters.bbox) {
    const [west, south, east, north] = filters.bbox
    // Filters on the center, so unlocated projects drop out whenever bbox is set.
    clauses.push(
      sql`g.center_lon between ${west} and ${east} and g.center_lat between ${south} and ${north}`,
    )
  }
  if (clauses.length === 0) return sql``
  return sql`where ${sql.join(clauses, sql` and `)}`
}

async function pointsByProject(db: Database, ids: string[]): Promise<Map<string, ProjectPointOut[]>> {
  if (ids.length === 0) return new Map()
  const rows = await query<PointRow>(
    db,
    sql`
      select project_id, seq, name, lat, lon, method, confidence, match_name, match_score, osm_url
      from project_points
      where project_id in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})
      order by project_id, seq
    `,
  )
  const byProject = new Map<string, ProjectPointOut[]>()
  for (const row of rows) {
    const point: ProjectPointOut = {
      seq: row.seq,
      name: row.name,
      lat: row.lat,
      lon: row.lon,
      method: row.method,
      confidence: clampConfidence(row.confidence),
      match_name: row.match_name,
      match_score: row.match_score,
      // There is no source_url column; osm_url is the source link for every method.
      source_url: row.osm_url,
    }
    const list = byProject.get(row.project_id)
    if (list) list.push(point)
    else byProject.set(row.project_id, [point])
  }
  return byProject
}

function toFeature(row: ProjectRow, points: ProjectPointOut[]): ProjectFeature {
  const located = row.points_located > 0
  return {
    type: 'Feature',
    id: row.id,
    geometry: buildGeometry(row.project_type, row.shape),
    properties: {
      id: row.id,
      utility: row.utility,
      project_key: row.project_key,
      name: row.name,
      description: row.description,
      owner: row.owner,
      owner_in_scope: row.owner_in_scope,
      project_type: row.project_type,
      work_type: row.work_type,
      voltage_kv: row.voltage_kv,
      zone: row.zone,
      is_border: row.is_border,
      status: row.status,
      start_date: row.start_date,
      start_date_source: row.start_date_source,
      in_service_date: row.in_service_date,
      in_service_raw: row.in_service_raw,
      line_miles: row.line_miles,
      miles_source: row.miles_source,
      cost_usd: row.cost_usd,
      cost_low: row.cost_low,
      cost_high: row.cost_high,
      source_doc: row.source_doc,
      source_page: row.source_page,
      center: located && row.center_lon !== null && row.center_lat !== null
        ? [row.center_lon, row.center_lat]
        : null,
      located,
      // An unlocated project has no confidence to report; the view's 'low' is
      // only the column default and proves nothing.
      location_confidence: located ? clampConfidence(row.location_confidence) : null,
      points_located: row.points_located,
      points_total: row.points_total,
      points,
    },
  }
}

export async function findProjects(
  db: Database,
  filters: ProjectFilters = {},
): Promise<ProjectFeature[]> {
  const rows = await query<ProjectRow>(
    db,
    sql`${PROJECT_SELECT} ${filterClauses(filters)} order by p.project_key`,
  )
  const points = await pointsByProject(db, rows.map((row) => row.id))
  return rows.map((row) => toFeature(row, points.get(row.id) ?? []))
}

export async function findProjectById(
  db: Database,
  id: string,
): Promise<ProjectDetailFeature | null> {
  const rows = await query<ProjectRow>(db, sql`${PROJECT_SELECT} where p.id = ${id}`)
  const row = rows[0]
  if (!row) return null
  const points = await pointsByProject(db, [row.id])
  const feature = toFeature(row, points.get(row.id) ?? [])
  const overlaps = await findOverlaps(db, { projectId: row.id })
  return { ...feature, properties: { ...feature.properties, overlaps } }
}

import { sql } from 'drizzle-orm'
import { type Database, query } from '../db/client'
import { confidenceRank, lowerConfidence, type WireConfidence } from '../lib/confidence'
import { haversineMi } from '../lib/haversine'
import { inServiceGapDays, windowGapDays, windowOverlapDays } from '../lib/windows'

/** A pair at or past this distance is flagged as borderline. */
export const BORDERLINE_MI = 23

/** Two points this close are treated as the same physical asset. */
export const SHARED_ASSET_MI = 0.5

export const DEFAULT_MAX_MILES = 25

export type OverlapParams = {
  maxMiles?: number
  maxGapDays?: number
  minConfidence?: WireConfidence
  inScope?: boolean
  sort?: 'distance' | 'gap'
  /** Keeps only pairs involving this project. Used by GET /projects/:id. */
  projectId?: string
}

export type Overlap = {
  desc_id: string
  desc_name: string
  gpc_id: string
  gpc_name: string
  gpc_owner: string
  distance_mi: number
  desc_start: string | null
  desc_in_service: string
  gpc_start: string | null
  gpc_in_service: string
  in_service_gap_days: number
  window_overlap_days: number | null
  window_gap_days: number | null
  desc_start_source: string | null
  gpc_start_source: string | null
  pair_confidence: WireConfidence
  borderline: boolean
  shared_assets: string[]
}

type PairRow = {
  desc_id: string
  desc_name: string
  desc_confidence: string
  desc_start: string | null
  desc_in_service: string
  desc_start_source: string | null
  gpc_id: string
  gpc_name: string
  gpc_owner: string
  gpc_confidence: string
  gpc_start: string | null
  gpc_in_service: string
  gpc_start_source: string | null
  distance_mi: number
}

type PointRow = { project_id: string; name: string; lat: number; lon: number }

/**
 * Every colliding DESC x GPC pair. The only overlap logic in the codebase:
 * /overlaps, /projects/:id, /stats and /export/overlaps.csv all come through here.
 *
 * The cross join, the haversine distance and the scope filter run in SQL because
 * they prune the pair set. Dates, confidence and shared assets are derived in
 * TypeScript from tested pure functions, and the maxGapDays / minConfidence
 * filters are applied there for the same reason.
 */
export async function findOverlaps(db: Database, params: OverlapParams = {}): Promise<Overlap[]> {
  const maxMiles = params.maxMiles ?? DEFAULT_MAX_MILES
  const inScope = params.inScope ?? true
  const sort = params.sort ?? 'distance'

  const scopeFilter = inScope ? sql`and b.owner_in_scope` : sql``
  const projectFilter = params.projectId
    ? sql`and (a.id = ${params.projectId} or b.id = ${params.projectId})`
    : sql``

  const pairs = await query<PairRow>(
    db,
    sql`
      with located as (
        select
          p.id, p.utility, p.name, p.owner, p.owner_in_scope,
          p.start_date, p.start_date_source, p.in_service_date,
          g.center_lat, g.center_lon, g.location_confidence
        from projects p
        join project_geo g on g.project_id = p.id
        where g.center_lat is not null and g.center_lon is not null
      ),
      pairs as (
        select
          a.id as desc_id, a.name as desc_name, a.location_confidence as desc_confidence,
          a.start_date as desc_start, a.in_service_date as desc_in_service,
          a.start_date_source as desc_start_source,
          b.id as gpc_id, b.name as gpc_name, b.owner as gpc_owner,
          b.location_confidence as gpc_confidence,
          b.start_date as gpc_start, b.in_service_date as gpc_in_service,
          b.start_date_source as gpc_start_source,
          round((
            2 * 3958.8 * asin(sqrt(
              power(sin(radians(b.center_lat - a.center_lat) / 2), 2) +
              cos(radians(a.center_lat)) * cos(radians(b.center_lat)) *
              power(sin(radians(b.center_lon - a.center_lon) / 2), 2)))
          )::numeric, 2)::float8 as distance_mi
        from located a
        cross join located b
        where a.utility = 'DESC' and b.utility = 'GPC'
          ${scopeFilter}
          ${projectFilter}
      )
      select * from pairs where distance_mi < ${maxMiles}
    `,
  )

  if (pairs.length === 0) return []

  const points = await locatedPoints(db, pairs)

  const overlaps = pairs.map((pair): Overlap => {
    const descWindow = { start: pair.desc_start, inService: pair.desc_in_service }
    const gpcWindow = { start: pair.gpc_start, inService: pair.gpc_in_service }
    return {
      desc_id: pair.desc_id,
      desc_name: pair.desc_name,
      gpc_id: pair.gpc_id,
      gpc_name: pair.gpc_name,
      gpc_owner: pair.gpc_owner,
      distance_mi: pair.distance_mi,
      desc_start: pair.desc_start,
      desc_in_service: pair.desc_in_service,
      gpc_start: pair.gpc_start,
      gpc_in_service: pair.gpc_in_service,
      in_service_gap_days: inServiceGapDays(pair.desc_in_service, pair.gpc_in_service),
      window_overlap_days: windowOverlapDays(descWindow, gpcWindow),
      window_gap_days: windowGapDays(descWindow, gpcWindow),
      desc_start_source: pair.desc_start_source,
      gpc_start_source: pair.gpc_start_source,
      pair_confidence: lowerConfidence(pair.desc_confidence, pair.gpc_confidence),
      borderline: pair.distance_mi >= BORDERLINE_MI,
      shared_assets: sharedAssets(points.get(pair.desc_id) ?? [], points.get(pair.gpc_id) ?? []),
    }
  })

  return sortOverlaps(filterOverlaps(overlaps, params), sort)
}

async function locatedPoints(db: Database, pairs: PairRow[]): Promise<Map<string, PointRow[]>> {
  const ids = [...new Set(pairs.flatMap((pair) => [pair.desc_id, pair.gpc_id]))]
  const rows = await query<PointRow>(
    db,
    sql`
      select project_id, name, lat, lon
      from project_points
      where lat is not null and project_id in ${sql`(${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`}
      order by project_id, seq
    `,
  )
  const byProject = new Map<string, PointRow[]>()
  for (const row of rows) {
    const list = byProject.get(row.project_id)
    if (list) list.push(row)
    else byProject.set(row.project_id, [row])
  }
  return byProject
}

/**
 * Points the two projects physically share. Name matching is useless here
 * ("Thurmond" vs "Thurmond Dam"), so proximity decides.
 */
export function sharedAssets(descPoints: PointRow[], gpcPoints: PointRow[]): string[] {
  const shared: string[] = []
  for (const a of descPoints) {
    for (const b of gpcPoints) {
      if (haversineMi(a.lat, a.lon, b.lat, b.lon) < SHARED_ASSET_MI) {
        shared.push(`${a.name} / ${b.name}`)
      }
    }
  }
  return shared
}

function filterOverlaps(overlaps: Overlap[], params: OverlapParams): Overlap[] {
  const { maxGapDays, minConfidence } = params
  return overlaps.filter((overlap) => {
    if (maxGapDays !== undefined && (overlap.window_gap_days ?? 0) > maxGapDays) return false
    if (minConfidence !== undefined) {
      if (confidenceRank(overlap.pair_confidence) < confidenceRank(minConfidence)) return false
    }
    return true
  })
}

export function sortOverlaps(overlaps: Overlap[], sort: 'distance' | 'gap'): Overlap[] {
  if (sort === 'distance') {
    return [...overlaps].sort((a, b) => a.distance_mi - b.distance_mi)
  }
  // Unknown gaps sort last, then closest in-service dates, then distance.
  return [...overlaps].sort((a, b) => {
    const gapA = a.window_gap_days ?? Number.POSITIVE_INFINITY
    const gapB = b.window_gap_days ?? Number.POSITIVE_INFINITY
    if (gapA !== gapB) return gapA - gapB
    if (a.in_service_gap_days !== b.in_service_gap_days) {
      return a.in_service_gap_days - b.in_service_gap_days
    }
    return a.distance_mi - b.distance_mi
  })
}

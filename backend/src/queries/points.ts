import { sql } from 'drizzle-orm'
import { type Database, query } from '../db/client'
import type { Confidence } from '../db/schema'
import { clampConfidence, MANUAL_CONFIDENCE, type WireConfidence } from '../lib/confidence'
import type { Coordinate } from '../lib/geometry'
import type { ProjectPointOut } from './projects'

export type PointLocationUpdate = {
  lat: number
  lon: number
  source_url: string
}

export type UpdatedPoint = {
  point: ProjectPointOut
  center: Coordinate | null
  located: boolean
  location_confidence: WireConfidence | null
}

type UpdatedRow = {
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

type GeoRow = {
  center_lat: number | null
  center_lon: number | null
  points_located: number
  location_confidence: Confidence
}

/**
 * Saves a hand-checked location. Null when the project or the point is unknown.
 * `match_name` and `match_score` are cleared because they described the location
 * this edit replaces.
 */
export async function updatePointLocation(
  db: Database,
  projectId: string,
  seq: number,
  update: PointLocationUpdate,
): Promise<UpdatedPoint | null> {
  const updated = await query<UpdatedRow>(
    db,
    sql`
      update project_points set
        lat = ${update.lat},
        lon = ${update.lon},
        osm_url = ${update.source_url},
        method = 'manual',
        confidence = ${MANUAL_CONFIDENCE},
        match_name = null,
        match_score = null
      where project_id = ${projectId} and seq = ${seq}
      returning seq, name, lat, lon, method, confidence, match_name, match_score, osm_url
    `,
  )
  const row = updated[0]
  if (!row) return null

  const geo = await query<GeoRow>(
    db,
    sql`
      select center_lat, center_lon, points_located, location_confidence
      from project_geo where project_id = ${projectId}
    `,
  )
  const g = geo[0]
  const located = (g?.points_located ?? 0) > 0

  return {
    point: {
      seq: row.seq,
      name: row.name,
      lat: row.lat,
      lon: row.lon,
      method: row.method,
      confidence: clampConfidence(row.confidence),
      match_name: row.match_name,
      match_score: row.match_score,
      source_url: row.osm_url,
    },
    center:
      located && g && g.center_lon !== null && g.center_lat !== null
        ? [g.center_lon, g.center_lat]
        : null,
    located,
    location_confidence: located && g ? clampConfidence(g.location_confidence) : null,
  }
}

export type ManualOverride = {
  utility: string
  project_key: string
  seq: number
  lat: number | null
  lon: number | null
  source_url: string | null
}

/** Every hand-placed point, for backing edits up before a loader re-run. */
export async function findManualOverrides(db: Database): Promise<ManualOverride[]> {
  return query<ManualOverride>(
    db,
    sql`
      select p.utility, p.project_key, pt.seq, pt.lat, pt.lon, pt.osm_url as source_url
      from project_points pt
      join projects p on p.id = pt.project_id
      where pt.method = 'manual'
      order by p.utility, p.project_key, pt.seq
    `,
  )
}

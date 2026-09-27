import type { ManualOverride } from '../queries/points'
import type { Overlap } from '../queries/overlaps'
import type { ProjectFeature } from '../queries/projects'

/** Scalar project columns, then the flattened points, then the derived location. */
export const PROJECT_HEADERS = [
  'id',
  'utility',
  'project_key',
  'name',
  'description',
  'owner',
  'owner_in_scope',
  'project_type',
  'work_type',
  'voltage_kv',
  'zone',
  'status',
  'start_date',
  'start_date_source',
  'in_service_date',
  'in_service_raw',
  'line_miles',
  'miles_source',
  'cost_usd',
  'cost_low',
  'cost_high',
  'source_doc',
  'source_page',
  'points_located',
  'points_total',
  'point_1_name',
  'point_1_lat',
  'point_1_lon',
  'point_2_name',
  'point_2_lat',
  'point_2_lon',
  'point_3_name',
  'point_3_lat',
  'point_3_lon',
  'center_lat',
  'center_lon',
  'located',
  'location_confidence',
] as const

export const OVERLAP_HEADERS = [
  'desc_id',
  'desc_name',
  'gpc_id',
  'gpc_name',
  'gpc_owner',
  'distance_mi',
  'desc_start',
  'desc_in_service',
  'gpc_start',
  'gpc_in_service',
  'in_service_gap_days',
  'window_overlap_days',
  'window_gap_days',
  'desc_start_source',
  'gpc_start_source',
  'pair_confidence',
  'borderline',
  'shared_assets',
] as const

export const OVERRIDE_HEADERS = ['utility', 'project_key', 'point', 'lat', 'lon', 'source_url'] as const

export function projectRow(feature: ProjectFeature): unknown[] {
  const p = feature.properties
  const bySeq = (seq: number) => p.points.find((point) => point.seq === seq)
  const pointCells = [1, 2, 3].flatMap((seq) => {
    const point = bySeq(seq)
    return [point?.name ?? null, point?.lat ?? null, point?.lon ?? null]
  })
  return [
    p.id,
    p.utility,
    p.project_key,
    p.name,
    p.description,
    p.owner,
    p.owner_in_scope,
    p.project_type,
    p.work_type,
    p.voltage_kv,
    p.zone,
    p.status,
    p.start_date,
    p.start_date_source,
    p.in_service_date,
    p.in_service_raw,
    p.line_miles,
    p.miles_source,
    p.cost_usd,
    p.cost_low,
    p.cost_high,
    p.source_doc,
    p.source_page,
    p.points_located,
    p.points_total,
    ...pointCells,
    p.center ? p.center[1] : null,
    p.center ? p.center[0] : null,
    p.located,
    p.location_confidence,
  ]
}

export function overlapRow(overlap: Overlap): unknown[] {
  return [
    overlap.desc_id,
    overlap.desc_name,
    overlap.gpc_id,
    overlap.gpc_name,
    overlap.gpc_owner,
    overlap.distance_mi,
    overlap.desc_start,
    overlap.desc_in_service,
    overlap.gpc_start,
    overlap.gpc_in_service,
    overlap.in_service_gap_days,
    overlap.window_overlap_days,
    overlap.window_gap_days,
    overlap.desc_start_source,
    overlap.gpc_start_source,
    overlap.pair_confidence,
    overlap.borderline,
    overlap.shared_assets.join('; '),
  ]
}

export function overrideRow(override: ManualOverride): unknown[] {
  return [
    override.utility,
    override.project_key,
    override.seq,
    override.lat,
    override.lon,
    override.source_url,
  ]
}

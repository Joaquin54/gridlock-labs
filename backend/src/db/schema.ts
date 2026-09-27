import { type SQL, sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  pgView,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// --- Vocab ---------------------------------------------------------------

export const UTILITIES = ['DESC', 'GPC'] as const
export type Utility = (typeof UTILITIES)[number]

export const OWNERS = ['GPC', 'SAV', 'GTC', 'MEAG', 'DU', 'DESC'] as const
export type Owner = (typeof OWNERS)[number]

export const PROJECT_TYPES = ['line', 'station', 'multi_station', 'non_geographic'] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]

export const WORK_TYPES = ['rebuild', 'new_build', 'station_equipment'] as const
export type WorkType = (typeof WORK_TYPES)[number]

export const PROJECT_STATUSES = ['In Progress', 'Planned'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const START_DATE_SOURCES = ['published', 'from_spend_year', 'estimated'] as const
export type StartDateSource = (typeof START_DATE_SOURCES)[number]

export const MILES_SOURCES = ['stated', 'estimated_from_endpoints', 'not_applicable'] as const
export type MilesSource = (typeof MILES_SOURCES)[number]

export const POINT_METHODS = ['osm', 'nominatim', 'manual', 'hifld', 'eia860'] as const
export type PointMethod = (typeof POINT_METHODS)[number]

// Shared by project_points.confidence and project_geo.location_confidence.
// There is no `unlocated` value anywhere in this system; `low` is the floor/default.
export const CONFIDENCES = ['verified', 'high', 'medium', 'low'] as const
export type Confidence = (typeof CONFIDENCES)[number]

/**
 * Builds a `column IN ('a', 'b', ...)` SQL fragment for use inside table-level
 * CHECK constraints. Values are inlined as string literals rather than bound
 * parameters, since CHECK constraint definitions cannot contain query
 * placeholders.
 */
function inList(column: AnyPgColumn, values: readonly string[]): SQL {
  const literals = sql.join(
    values.map((value) => sql.raw(`'${value}'`)),
    sql.raw(', '),
  )
  return sql`${column} IN (${literals})`
}

// --- projects --------------------------------------------------------------

export const projects = pgTable(
  'projects',
  {
    id: text('id').generatedAlwaysAs(sql`utility || ':' || project_key`).primaryKey(),
    utility: text('utility').$type<Utility>().notNull(),
    projectKey: text('project_key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    owner: text('owner').$type<Owner>().notNull(),
    ownerInScope: boolean('owner_in_scope')
      .generatedAlwaysAs(sql`owner IN ('DESC','GPC','SAV')`)
      .notNull(),
    projectType: text('project_type').$type<ProjectType>(),
    workType: text('work_type').$type<WorkType>(),
    voltageKv: integer('voltage_kv'),
    zone: text('zone'),
    status: text('status').$type<ProjectStatus>(),
    startDate: date('start_date', { mode: 'string' }),
    startDateSource: text('start_date_source').$type<StartDateSource>(),
    inServiceDate: date('in_service_date', { mode: 'string' }).notNull(),
    inServiceRaw: text('in_service_raw'),
    lineMiles: numeric('line_miles', { mode: 'number', precision: 8, scale: 2 }),
    milesSource: text('miles_source').$type<MilesSource>(),
    costUsd: numeric('cost_usd', { mode: 'number', precision: 14, scale: 2 }),
    costLow: numeric('cost_low', { mode: 'number', precision: 14, scale: 2 }),
    costHigh: numeric('cost_high', { mode: 'number', precision: 14, scale: 2 }),
    // Project-level rollup as reviewed by hand. Not the same thing as
    // project_geo.location_confidence, which is the floor over the points.
    confidence: text('confidence').$type<Confidence>().notNull(),
    isBorder: boolean('is_border').notNull(),
    evidence: text('evidence'),
    sourceDoc: text('source_doc').notNull(),
    // Nullable: the load files carry no page numbers.
    sourcePage: integer('source_page'),
  },
  (t) => [
    index('projects_utility_idx').on(t.utility),
    index('projects_in_service_date_idx').on(t.inServiceDate),
    check('projects_utility_ck', inList(t.utility, UTILITIES)),
    check('projects_owner_ck', inList(t.owner, OWNERS)),
    check('projects_confidence_ck', inList(t.confidence, CONFIDENCES)),
    check(
      'projects_project_type_ck',
      sql`${t.projectType} IS NULL OR ${inList(t.projectType, PROJECT_TYPES)}`,
    ),
    check('projects_work_type_ck', sql`${t.workType} IS NULL OR ${inList(t.workType, WORK_TYPES)}`),
    check('projects_status_ck', sql`${t.status} IS NULL OR ${inList(t.status, PROJECT_STATUSES)}`),
    check(
      'projects_start_date_source_ck',
      sql`${t.startDateSource} IS NULL OR ${inList(t.startDateSource, START_DATE_SOURCES)}`,
    ),
    check(
      'projects_miles_source_ck',
      sql`${t.milesSource} IS NULL OR ${inList(t.milesSource, MILES_SOURCES)}`,
    ),
    check(
      'projects_cost_range_ck',
      sql`${t.costLow} IS NULL OR ${t.costHigh} IS NULL OR ${t.costLow} <= ${t.costHigh}`,
    ),
    check('projects_line_miles_ck', sql`${t.lineMiles} IS NULL OR ${t.lineMiles} >= 0`),
    check('projects_voltage_kv_ck', sql`${t.voltageKv} IS NULL OR ${t.voltageKv} > 0`),
    check('projects_source_page_ck', sql`${t.sourcePage} IS NULL OR ${t.sourcePage} > 0`),
  ],
)

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert

// --- points ------------------------------------------------------------------

/**
 * One row per distinct physical location. 436 located project_points rows sit at
 * only 273 coordinates, and 104 of those are shared by two or more projects, so a
 * correction here reaches every project at that spot.
 *
 * Rows are grouped by exact coordinate, never by name: the data holds four names
 * that appear at two different places each (Northwest, Goshen, Farley, Rockville).
 * Exact grouping is safe because no two distinct coordinates are within 100 m of
 * each other — the closest pair is 137 m apart.
 */
export const points = pgTable(
  'points',
  {
    // `<lat>,<lon>` from the parsed numbers, so it is stable across reloads.
    id: text('id').primaryKey(),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    /** The most common printed name among the rows at this coordinate. */
    name: text('name').notNull(),
    /** Every distinct printed name at this coordinate, sorted. */
    aliases: text('aliases').array().notNull(),
    /** The strongest confidence among the rows: one project's proof covers them all. */
    confidence: text('confidence').$type<Confidence>().notNull(),
    method: text('method').$type<PointMethod>(),
    matchName: text('match_name'),
    osmUrl: text('osm_url'),
    sourceUrl: text('source_url'),
    verifiedBy: text('verified_by'),
    note: text('note'),
  },
  (t) => [
    check('points_confidence_ck', inList(t.confidence, CONFIDENCES)),
    check('points_method_ck', sql`${t.method} IS NULL OR ${inList(t.method, POINT_METHODS)}`),
    check('points_lat_ck', sql`${t.lat} BETWEEN -90 AND 90`),
    check('points_lon_ck', sql`${t.lon} BETWEEN -180 AND 180`),
  ],
)

export type Point = typeof points.$inferSelect
export type NewPoint = typeof points.$inferInsert

// --- project_points (the join between projects and points) -------------------

export const projectPoints = pgTable(
  'project_points',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    seq: smallint('seq').notNull(),
    name: text('name').notNull(),
    lat: doublePrecision('lat'),
    lon: doublePrecision('lon'),
    // Nullable: the source CSV has blank methods for some points.
    method: text('method').$type<PointMethod>(),
    matchName: text('match_name'),
    osmUrl: text('osm_url'),
    matchScore: numeric('match_score', { mode: 'number' }),
    // Proof reference for a reviewed point: a URL, or a ref like
    // `hifld:ID=101541:end=SUB_2`. Distinct from osm_url; neither replaces the other.
    sourceUrl: text('source_url'),
    // NOT NULL with no default: the load files always carry a level, and the
    // team rule is that `low` is the floor for an unreviewed point.
    confidence: text('confidence').$type<Confidence>().notNull(),
    verifiedBy: text('verified_by'),
    verifiedAt: timestamp('verified_at', { mode: 'string', withTimezone: true }),
    verificationNote: text('verification_note'),
    // Why the point sits where it does. Free text, unlike verification_note.
    note: text('note'),
    // The shared location. NULL on the 9 unlocated rows, which have none.
    // RESTRICT, not CASCADE: deleting a shared point must not silently drop a
    // project's endpoint.
    pointId: text('point_id').references(() => points.id, { onDelete: 'restrict' }),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.seq] }),
    index('project_points_point_id_idx').on(t.pointId),
    check('project_points_seq_ck', sql`${t.seq} BETWEEN 1 AND 3`),
    check('project_points_lat_ck', sql`${t.lat} IS NULL OR (${t.lat} BETWEEN -90 AND 90)`),
    check('project_points_lon_ck', sql`${t.lon} IS NULL OR (${t.lon} BETWEEN -180 AND 180)`),
    check('project_points_lat_lon_pair_ck', sql`(${t.lat} IS NULL) = (${t.lon} IS NULL)`),
    // Confidence-floor rule: an unlocated point must be 'low' confidence.
    check('project_points_confidence_floor_ck', sql`${t.lat} IS NOT NULL OR ${t.confidence} = 'low'`),
    check(
      'project_points_verification_note_ck',
      sql`${t.verificationNote} IS NULL OR ${t.verificationNote} = 'confirmed' OR ${t.verificationNote} LIKE 'moved: %'`,
    ),
    check('project_points_method_ck', sql`${t.method} IS NULL OR ${inList(t.method, POINT_METHODS)}`),
    check(
      'project_points_confidence_ck',
      sql`${t.confidence} IS NULL OR ${inList(t.confidence, CONFIDENCES)}`,
    ),
    // A row has a shared point exactly when it has coordinates.
    check('project_points_point_id_ck', sql`(${t.pointId} IS NULL) = (${t.lat} IS NULL)`),
  ],
)

export type ProjectPoint = typeof projectPoints.$inferSelect
export type NewProjectPoint = typeof projectPoints.$inferInsert

// --- project_geo (view) ------------------------------------------------------

export const projectGeo = pgView('project_geo', {
  projectId: text('project_id').notNull(),
  centerLat: doublePrecision('center_lat'),
  centerLon: doublePrecision('center_lon'),
  shape: jsonb('shape').$type<[number, number][]>().notNull(),
  pointsLocated: integer('points_located').notNull(),
  pointsTotal: integer('points_total').notNull(),
  locationConfidence: text('location_confidence').$type<Confidence>().notNull(),
  confirmed: boolean('confirmed').notNull(),
}).as(sql`
  select
    p.id as project_id,
    case
      when count(pt.lat) = 0 then null
      when p.project_type = 'multi_station' then avg(pt.lat)
      else (
        (array_agg(pt.lat order by pt.seq) filter (where pt.lat is not null))[1]
        + (array_agg(pt.lat order by pt.seq desc) filter (where pt.lat is not null))[1]
      ) / 2.0
    end as center_lat,
    case
      when count(pt.lat) = 0 then null
      when p.project_type = 'multi_station' then avg(pt.lon)
      else (
        (array_agg(pt.lon order by pt.seq) filter (where pt.lat is not null))[1]
        + (array_agg(pt.lon order by pt.seq desc) filter (where pt.lat is not null))[1]
      ) / 2.0
    end as center_lon,
    coalesce(
      jsonb_agg(jsonb_build_array(pt.lon, pt.lat) order by pt.seq) filter (where pt.lat is not null),
      '[]'::jsonb
    ) as shape,
    count(pt.lat)::int as points_located,
    count(pt.project_id)::int as points_total,
    case min(
      case coalesce(pt.confidence, 'low')
        when 'verified' then 4
        when 'high' then 3
        when 'medium' then 2
        when 'low' then 1
      end
    )
      when 4 then 'verified'
      when 3 then 'high'
      when 2 then 'medium'
      when 1 then 'low'
      else 'low'
    end as location_confidence,
    coalesce(bool_and(coalesce(pt.confidence, 'low') = 'verified'), false) as confirmed
  from projects p
  left join project_points pt on pt.project_id = p.id
  group by p.id, p.project_type
`)

export type ProjectGeo = typeof projectGeo.$inferSelect

// --- point_usage (view) ------------------------------------------------------

/** Who shares each location — the map's tooltip and the shared-asset signal. */
export const pointUsage = pgView('point_usage', {
  pointId: text('point_id').notNull(),
  name: text('name').notNull(),
  aliases: text('aliases').array().notNull(),
  lat: doublePrecision('lat').notNull(),
  lon: doublePrecision('lon').notNull(),
  locationConfidence: text('confidence').$type<Confidence>().notNull(),
  nProjects: integer('n_projects').notNull(),
  utilities: text('utilities').array().notNull(),
  projectIds: text('project_ids').array().notNull(),
}).as(sql`
  select
    pt.id as point_id,
    pt.name,
    pt.aliases,
    pt.lat,
    pt.lon,
    pt.confidence,
    count(distinct pp.project_id)::int as n_projects,
    array_agg(distinct p.utility) as utilities,
    array_agg(distinct pp.project_id) as project_ids
  from points pt
  join project_points pp on pp.point_id = pt.id
  join projects p on p.id = pp.project_id
  group by pt.id, pt.name, pt.aliases, pt.lat, pt.lon, pt.confidence
`)

export type PointUsage = typeof pointUsage.$inferSelect

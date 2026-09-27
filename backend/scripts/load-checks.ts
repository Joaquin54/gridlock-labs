/**
 * The parity checks that decide whether a load commits. They run inside the load
 * transaction against the database, and compare it with the CSVs the load came
 * from — never with a second copy of the numbers derived the same way.
 */
import { sql } from 'drizzle-orm'
import { type Database, query } from '../src/db/client'
import { haversineMi } from '../src/lib/haversine'
import { findOverlaps } from '../src/queries/overlaps'

export type CheckRow = { name: string; expected: string; actual: string; pass: boolean }
export type RawRow = Record<string, string>

/** Every number the task pinned. None of these move to make a check pass. */
export const EXPECTED = {
  projects: 252,
  projectsGpc: 208,
  projectsDesc: 44,
  points: 445,
  pointsLocated: 436,
  projectConfidence: { verified: 103, high: 5, medium: 13, low: 131 },
  pointConfidence: { verified: 234, high: 2, medium: 8, low: 201 },
  unlocatedPoints: 9,
  nullConfidencePoints: 0,
  matchNameNonNull: 356,
  overlapsInScope: 77,
  overlapsAllOwners: 77,
  closest: { desc: 'DESC:6810 O', gpc: 'GPC:16007', miles: 2.33, days: 578 },
  farthest: { desc: 'DESC:06367 A - C, H', gpc: 'GPC:19523', miles: 24.93, days: 250 },
  distanceSum: 1252.93,
  distanceSumTolerance: 0.05,
  lowConfidencePairs: 16,
  // Pinned pairs: the McIntosh correction on GPC:20277 moves only its own pairs.
  namedPairs: [
    { desc: 'DESC:06367 D - G', gpc: 'GPC:20277', miles: 4.23, days: 152 },
    { desc: 'DESC:6808 S', gpc: 'GPC:20277', miles: 13.12, days: 365 },
  ],
  pointsRows: 273,
  pointsShared: 104,
  crossUtilityPoints: 0,
  sharedSpot: [
    { id: '32.35212,-81.17511', name: 'McIntosh', projects: ['GPC:20065', 'GPC:20277'] },
    {
      id: '32.335802,-81.031444',
      name: 'Okatie',
      projects: ['DESC:0139 M,N', 'DESC:06367 A - C, H', 'DESC:06367 D - G', 'DESC:6808 S'],
    },
  ],
  centers: {
    'GPC:19523': [32.166622, -81.460932],
    'DESC:06367 A - C, H': [32.273561, -81.053642],
    'GPC:16007': [33.446143, -81.950468],
    'DESC:6853 B-F': [34.205502, -80.992842],
  } as Record<string, [number, number]>,
} as const

/** 5 ft, the centre tolerance, in miles. */
const FIVE_FEET_MI = 5 / 5280
/** Coordinates must land on the CSV value, not near it. */
const COORD_TOLERANCE = 1e-9

/**
 * The centre rule, computed from the CSV alone: midpoint of the outer located
 * points for a line or station, the mean of the located points for a
 * multi_station, and the single located point when only one is located.
 */
export function computeCenter(
  points: RawRow[],
  projectType: string,
): [number, number] | null {
  const located = points
    .filter((p) => p.lat !== '' && p.lon !== '')
    .sort((a, b) => Number(a.seq) - Number(b.seq))
  if (located.length === 0) return null
  if (projectType === 'multi_station') {
    const lat = located.reduce((sum, p) => sum + Number(p.lat), 0) / located.length
    const lon = located.reduce((sum, p) => sum + Number(p.lon), 0) / located.length
    return [lat, lon]
  }
  const first = located[0]
  const last = located[located.length - 1]
  return [(Number(first.lat) + Number(last.lat)) / 2, (Number(first.lon) + Number(last.lon)) / 2]
}

function check(name: string, expected: unknown, actual: unknown, pass?: boolean): CheckRow {
  return {
    name,
    expected: String(expected),
    actual: String(actual),
    pass: pass ?? String(expected) === String(actual),
  }
}

export async function runChecks(
  db: Database,
  projectRaw: RawRow[],
  pointRaw: RawRow[],
): Promise<CheckRow[]> {
  const E = EXPECTED
  const rows: CheckRow[] = []
  const byProject = new Map<string, RawRow[]>()
  for (const point of pointRaw) {
    const list = byProject.get(point.project_id)
    if (list) list.push(point)
    else byProject.set(point.project_id, [point])
  }

  // --- row counts
  const counts = (
    await query<{ utility: string; n: number }>(
      db,
      sql`select utility, count(*)::int as n from projects group by utility`,
    )
  ).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.utility]: r.n }), {})
  const total = (counts.GPC ?? 0) + (counts.DESC ?? 0)
  rows.push(check('projects total', E.projects, total))
  rows.push(check('projects GPC', E.projectsGpc, counts.GPC ?? 0))
  rows.push(check('projects DESC', E.projectsDesc, counts.DESC ?? 0))

  const pointCounts = (
    await query<{ n: number; located: number; nullConf: number; matchName: number }>(
      db,
      sql`select count(*)::int as n,
                 count(lat)::int as located,
                 count(*) filter (where confidence is null)::int as "nullConf",
                 count(match_name)::int as "matchName"
          from project_points`,
    )
  )[0]
  rows.push(check('project_points total', E.points, pointCounts.n))
  rows.push(check('project_points located', E.pointsLocated, pointCounts.located))
  rows.push(
    check('points with NULL lat and lon', E.unlocatedPoints, pointCounts.n - pointCounts.located),
  )
  rows.push(check('points with NULL confidence', E.nullConfidencePoints, pointCounts.nullConf))
  rows.push(check('points with match_name', E.matchNameNonNull, pointCounts.matchName))

  const pconf = (
    await query<{ confidence: string; n: number }>(
      db,
      sql`select confidence, count(*)::int as n from project_points group by confidence`,
    )
  ).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.confidence]: r.n }), {})
  for (const [level, want] of Object.entries(E.pointConfidence)) {
    rows.push(check(`point confidence ${level}`, want, pconf[level] ?? 0))
  }

  // --- projects.confidence (the stored rollup, not the derived floor)
  const conf = (
    await query<{ confidence: string; n: number }>(
      db,
      sql`select confidence, count(*)::int as n from projects group by confidence`,
    )
  ).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.confidence]: r.n }), {})
  for (const [level, want] of Object.entries(E.projectConfidence)) {
    rows.push(check(`projects.confidence ${level}`, want, conf[level] ?? 0))
  }

  // --- ids survived as text
  for (const id of ['GPC:09661', 'DESC:06367 A - C, H']) {
    const hit = await query<{ n: number }>(
      db,
      sql`select count(*)::int as n from projects where id = ${id}`,
    )
    rows.push(check(`id '${id}' exists`, 1, hit[0].n))
  }

  // --- dates, compared as text so postgres.js cannot reinterpret them
  const dbDates = await query<{ id: string; in_service: string; raw: string | null }>(
    db,
    sql`select id, in_service_date::text as in_service, in_service_raw as raw from projects`,
  )
  const dateMap = new Map(dbDates.map((r) => [r.id, r]))
  const dateMismatch = projectRaw.filter(
    (r) => dateMap.get(r.id)?.in_service !== r.in_service_date,
  )
  rows.push(check('in_service_date matches CSV (all rows)', 0, dateMismatch.length))
  const rawMismatch = projectRaw.filter(
    (r) => (dateMap.get(r.id)?.raw ?? '') !== r.in_service_raw,
  )
  rows.push(check('in_service_raw matches CSV (all rows)', 0, rawMismatch.length))
  rows.push(check("in_service_raw 'DESC:6807 B'", '12/31/23', dateMap.get('DESC:6807 B')?.raw))

  // --- coordinates
  const dbPoints = await query<{
    project_id: string
    seq: number
    lat: number | null
    lon: number | null
  }>(db, sql`select project_id, seq, lat, lon from project_points`)
  const pointMap = new Map(dbPoints.map((r) => [`${r.project_id}\u0000${r.seq}`, r]))
  const coordMismatch = pointRaw.filter((r) => {
    const got = pointMap.get(`${r.project_id}\u0000${r.seq}`)
    if (!got) return true
    if (r.lat === '') return got.lat !== null || got.lon !== null
    return (
      got.lat === null ||
      got.lon === null ||
      Math.abs(got.lat - Number(r.lat)) > COORD_TOLERANCE ||
      Math.abs(got.lon - Number(r.lon)) > COORD_TOLERANCE
    )
  })
  rows.push(check('lat/lon match CSV (all 445 rows)', 0, coordMismatch.length))

  // --- centres, against the rule recomputed from the CSV
  const geo = await query<{ project_id: string; center_lat: number | null; center_lon: number | null }>(
    db,
    sql`select project_id, center_lat, center_lon from project_geo`,
  )
  rows.push(check('project_geo rows', E.projects, geo.length))
  const types = new Map(projectRaw.map((r) => [r.id, r.project_type]))
  let centerOff = 0
  for (const row of geo) {
    const want = computeCenter(byProject.get(row.project_id) ?? [], types.get(row.project_id) ?? '')
    if (want === null) {
      if (row.center_lat !== null || row.center_lon !== null) centerOff += 1
      continue
    }
    if (row.center_lat === null || row.center_lon === null) {
      centerOff += 1
      continue
    }
    if (haversineMi(row.center_lat, row.center_lon, want[0], want[1]) > FIVE_FEET_MI) centerOff += 1
  }
  rows.push(check('centres within 5 ft of the CSV rule', 0, centerOff))
  const centerMap = new Map(geo.map((r) => [r.project_id, r]))
  for (const [id, want] of Object.entries(E.centers)) {
    const got = centerMap.get(id)
    const ok =
      got?.center_lat != null &&
      got.center_lon != null &&
      haversineMi(got.center_lat, got.center_lon, want[0], want[1]) <= FIVE_FEET_MI
    rows.push(
      check(
        `centre ${id}`,
        `${want[0]}, ${want[1]}`,
        got?.center_lat == null ? 'null' : `${got.center_lat.toFixed(6)}, ${got.center_lon?.toFixed(6)}`,
        ok,
      ),
    )
  }

  // --- the shared points table and its join
  const pointsTotal = (
    await query<{ n: number }>(db, sql`select count(*)::int as n from points`)
  )[0].n
  rows.push(check('points rows', E.pointsRows, pointsTotal))

  const linkMismatch = (
    await query<{ coords: number; nulls: number }>(
      db,
      sql`select
            count(*) filter (
              where pp.lat is not null
                and (p.lat is distinct from pp.lat or p.lon is distinct from pp.lon)
            )::int as coords,
            count(*) filter (where (pp.point_id is null) <> (pp.lat is null))::int as nulls
          from project_points pp
          left join points p on p.id = pp.point_id`,
    )
  )[0]
  rows.push(
    check(`join lat/lon equals its point's (of ${E.pointsLocated})`, 0, linkMismatch.coords),
  )
  rows.push(check('point_id NULL exactly on the unlocated rows', 0, linkMismatch.nulls))

  const usage = await query<{
    point_id: string
    n_projects: number
    project_ids: string[]
    utilities: string[]
  }>(db, sql`select point_id, n_projects, project_ids, utilities from point_usage`)
  rows.push(check('point_usage rows', E.pointsRows, usage.length))
  rows.push(
    check('points used by 2+ projects', E.pointsShared, usage.filter((u) => u.n_projects >= 2).length),
  )
  rows.push(
    check(
      'cross-utility points',
      E.crossUtilityPoints,
      usage.filter((u) => u.utilities.length > 1).length,
    ),
  )
  for (const spot of E.sharedSpot) {
    const got = usage.find((u) => u.point_id === spot.id)
    const ids = [...(got?.project_ids ?? [])].sort()
    rows.push(
      check(
        `${spot.name} ${spot.id}`,
        `${spot.projects.length} projects: ${spot.projects.join(', ')}`,
        got ? `${got.n_projects} projects: ${ids.join(', ')}` : 'not found',
        got?.n_projects === spot.projects.length && ids.join(',') === spot.projects.join(','),
      ),
    )
  }

  // --- overlaps, through the app's own query
  const inScope = await findOverlaps(db, { maxMiles: 25, inScope: true })
  const allOwners = await findOverlaps(db, { maxMiles: 25, inScope: false })
  rows.push(check('overlaps in scope (< 25 mi)', E.overlapsInScope, inScope.length))
  rows.push(check('overlaps all owners', E.overlapsAllOwners, allOwners.length))

  const sorted = [...inScope].sort((a, b) => a.distance_mi - b.distance_mi)
  const closest = sorted[0]
  const farthest = sorted[sorted.length - 1]
  rows.push(
    check(
      'closest pair',
      `${E.closest.gpc} – ${E.closest.desc} ${E.closest.miles} mi, ${E.closest.days} d`,
      closest && `${closest.gpc_id} – ${closest.desc_id} ${closest.distance_mi} mi, ${closest.in_service_gap_days} d`,
      closest?.desc_id === E.closest.desc &&
        closest?.gpc_id === E.closest.gpc &&
        closest?.distance_mi === E.closest.miles &&
        closest?.in_service_gap_days === E.closest.days,
    ),
  )
  rows.push(
    check(
      'farthest pair',
      `${E.farthest.gpc} – ${E.farthest.desc} ${E.farthest.miles} mi, ${E.farthest.days} d`,
      farthest && `${farthest.gpc_id} – ${farthest.desc_id} ${farthest.distance_mi} mi, ${farthest.in_service_gap_days} d`,
      farthest?.desc_id === E.farthest.desc &&
        farthest?.gpc_id === E.farthest.gpc &&
        farthest?.distance_mi === E.farthest.miles &&
        farthest?.in_service_gap_days === E.farthest.days,
    ),
  )
  for (const want of E.namedPairs) {
    const got = inScope.find((o) => o.desc_id === want.desc && o.gpc_id === want.gpc)
    rows.push(
      check(
        `pair ${want.gpc} x ${want.desc}`,
        `${want.miles} mi, ${want.days} d`,
        got ? `${got.distance_mi} mi, ${got.in_service_gap_days} d` : 'not found',
        got?.distance_mi === want.miles && got?.in_service_gap_days === want.days,
      ),
    )
  }

  const sum = inScope.reduce((acc, o) => acc + o.distance_mi, 0)
  rows.push(
    check(
      'sum of pair distances',
      `${E.distanceSum} ±${E.distanceSumTolerance}`,
      sum.toFixed(2),
      Math.abs(sum - E.distanceSum) <= E.distanceSumTolerance,
    ),
  )

  // Low-confidence pairs read projects.confidence, per decision 1 — not the
  // derived location_confidence, which disagrees on 14 rows.
  const stored = new Map(
    (
      await query<{ id: string; confidence: string }>(
        db,
        sql`select id, confidence from projects`,
      )
    ).map((r) => [r.id, r.confidence]),
  )
  const lowPairs = inScope.filter(
    (o) => stored.get(o.desc_id) === 'low' || stored.get(o.gpc_id) === 'low',
  ).length
  rows.push(check('low-confidence pairs (projects.confidence)', E.lowConfidencePairs, lowPairs))

  return rows
}

/**
 * Decision 9 asked for this to be reported, not enforced: how the hardened
 * derived floor now lines up with the stored rollup.
 */
export async function reportConfidenceDrift(db: Database): Promise<{
  distribution: Record<string, number>
  disagreements: { id: string; stored: string; derived: string }[]
}> {
  const derived = await query<{ location_confidence: string; n: number }>(
    db,
    sql`select location_confidence, count(*)::int as n from project_geo group by location_confidence`,
  )
  const disagreements = await query<{ id: string; stored: string; derived: string }>(
    db,
    sql`select p.id, p.confidence as stored, g.location_confidence as derived
        from projects p join project_geo g on g.project_id = p.id
        where p.confidence <> g.location_confidence
        order by p.id`,
  )
  return {
    distribution: derived.reduce<Record<string, number>>(
      (acc, r) => ({ ...acc, [r.location_confidence]: r.n }),
      {},
    ),
    disagreements,
  }
}

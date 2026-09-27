import { beforeAll, describe, expect, test } from 'bun:test'
import app from '../src/index'

const fetcher = (app as { fetch: (request: Request) => Promise<Response> }).fetch

async function get(path: string) {
  const res = await fetcher(new Request(`http://localhost${path}`))
  return { status: res.status, headers: res.headers, res }
}

async function json<T>(path: string): Promise<T> {
  const res = await fetcher(new Request(`http://localhost${path}`))
  return (await res.json()) as T
}

async function text(path: string): Promise<string> {
  const res = await fetcher(new Request(`http://localhost${path}`))
  return res.text()
}

const HOOKS_THURMOND = encodeURIComponent('DESC:6810 A')
const STEVENS_HOOKS = encodeURIComponent('DESC:6808 N,O')

type Feature = {
  id: string
  geometry: { type: string; coordinates: unknown } | null
  properties: Record<string, any>
}
type Collection = { type: string; features: Feature[] }
type Overlap = Record<string, any>

describe('the PGlite fixture server', () => {
  beforeAll(async () => {
    // Fails loudly if the schema or the view never got created.
    const health = await json<{ ok: boolean; db: boolean }>('/health')
    expect(health).toEqual({ ok: true, db: true })
  })

  test('GET /projects returns every project, unlocated included', async () => {
    const body = await json<Collection>('/projects')
    expect(body.type).toBe('FeatureCollection')
    expect(body.features).toHaveLength(5)
    expect(body.features.map((f) => f.id).sort()).toEqual([
      'DESC:6808 N,O',
      'DESC:6810 A',
      'GPC:19523',
      'GPC:20793',
      'GPC:21044',
    ])
  })

  test('the unlocated project carries no geometry, center or confidence', async () => {
    const body = await json<Collection>('/projects?located=false')
    expect(body.features).toHaveLength(1)
    const feature = body.features[0] as Feature
    expect(feature.id).toBe('GPC:19523')
    expect(feature.geometry).toBeNull()
    expect(feature.properties.center).toBeNull()
    expect(feature.properties.located).toBe(false)
    expect(feature.properties.location_confidence).toBeNull()
    expect(feature.properties.points_located).toBe(0)
    expect(feature.properties.points_total).toBe(2)
  })

  test('geometry follows the project type', async () => {
    const body = await json<Collection>('/projects')
    const byId = new Map(body.features.map((f) => [f.id, f]))
    expect(byId.get('DESC:6810 A')?.geometry?.type).toBe('LineString')
    expect(byId.get('GPC:21044')?.geometry?.type).toBe('Point')
    expect(byId.get('GPC:19523')?.geometry).toBeNull()
  })

  test('numeric columns come back as numbers, not strings', async () => {
    const body = await json<Feature>(`/projects/${HOOKS_THURMOND}`)
    expect(body.properties.line_miles).toBe(2.1)
    expect(body.properties.cost_usd).toBe(2200080)
    expect(typeof body.properties.points[0].match_score).toBe('number')
  })

  test('an id containing a comma round-trips', async () => {
    const body = await json<Feature>(`/projects/${STEVENS_HOOKS}`)
    expect(body.id).toBe('DESC:6808 N,O')
    expect(body.properties.project_key).toBe('6808 N,O')
  })

  test('an unknown project is a 404', async () => {
    const { status } = await get('/projects/NOPE%3A1')
    expect(status).toBe(404)
  })

  test('GET /overlaps finds the in-scope pair and its shared asset', async () => {
    const overlaps = await json<Overlap[]>('/overlaps')
    const pair = overlaps.find((o) => o.desc_id === 'DESC:6810 A' && o.gpc_id === 'GPC:20793')
    expect(pair).toBeDefined()
    expect(pair?.distance_mi).toBe(3.63)
    expect(pair?.shared_assets).toEqual(['Thurmond / Thurmond Dam'])
    expect(pair?.pair_confidence).toBe('medium')
    expect(pair?.borderline).toBe(false)
    expect(pair?.window_gap_days).toBe(1978)
    expect(pair?.window_overlap_days).toBe(0)
  })

  test('a null start date nulls both window fields', async () => {
    const overlaps = await json<Overlap[]>('/overlaps')
    const pair = overlaps.find((o) => o.desc_id === 'DESC:6808 N,O')
    expect(pair?.desc_start).toBeNull()
    expect(pair?.window_gap_days).toBeNull()
    expect(pair?.window_overlap_days).toBeNull()
    expect(pair?.in_service_gap_days).toBe(2528)
  })

  test('inScope excludes the GTC project by default and includes it when false', async () => {
    const scoped = await json<Overlap[]>('/overlaps')
    expect(scoped.every((o) => o.gpc_owner !== 'GTC')).toBe(true)
    const all = await json<Overlap[]>('/overlaps?inScope=false')
    expect(all.some((o) => o.gpc_owner === 'GTC')).toBe(true)
    expect(all.length).toBeGreaterThan(scoped.length)
  })

  test('sort=distance is ascending', async () => {
    const overlaps = await json<Overlap[]>('/overlaps?inScope=false')
    const distances = overlaps.map((o) => o.distance_mi)
    expect([...distances].sort((a, b) => a - b)).toEqual(distances)
  })

  test('/projects/:id carries only that project’s overlaps', async () => {
    const body = await json<Feature>(`/projects/${HOOKS_THURMOND}`)
    expect(body.properties.overlaps).toHaveLength(1)
    expect(body.properties.overlaps[0].desc_id).toBe('DESC:6810 A')
  })

  test('bad input is a 400 with issues', async () => {
    for (const path of ['/overlaps?maxMiles=0', '/projects?bbox=1,2,3', '/projects?utility=XX']) {
      const res = await fetcher(new Request(`http://localhost${path}`))
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: string; issues: unknown[] }
      expect(body.error).toBeString()
      expect(body.issues.length).toBeGreaterThan(0)
    }
  })

  test('GET /stats counts projects, locations and overlaps', async () => {
    const stats = await json<any>('/stats')
    expect(stats.projects).toEqual({ DESC: 2, GPC: 3 })
    expect(stats.located).toEqual({ DESC: 2, GPC: 2 })
    expect(stats.unlocated).toEqual({ DESC: 0, GPC: 1 })
    expect(stats.confidence).toEqual({ high: 1, medium: 2, low: 1 })
    expect(stats.overlaps.total).toBe(2)
    expect(stats.overlaps.medium).toBe(2)
  })

  test('the CSV exports carry a filename and quote comma-bearing ids', async () => {
    const { headers } = await get('/export/projects_desc.csv')
    expect(headers.get('content-disposition')).toBe('attachment; filename="projects_desc.csv"')
    const csv = await text('/export/projects_desc.csv')
    const lines = csv.trimEnd().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toStartWith('id,utility,project_key,')
    expect(lines[1]).toStartWith('"DESC:6808 N,O",DESC,"6808 N,O",')
  })

  test('overlaps.csv joins shared assets with a semicolon', async () => {
    const csv = await text('/export/overlaps.csv')
    expect(csv.split('\r\n')[0]).toStartWith('desc_id,desc_name,gpc_id,')
    expect(csv).toContain('Thurmond / Thurmond Dam')
  })

  test('the GeoJSON exports hold the same features as /projects', async () => {
    const exported = await json<Collection>('/export/projects_gpc.geojson')
    const live = await json<Collection>('/projects?utility=GPC')
    expect(exported).toEqual(live)
  })

  test('PATCH moves the point, the center and the overlap', async () => {
    const before = await json<Overlap[]>('/overlaps')
    const beforePair = before.find((o) => o.gpc_id === 'GPC:20793' && o.desc_id === 'DESC:6810 A')

    const res = await fetcher(
      new Request(`http://localhost/projects/${HOOKS_THURMOND}/points/2`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lat: 33.7,
          lon: -82.3,
          source_url: 'https://www.openstreetmap.org/node/999',
        }),
      }),
    )
    expect(res.status).toBe(200)
    const updated = (await res.json()) as any

    expect(updated.point.lat).toBe(33.7)
    expect(updated.point.lon).toBe(-82.3)
    expect(updated.point.method).toBe('manual')
    expect(updated.point.confidence).toBe('high')
    expect(updated.point.match_name).toBeNull()
    expect(updated.point.match_score).toBeNull()
    expect(updated.point.source_url).toBe('https://www.openstreetmap.org/node/999')
    expect(updated.located).toBe(true)
    // Weakest point still medium, so the project stays medium.
    expect(updated.location_confidence).toBe('medium')
    expect(updated.center?.[0]).toBeCloseTo(-82.23, 10)
    expect(updated.center?.[1]).toBeCloseTo(33.67, 10)

    const after = await json<Overlap[]>('/overlaps')
    const afterPair = after.find((o) => o.gpc_id === 'GPC:20793' && o.desc_id === 'DESC:6810 A')
    expect(afterPair?.distance_mi).not.toBe(beforePair?.distance_mi)
    // The Thurmond points are no longer within half a mile of each other.
    expect(afterPair?.shared_assets).toEqual([])
  })

  test('the manual edit shows up in location_overrides.csv', async () => {
    const csv = await text('/export/location_overrides.csv')
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0]).toBe('utility,project_key,point,lat,lon,source_url')
    expect(lines).toHaveLength(2)
    // '6810 A' holds no comma, so RFC 4180 leaves it unquoted.
    expect(lines[1]).toBe('DESC,6810 A,2,33.7,-82.3,https://www.openstreetmap.org/node/999')
  })

  test('PATCH rejects out-of-range coordinates and a bad url', async () => {
    const bodies = [
      { lat: 91, lon: -82.3, source_url: 'https://example.org/a' },
      { lat: 33.7, lon: -181, source_url: 'https://example.org/a' },
      { lat: 33.7, lon: -82.3, source_url: 'not a url' },
      { lat: 33.7, lon: -82.3 },
    ]
    for (const body of bodies) {
      const res = await fetcher(
        new Request(`http://localhost/projects/${HOOKS_THURMOND}/points/1`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      )
      expect(res.status).toBe(400)
    }
  })

  test('PATCH on an unknown point or a seq outside 1-3 fails', async () => {
    const valid = JSON.stringify({
      lat: 33.7,
      lon: -82.3,
      source_url: 'https://example.org/a',
    })
    const headers = { 'content-type': 'application/json' }

    const missing = await fetcher(
      new Request(`http://localhost/projects/${HOOKS_THURMOND}/points/3`, {
        method: 'PATCH',
        headers,
        body: valid,
      }),
    )
    expect(missing.status).toBe(404)

    const badSeq = await fetcher(
      new Request(`http://localhost/projects/${HOOKS_THURMOND}/points/9`, {
        method: 'PATCH',
        headers,
        body: valid,
      }),
    )
    expect(badSeq.status).toBe(400)
  })
})

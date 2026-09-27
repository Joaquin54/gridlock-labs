import { Hono } from 'hono'
import { db } from '../db'
import type { Utility } from '../db/schema'
import { toCsv } from '../lib/csv'
import {
  OVERLAP_HEADERS,
  OVERRIDE_HEADERS,
  overlapRow,
  overrideRow,
  PROJECT_HEADERS,
  projectRow,
} from '../lib/exportTables'
import { findManualOverrides } from '../queries/points'
import { findProjects } from '../queries/projects'
import { findOverlaps } from '../queries/overlaps'
import { overlapQuerySchema, validateQuery } from '../schemas'

const exports = new Hono()

function attach(filename: string, body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      'content-type': contentType,
      'content-disposition': `attachment; filename="${filename}"`,
    },
  })
}

function csvResponse(filename: string, body: string): Response {
  return attach(filename, body, 'text/csv; charset=utf-8')
}

/** Projects are already ordered by project_key in findProjects. */
async function projectCsv(utility: Utility): Promise<string> {
  const features = await findProjects(db, { utility })
  return toCsv(PROJECT_HEADERS, features.map(projectRow))
}

exports.get('/export/projects_desc.csv', async () =>
  csvResponse('projects_desc.csv', await projectCsv('DESC')),
)

exports.get('/export/projects_gpc.csv', async () =>
  csvResponse('projects_gpc.csv', await projectCsv('GPC')),
)

exports.get('/export/overlaps.csv', validateQuery(overlapQuerySchema), async (c) => {
  const overlaps = await findOverlaps(db, c.req.valid('query'))
  return csvResponse('overlaps.csv', toCsv(OVERLAP_HEADERS, overlaps.map(overlapRow)))
})

exports.get('/export/location_overrides.csv', async () => {
  const overrides = await findManualOverrides(db)
  return csvResponse('location_overrides.csv', toCsv(OVERRIDE_HEADERS, overrides.map(overrideRow)))
})

async function geojson(utility: Utility, filename: string): Promise<Response> {
  const features = await findProjects(db, { utility })
  const body = JSON.stringify({ type: 'FeatureCollection', features })
  return attach(filename, body, 'application/geo+json')
}

exports.get('/export/projects_desc.geojson', async () =>
  geojson('DESC', 'projects_desc.geojson'),
)

exports.get('/export/projects_gpc.geojson', async () => geojson('GPC', 'projects_gpc.geojson'))

export default exports

import { Hono } from 'hono'
import { db } from '../db'
import { updatePointLocation } from '../queries/points'
import { findProjectById, findProjects } from '../queries/projects'
import {
  pointLocationBodySchema,
  pointParamsSchema,
  projectQuerySchema,
  validateBody,
  validateParam,
  validateQuery,
} from '../schemas'

const projects = new Hono()

projects.get('/projects', validateQuery(projectQuerySchema), async (c) => {
  const features = await findProjects(db, c.req.valid('query'))
  return c.json({ type: 'FeatureCollection', features })
})

projects.get('/projects/:id', async (c) => {
  const feature = await findProjectById(db, c.req.param('id'))
  if (!feature) return c.json({ error: 'project not found' }, 404)
  return c.json(feature)
})

projects.patch(
  '/projects/:id/points/:seq',
  validateParam(pointParamsSchema),
  validateBody(pointLocationBodySchema),
  async (c) => {
    const updated = await updatePointLocation(
      db,
      c.req.param('id'),
      c.req.valid('param').seq,
      c.req.valid('json'),
    )
    if (!updated) return c.json({ error: 'point not found' }, 404)
    return c.json(updated)
  },
)

export default projects

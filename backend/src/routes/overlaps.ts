import { Hono } from 'hono'
import { db } from '../db'
import { findOverlaps } from '../queries/overlaps'
import { overlapQuerySchema, validateQuery } from '../schemas'

const overlaps = new Hono()

overlaps.get('/overlaps', validateQuery(overlapQuerySchema), async (c) => {
  return c.json(await findOverlaps(db, c.req.valid('query')))
})

export default overlaps

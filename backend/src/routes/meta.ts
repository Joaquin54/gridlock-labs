import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { db, missingRelations, query } from '../db'
import { getStats } from '../queries/stats'

const meta = new Hono()

meta.get('/health', async (c) => {
  try {
    await query(db, sql`select 1`)
  } catch {
    return c.json({ ok: false, db: false }, 503)
  }
  const missing = await missingRelations()
  if (missing.length > 0) {
    return c.json({ ok: false, db: true, schema: false, missing }, 503)
  }
  return c.json({ ok: true, db: true })
})

meta.get('/stats', async (c) => {
  return c.json(await getStats(db))
})

export default meta

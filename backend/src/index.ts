import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { missingRelations } from './db'
import exportRoutes from './routes/export'
import meta from './routes/meta'
import overlaps from './routes/overlaps'
import projects from './routes/projects'
import savings from './routes/savings'

const origin = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const app = new Hono()

app.use('*', cors({ origin }))

app.route('/', savings)

// Until the schema is pushed every route but /health is unusable.
app.use('*', async (c, next) => {
  if (c.req.path === '/health' || c.req.path === '/savings') return next()
  const missing = await missingRelations()
  if (missing.length > 0) {
    return c.json({ ok: false, db: true, schema: false, missing }, 503)
  }
  return next()
})

app.route('/', meta)
app.route('/', overlaps)
app.route('/', projects)
app.route('/', exportRoutes)

export default { port: Number(process.env.PORT ?? 3000), fetch: app.fetch }

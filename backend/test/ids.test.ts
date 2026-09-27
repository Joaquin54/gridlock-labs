import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'

/**
 * Project ids contain spaces and commas. The client sends them through
 * encodeURIComponent; the server must decode exactly once. Uses a bare Hono app
 * so this stays a pure routing test with no database.
 */
const app = new Hono()
app.get('/projects/:id', (c) => c.json({ id: c.req.param('id') }))
app.patch('/projects/:id/points/:seq', (c) =>
  c.json({ id: c.req.param('id'), seq: c.req.param('seq') }),
)

const IDS = ['DESC:6808 N,O', 'DESC:1060A, I, L', 'DESC:6810 A', 'GPC:20793']

describe('id decoding', () => {
  test.each(IDS)('GET /projects/:id round-trips %s', async (id) => {
    const res = await app.request(`/projects/${encodeURIComponent(id)}`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id })
  })

  test.each(IDS)('PATCH /projects/:id/points/:seq round-trips %s', async (id) => {
    const res = await app.request(`/projects/${encodeURIComponent(id)}/points/2`, { method: 'PATCH' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id, seq: '2' })
  })

  test('a single decode, not two: %2520 stays encoded once', async () => {
    const res = await app.request(`/projects/${encodeURIComponent('DESC:6810%20A')}`)
    expect(await res.json()).toEqual({ id: 'DESC:6810%20A' })
  })
})

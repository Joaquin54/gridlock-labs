import type { NewPoint, NewProjectPoint } from '../db/schema'

const CONFIDENCE_RANK: Record<string, number> = { verified: 4, high: 3, medium: 2, low: 1 }

/**
 * `points.id` — the coordinate itself, formatted from the parsed numbers so it is
 * identical on every reload (`32.352120` and `32.35212` give the same key). NULL for
 * an unlocated row, which shares no location.
 */
export function pointId(lat: number | null | undefined, lon: number | null | undefined): string | null {
  return lat == null || lon == null ? null : `${lat},${lon}`
}

/**
 * Derives the `points` table from the join rows: one row per distinct coordinate.
 *
 * Grouping is by exact coordinate and never by name — the data holds four names that
 * appear at two different places each. Within a group the strongest confidence wins
 * and carries its own provenance, and the printed name is the most common one. Every
 * tie breaks on (projectId, seq), so the result does not depend on input order.
 */
export function buildPoints(rows: NewProjectPoint[]): NewPoint[] {
  const groups = new Map<string, NewProjectPoint[]>()
  for (const row of rows) {
    const id = pointId(row.lat, row.lon)
    if (id === null) continue
    const list = groups.get(id)
    if (list) list.push(row)
    else groups.set(id, [row])
  }

  const built: NewPoint[] = []
  for (const [id, group] of groups) {
    const ordered = [...group].sort(
      (a, b) => a.projectId.localeCompare(b.projectId) || a.seq - b.seq,
    )
    const best = ordered.reduce((winner, row) =>
      (CONFIDENCE_RANK[row.confidence ?? ''] ?? 0) > (CONFIDENCE_RANK[winner.confidence ?? ''] ?? 0)
        ? row
        : winner,
    )
    const counts = new Map<string, number>()
    for (const row of ordered) counts.set(row.name, (counts.get(row.name) ?? 0) + 1)
    let name = ordered[0].name
    for (const row of ordered) {
      if ((counts.get(row.name) ?? 0) > (counts.get(name) ?? 0)) name = row.name
    }
    built.push({
      id,
      lat: ordered[0].lat as number,
      lon: ordered[0].lon as number,
      name,
      aliases: [...new Set(ordered.map((row) => row.name))].sort(),
      confidence: best.confidence as NewPoint['confidence'],
      method: best.method ?? null,
      matchName: best.matchName ?? null,
      osmUrl: best.osmUrl ?? null,
      sourceUrl: best.sourceUrl ?? null,
      verifiedBy: best.verifiedBy ?? null,
      note: best.note ?? null,
    })
  }
  return built.sort((a, b) => a.id.localeCompare(b.id))
}

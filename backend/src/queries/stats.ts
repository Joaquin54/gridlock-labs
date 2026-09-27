import { sql } from 'drizzle-orm'
import { type Database, query } from '../db/client'
import type { Confidence, Utility } from '../db/schema'
import { clampConfidence, type WireConfidence } from '../lib/confidence'
import { findOverlaps } from './overlaps'

type UtilityCounts = Record<Utility, number>
type ConfidenceCounts = Record<WireConfidence, number>

export type Stats = {
  projects: UtilityCounts
  located: UtilityCounts
  unlocated: UtilityCounts
  confidence: ConfidenceCounts
  overlaps: ConfidenceCounts & { total: number }
}

type StatsRow = {
  utility: Utility
  points_located: number
  location_confidence: Confidence
}

const zeroUtilities = (): UtilityCounts => ({ DESC: 0, GPC: 0 })
const zeroConfidence = (): ConfidenceCounts => ({ high: 0, medium: 0, low: 0 })

export async function getStats(db: Database): Promise<Stats> {
  const rows = await query<StatsRow>(
    db,
    sql`
      select p.utility, g.points_located, g.location_confidence
      from projects p
      join project_geo g on g.project_id = p.id
    `,
  )

  const stats: Stats = {
    projects: zeroUtilities(),
    located: zeroUtilities(),
    unlocated: zeroUtilities(),
    confidence: zeroConfidence(),
    overlaps: { total: 0, ...zeroConfidence() },
  }

  for (const row of rows) {
    stats.projects[row.utility] += 1
    if (row.points_located > 0) {
      stats.located[row.utility] += 1
      // Located projects only: an unlocated one has no confidence to report.
      stats.confidence[clampConfidence(row.location_confidence)] += 1
    } else {
      stats.unlocated[row.utility] += 1
    }
  }

  const overlaps = await findOverlaps(db)
  stats.overlaps.total = overlaps.length
  for (const overlap of overlaps) stats.overlaps[overlap.pair_confidence] += 1

  return stats
}

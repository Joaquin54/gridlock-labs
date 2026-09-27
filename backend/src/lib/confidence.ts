import type { Confidence } from '../db/schema'

/**
 * Confidence as it appears on the wire. The schema still carries a `verified`
 * level from the dropped verification layer; the API never exposes it, so every
 * value leaving a route goes through `clampConfidence` and lands on high.
 */
export const WIRE_CONFIDENCES = ['high', 'medium', 'low'] as const
export type WireConfidence = (typeof WIRE_CONFIDENCES)[number]

/** What a manual PATCH writes to project_points.confidence. */
export const MANUAL_CONFIDENCE: Confidence = 'high'

export const CONFIDENCE_RANK: Record<WireConfidence, number> = { high: 3, medium: 2, low: 1 }

export function clampConfidence(value: string): WireConfidence {
  if (value === 'medium' || value === 'low') return value
  // 'high' and the legacy 'verified' both surface as high.
  return 'high'
}

export function confidenceRank(value: string): number {
  return CONFIDENCE_RANK[clampConfidence(value)]
}

/** Lower of two confidences — the pair's confidence. */
export function lowerConfidence(a: string, b: string): WireConfidence {
  return confidenceRank(a) <= confidenceRank(b) ? clampConfidence(a) : clampConfidence(b)
}

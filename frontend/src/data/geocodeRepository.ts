import type {
  GeocodeConfidence,
  GeocodeTask,
  ReviewQueuePoint,
} from "../types/geocode";
import queueSeed from "./review-queue.json";

const points: ReviewQueuePoint[] = queueSeed.points as ReviewQueuePoint[];

const TASK_ORDER: GeocodeTask[] = ["FIND", "CHECK", "VERIFY", "CONFIRM"];
const CONFIDENCE_ORDER: GeocodeConfidence[] = ["unlocated", "low", "medium", "high"];

export function getAllReviewQueuePoints(): ReviewQueuePoint[] {
  return points;
}

export function getMappableReviewPoints(): ReviewQueuePoint[] {
  return points.filter(
    (p) => p.lat != null && p.lon != null && !Number.isNaN(p.lat) && !Number.isNaN(p.lon),
  );
}

export type GeocodeDashboardSummary = {
  totalPoints: number;
  uniqueProjects: number;
  withCoordinates: number;
  locatedPct: number;
  findRemaining: number;
  highConfidence: number;
  byTask: Record<GeocodeTask, number>;
  byConfidence: Record<GeocodeConfidence, number>;
  byRegion: Array<{ region: string; count: number }>;
};

export function getGeocodeDashboardSummary(): GeocodeDashboardSummary {
  const byTask = Object.fromEntries(TASK_ORDER.map((t) => [t, 0])) as Record<
    GeocodeTask,
    number
  >;
  const byConfidence = Object.fromEntries(
    CONFIDENCE_ORDER.map((c) => [c, 0]),
  ) as Record<GeocodeConfidence, number>;
  const regionCounts = new Map<string, number>();

  for (const p of points) {
    byTask[p.task] += 1;
    byConfidence[p.confidence] += 1;
    regionCounts.set(p.region, (regionCounts.get(p.region) ?? 0) + 1);
  }

  const withCoordinates = getMappableReviewPoints().length;
  const uniqueProjects = new Set(
    points.map((p) => `${p.utility}:${p.projectKey}:${p.projectName}`),
  ).size;

  return {
    totalPoints: points.length,
    uniqueProjects,
    withCoordinates,
    locatedPct: points.length ? (100 * withCoordinates) / points.length : 0,
    findRemaining: byTask.FIND,
    highConfidence: byConfidence.high,
    byTask,
    byConfidence,
    byRegion: [...regionCounts.entries()]
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function getReviewQueueChartData() {
  const summary = getGeocodeDashboardSummary();
  return {
    taskData: TASK_ORDER.map((task) => ({
      task,
      count: summary.byTask[task],
    })),
    confidenceData: CONFIDENCE_ORDER.filter((c) => c !== "unlocated").map((confidence) => ({
      confidence,
      count: summary.byConfidence[confidence],
      unlocated: summary.byConfidence.unlocated,
    })),
    confidenceBars: CONFIDENCE_ORDER.map((confidence) => ({
      name:
        confidence === "unlocated"
          ? "Unlocated"
          : confidence.charAt(0).toUpperCase() + confidence.slice(1),
      count: summary.byConfidence[confidence],
      fill:
        confidence === "high"
          ? "var(--green)"
          : confidence === "medium"
            ? "var(--accent)"
            : confidence === "low"
              ? "var(--dominion)"
              : "var(--text-muted)",
    })),
    regionData: summary.byRegion.slice(0, 6).map((r) => ({
      region: r.region,
      count: r.count,
    })),
  };
}

/** Priority queue for dashboard table: FIND first, then low confidence. */
export function getReviewQueuePrioritySample(limit = 12): ReviewQueuePoint[] {
  const rank = (p: ReviewQueuePoint): number => {
    const taskRank = TASK_ORDER.indexOf(p.task);
    const confRank = CONFIDENCE_ORDER.indexOf(p.confidence);
    return taskRank * 10 + confRank;
  };
  return [...points].sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}

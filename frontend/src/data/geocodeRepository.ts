import {
  type GeocodeConfidence,
  type GeocodeTask,
  type ReviewQueuePoint,
  regionLabel,
  utilityKeyFromQueueCode,
} from "../types/geocode";
import type { SearchFilters } from "../types/project";
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
  const byTask = Object.fromEntries(TASK_ORDER.map((t) => [t, 0])) as Record<GeocodeTask, number>;
  const byConfidence = Object.fromEntries(CONFIDENCE_ORDER.map((c) => [c, 0])) as Record<
    GeocodeConfidence,
    number
  >;
  const regionCounts = new Map<string, number>();

  for (const p of points) {
    byTask[p.task] += 1;
    byConfidence[p.confidence] += 1;
    regionCounts.set(p.region, (regionCounts.get(p.region) ?? 0) + 1);
  }

  const withCoordinates = getMappableReviewPoints().length;
  const uniqueProjects = new Set(points.map((p) => `${p.utility}:${p.projectKey}:${p.projectName}`))
    .size;

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

function stateForQueueUtility(utility: string): "GA" | "SC" {
  return utility === "DESC" ? "SC" : "GA";
}

/** Filter review-queue location points for search (full portfolio footprint). */
export function searchReviewQueuePoints(filters: SearchFilters): ReviewQueuePoint[] {
  const q = filters.query.trim().toLowerCase();
  if (filters.overlapsOnly) return [];

  return points.filter((p) => {
    const utilityKey = utilityKeyFromQueueCode(p.utility);
    if (filters.utility && utilityKey !== filters.utility) return false;
    if (filters.state && stateForQueueUtility(p.utility) !== filters.state) return false;
    if (!q) return true;
    const haystack = [
      p.id,
      p.projectKey,
      p.projectName,
      p.pointName,
      p.region,
      regionLabel(p.region),
      p.description,
      p.task,
      p.confidence,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

/* ------------------------------------------------------------------ */
/*  Portfolio analytics — mined from project names & descriptions     */
/* ------------------------------------------------------------------ */

export type VoltageClass = "500 kV" | "230 kV" | "115 kV" | "46 kV" | "Other";

const VOLTAGE_RE = /(\d+)\s*[kK][vV]/g;

function classifyVoltage(kv: number): VoltageClass {
  if (kv >= 500) return "500 kV";
  if (kv >= 230) return "230 kV";
  if (kv >= 115) return "115 kV";
  if (kv >= 46) return "46 kV";
  return "Other";
}

export function getVoltageBreakdown(): Array<{ name: VoltageClass; count: number; fill: string }> {
  const counts = new Map<VoltageClass, number>();
  for (const p of points) {
    const matches = p.projectName.matchAll(VOLTAGE_RE);
    const seen = new Set<VoltageClass>();
    for (const m of matches) {
      const cls = classifyVoltage(Number(m[1]));
      seen.add(cls);
    }
    for (const cls of seen) {
      counts.set(cls, (counts.get(cls) ?? 0) + 1);
    }
  }
  const fills: Record<VoltageClass, string> = {
    "500 kV": "var(--dominion)",
    "230 kV": "var(--accent)",
    "115 kV": "var(--georgia)",
    "46 kV": "var(--green)",
    Other: "var(--text-muted)",
  };
  const order: VoltageClass[] = ["500 kV", "230 kV", "115 kV", "46 kV", "Other"];
  return order
    .filter((cls) => (counts.get(cls) ?? 0) > 0)
    .map((cls) => ({ name: cls, count: counts.get(cls) ?? 0, fill: fills[cls] }));
}

export type WorkType =
  | "Rebuild"
  | "Construct / New"
  | "Replace"
  | "Reconductor"
  | "Install"
  | "Other";

export function getWorkTypeBreakdown(): Array<{ name: WorkType; count: number }> {
  const counts: Record<WorkType, number> = {
    Rebuild: 0,
    "Construct / New": 0,
    Replace: 0,
    Reconductor: 0,
    Install: 0,
    Other: 0,
  };
  const seenProjects = new Set<string>();
  for (const p of points) {
    if (seenProjects.has(p.projectKey)) continue;
    seenProjects.add(p.projectKey);
    const text = `${p.projectName} ${p.description ?? ""}`.toUpperCase();
    if (text.includes("REBUILD")) counts.Rebuild++;
    else if (text.includes("CONSTRUCT") || text.includes("NEW ")) counts["Construct / New"]++;
    else if (text.includes("RECONDUCTOR")) counts.Reconductor++;
    else if (text.includes("INSTALL")) counts.Install++;
    else if (text.includes("REPLACE")) counts.Replace++;
    else counts.Other++;
  }
  return (Object.entries(counts) as [WorkType, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

export function getBorderBreakdown(): Array<{ name: string; value: number; fill: string }> {
  let border = 0;
  let interior = 0;
  const seenProjects = new Set<string>();
  for (const p of points) {
    if (seenProjects.has(p.projectKey)) continue;
    seenProjects.add(p.projectKey);
    if (p.isBorder) border++;
    else interior++;
  }
  return [
    { name: "Cross-state border", value: border, fill: "var(--dominion)" },
    { name: "Interior", value: interior, fill: "var(--georgia)" },
  ];
}

export function getLineMilesBuckets(): Array<{ bucket: string; count: number }> {
  const buckets = [
    { label: "< 1 mi", min: 0, max: 1 },
    { label: "1–5 mi", min: 1, max: 5 },
    { label: "5–10 mi", min: 5, max: 10 },
    { label: "10–20 mi", min: 10, max: 20 },
    { label: "20–50 mi", min: 20, max: 50 },
    { label: "50+ mi", min: 50, max: Infinity },
  ];
  const counts = buckets.map(() => 0);
  for (const p of points) {
    if (p.miles == null || p.miles <= 0) continue;
    const idx = buckets.findIndex((b) => {
      const m = p.miles as number;
      return m >= b.min && m < b.max;
    });
    if (idx >= 0) counts[idx]++;
  }
  return buckets.map((b, i) => ({ bucket: b.label, count: counts[i] }));
}

export function getUniqueProjectCountsByUtility(): { gpc: number; desc: number } {
  const seen = new Set<string>();
  let gpc = 0;
  let desc = 0;
  for (const p of points) {
    const key = `${p.utility}:${p.projectKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (p.utility === "GPC") gpc++;
    else if (p.utility === "DESC") desc++;
  }
  return { gpc, desc };
}

export function getUtilitySplit(): Array<{ name: string; value: number; fill: string }> {
  const gpc = points.filter((p) => p.utility === "GPC").length;
  const desc = points.filter((p) => p.utility === "DESC").length;
  return [
    { name: "Georgia Power", value: gpc, fill: "var(--georgia)" },
    { name: "Dominion (SC)", value: desc, fill: "var(--dominion)" },
  ];
}

export function getRegionByUtility(): Array<{
  region: string;
  gpc: number;
  desc: number;
}> {
  const map = new Map<string, { gpc: number; desc: number }>();
  for (const p of points) {
    const entry = map.get(p.region) ?? { gpc: 0, desc: 0 };
    if (p.utility === "GPC") entry.gpc++;
    else entry.desc++;
    map.set(p.region, entry);
  }
  return [...map.entries()]
    .map(([region, counts]) => ({ region, ...counts }))
    .sort((a, b) => b.gpc + b.desc - (a.gpc + a.desc));
}

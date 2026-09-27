import {
  type GeocodeConfidence,
  type GeocodeTask,
  type ReviewQueuePoint,
  regionLabel,
  utilityKeyFromQueueCode,
} from "../types/geocode";
import { getQueuePointCountyFips } from "./countyIndex";
import type { GridlockProject, SearchFilters, WorkType } from "../types/project";

const TASK_ORDER: GeocodeTask[] = ["FIND", "CHECK", "VERIFY", "CONFIRM"];
const CONFIDENCE_ORDER: GeocodeConfidence[] = ["unlocated", "low", "medium", "high"];

export function getMappableReviewPoints(points: ReviewQueuePoint[]): ReviewQueuePoint[] {
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

export function getGeocodeDashboardSummary(points: ReviewQueuePoint[]): GeocodeDashboardSummary {
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

  const withCoordinates = getMappableReviewPoints(points).length;
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

export function getReviewQueueChartData(points: ReviewQueuePoint[]) {
  const summary = getGeocodeDashboardSummary(points);
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
          ? "var(--map-marker-high)"
          : confidence === "medium"
            ? "var(--map-marker-medium)"
            : confidence === "low"
              ? "var(--map-marker-low)"
              : "var(--text-muted)",
    })),
    regionData: summary.byRegion.slice(0, 6).map((r) => ({
      region: r.region,
      count: r.count,
    })),
  };
}

export function getReviewQueuePrioritySample(
  points: ReviewQueuePoint[],
  limit = 12,
): ReviewQueuePoint[] {
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

export function queuePointProjectId(point: ReviewQueuePoint): string {
  const lastColon = point.id.lastIndexOf(":");
  return lastColon > 0 ? point.id.slice(0, lastColon) : point.id;
}

export function queuePointsByProjectId(
  points: ReviewQueuePoint[],
): Map<string, ReviewQueuePoint[]> {
  const map = new Map<string, ReviewQueuePoint[]>();
  for (const point of points) {
    const projectId = queuePointProjectId(point);
    const list = map.get(projectId);
    if (list) list.push(point);
    else map.set(projectId, [point]);
  }
  return map;
}

export function queuePointSearchHaystack(point: ReviewQueuePoint): string {
  return [
    point.pointName,
    point.projectName,
    point.region,
    regionLabel(point.region),
    point.description,
    point.task,
    point.confidence,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function searchReviewQueuePoints(
  points: ReviewQueuePoint[],
  filters: SearchFilters,
): ReviewQueuePoint[] {
  const q = filters.query.trim().toLowerCase();
  if (filters.overlapsOnly) return [];

  return points.filter((p) => {
    const utilityKey = utilityKeyFromQueueCode(p.utility);
    if (filters.utility && utilityKey !== filters.utility) return false;
    if (filters.state && stateForQueueUtility(p.utility) !== filters.state) return false;
    if (filters.workType && classifyWorkType(p.projectName, p.description) !== filters.workType) {
      return false;
    }
    if (filters.county && getQueuePointCountyFips(p.id) !== filters.county) return false;
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

export type VoltageClass = "500 kV" | "230 kV" | "115 kV" | "46 kV" | "Other";

export const VOLTAGE_CLASS_DISPLAY_ORDER: readonly VoltageClass[] = [
  "115 kV",
  "230 kV",
  "500 kV",
  "46 kV",
  "Other",
];

export function voltageClassLegendSortKey(name: string): number {
  const idx = VOLTAGE_CLASS_DISPLAY_ORDER.indexOf(name as VoltageClass);
  return idx === -1 ? VOLTAGE_CLASS_DISPLAY_ORDER.length : idx;
}

function classifyVoltage(kv: number): VoltageClass {
  if (kv >= 500) return "500 kV";
  if (kv >= 230) return "230 kV";
  if (kv >= 115) return "115 kV";
  if (kv >= 46) return "46 kV";
  return "Other";
}

export function getVoltageBreakdown(
  projects: GridlockProject[],
): Array<{ name: VoltageClass; count: number; fill: string; sliceValue?: number }> {
  const counts = new Map<VoltageClass, number>();
  for (const p of projects) {
    if (p.voltageKv == null) continue;
    const cls = classifyVoltage(p.voltageKv);
    counts.set(cls, (counts.get(cls) ?? 0) + 1);
  }
  const fills: Record<VoltageClass, string> = {
    "500 kV": "var(--voltage-500)",
    "230 kV": "var(--voltage-230)",
    "115 kV": "var(--voltage-115)",
    "46 kV": "var(--voltage-46)",
    Other: "var(--voltage-other)",
  };
  const order: VoltageClass[] = [...VOLTAGE_CLASS_DISPLAY_ORDER];
  const rows = order
    .filter((cls) => (counts.get(cls) ?? 0) > 0)
    .map((cls) => ({ name: cls, count: counts.get(cls) ?? 0, fill: fills[cls] }));

  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const otherRow = rows.find((row) => row.name === "Other");
  const minOtherShare = 0.015;
  if (!otherRow || total === 0 || otherRow.count / total >= minOtherShare) {
    return rows.map((row) => ({ ...row, sliceValue: row.count }));
  }

  const minOtherSlice = total * minOtherShare;
  const shrink = minOtherSlice - otherRow.count;
  const withoutOther = total - otherRow.count;
  return rows.map((row) => {
    if (row.name === "Other") {
      return { ...row, sliceValue: minOtherSlice };
    }
    const scaled = row.count - (row.count / withoutOther) * shrink;
    return { ...row, sliceValue: scaled };
  });
}

export const WORK_TYPE_FILTER_OPTIONS: readonly WorkType[] = [
  "rebuild",
  "construct/new",
  "replace",
  "reconductor",
  "install",
];

const LEGACY_WORK_TYPE_PARAM: Record<string, WorkType> = {
  Rebuild: "rebuild",
  "Construct / New": "construct/new",
  Replace: "replace",
  Reconductor: "reconductor",
  Install: "install",
};

export function normalizeWorkTypeParam(raw: string | null): "" | WorkType {
  if (!raw) return "";
  if (raw === "other" || raw === "Other") return "";
  if (WORK_TYPE_FILTER_OPTIONS.includes(raw as WorkType)) return raw as WorkType;
  return LEGACY_WORK_TYPE_PARAM[raw] ?? "";
}

export function classifyWorkType(
  projectName: string,
  description?: string | null,
): WorkType | null {
  const text = `${projectName} ${description ?? ""}`.toUpperCase();
  if (text.includes("REBUILD")) return "rebuild";
  if (text.includes("CONSTRUCT") || text.includes("NEW ")) return "construct/new";
  if (text.includes("RECONDUCTOR")) return "reconductor";
  if (text.includes("INSTALL")) return "install";
  if (text.includes("REPLACE")) return "replace";
  return null;
}

/** Prefer name/description keywords; fall back to coarse API work_type when text is ambiguous. */
export function workTypeForProject(p: GridlockProject): WorkType | null {
  const fromText = classifyWorkType(p.name, p.description);
  if (fromText) return fromText;
  if (p.workTypeRaw === "rebuild") return "rebuild";
  if (p.workTypeRaw === "new_build") return "construct/new";
  if (p.workTypeRaw === "station_equipment") return "install";
  return null;
}

export function getWorkTypeBreakdown(
  projects: GridlockProject[],
): Array<{ name: WorkType; gpc: number; desc: number }> {
  const counts: Record<WorkType, { gpc: number; desc: number }> = {
    rebuild: { gpc: 0, desc: 0 },
    "construct/new": { gpc: 0, desc: 0 },
    replace: { gpc: 0, desc: 0 },
    reconductor: { gpc: 0, desc: 0 },
    install: { gpc: 0, desc: 0 },
  };
  for (const p of projects) {
    const wt = workTypeForProject(p);
    if (!wt) continue;
    if (p.utilityKey === "georgia-power") counts[wt].gpc += 1;
    else counts[wt].desc += 1;
  }
  return WORK_TYPE_FILTER_OPTIONS.map((name) => ({
    name,
    gpc: counts[name].gpc,
    desc: counts[name].desc,
  }));
}

export function getBorderBreakdown(
  projects: GridlockProject[],
): Array<{ name: string; value: number; fill: string }> {
  let border = 0;
  let interior = 0;
  for (const p of projects) {
    if (p.isBorder || p.zone?.toLowerCase().includes("border")) border++;
    else interior++;
  }
  return [
    { name: "Cross-state border", value: border, fill: "var(--chart-accent)" },
    { name: "Interior", value: interior, fill: "var(--green)" },
  ];
}

export function getLineMilesBuckets(
  projects: GridlockProject[],
): Array<{ bucket: string; count: number }> {
  const buckets = [
    { label: "< 1 mi", min: 0, max: 1 },
    { label: "1–5 mi", min: 1, max: 5 },
    { label: "5–10 mi", min: 5, max: 10 },
    { label: "10–20 mi", min: 10, max: 20 },
    { label: "20–50 mi", min: 20, max: 50 },
    { label: "50+ mi", min: 50, max: Infinity },
  ];
  const counts = buckets.map(() => 0);
  for (const p of projects) {
    const miles = p.lineMiles;
    if (miles == null || miles <= 0) continue;
    const idx = buckets.findIndex((b) => miles >= b.min && miles < b.max);
    if (idx >= 0) counts[idx]++;
  }
  return buckets.map((b, i) => ({ bucket: b.label, count: counts[i] }));
}

export function getUniqueProjectCountsByUtility(
  projects: GridlockProject[],
): { gpc: number; desc: number } {
  let gpc = 0;
  let desc = 0;
  for (const p of projects) {
    if (p.utilityKey === "georgia-power") gpc++;
    else desc++;
  }
  return { gpc, desc };
}

export function getUtilitySplit(
  points: ReviewQueuePoint[],
): Array<{ name: string; value: number; fill: string }> {
  const gpc = points.filter((p) => p.utility === "GPC").length;
  const desc = points.filter((p) => p.utility === "DESC").length;
  return [
    { name: "Georgia Power", value: gpc, fill: "var(--map-utility-georgia)" },
    { name: "Dominion (SC)", value: desc, fill: "var(--map-utility-dominion)" },
  ];
}

export function getRegionByUtility(
  points: ReviewQueuePoint[],
): Array<{
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

import type { ApiOverlap, ApiProjectFeature, ApiProjectPoint, ApiUtility } from "../api/types";
import type { GeocodeConfidence, GeocodeTask, ReviewQueuePoint } from "../types/geocode";
import type {
  GridlockProject,
  ProjectEndpoint,
  ProjectLocationPoint,
  ProjectOverlap,
  UtilityKey,
} from "../types/project";

export function utilityKeyFromApi(utility: ApiUtility): UtilityKey {
  return utility === "DESC" ? "dominion" : "georgia-power";
}

export function stateFromUtility(utility: ApiUtility): "GA" | "SC" {
  return utility === "DESC" ? "SC" : "GA";
}

function endpointFromPoint(point: ApiProjectPoint | undefined): ProjectEndpoint {
  if (!point) return { label: null, lat: null, lon: null };
  return { label: point.name, lat: point.lat, lon: point.lon };
}

function centerFromProperties(
  center: [number, number] | null,
): { lat: number | null; lon: number | null } {
  if (!center) return { lat: null, lon: null };
  const [lon, lat] = center;
  return { lat, lon };
}

function pointConfidence(point: ApiProjectPoint): GeocodeConfidence {
  if (point.lat == null || point.lon == null) return "unlocated";
  return point.confidence;
}

function pointTask(point: ApiProjectPoint): GeocodeTask {
  if (point.lat == null || point.lon == null) return "FIND";
  if (point.method === "manual") return "CONFIRM";
  if (point.confidence === "low") return "CHECK";
  return "VERIFY";
}

function zoneToRegion(zone: string | null, utility: ApiUtility): string {
  if (!zone?.trim()) return utility === "DESC" ? "sc" : "unknown";
  const z = zone.toLowerCase();
  if (z.includes("savannah") || z.includes("coast")) return "savannah_coast";
  if (z.includes("augusta") || z.includes("east")) return "augusta_east";
  if (z.includes("atlanta") || z.includes("metro")) return "atlanta_metro";
  if (z.includes("south carolina") || z === "sc") return "sc";
  if (z.includes("georgia") || z.includes("ga")) return "rest_of_ga";
  return "unknown";
}

function googleMapsSearchUrl(name: string, lat: number | null, lon: number | null): string | null {
  if (lat != null && lon != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }
  const q = encodeURIComponent(name);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function reviewQueuePointFromProject(
  feature: ApiProjectFeature,
  point: ApiProjectPoint,
): ReviewQueuePoint {
  const props = feature.properties;
  return {
    id: `${props.id}:${point.seq}`,
    utility: props.utility,
    projectId: props.id,
    projectKey: props.project_key,
    projectName: props.name,
    point: point.seq,
    pointName: point.name,
    lat: point.lat,
    lon: point.lon,
    method: point.method,
    confidence: pointConfidence(point),
    task: pointTask(point),
    region: zoneToRegion(props.zone, props.utility),
    miles: props.line_miles,
    isBorder: props.is_border,
    googleMapsUrl: googleMapsSearchUrl(point.name, point.lat, point.lon),
    osmUrl: point.source_url,
    description: props.description ?? "",
  };
}

export function reviewQueuePointsFromFeatures(features: ApiProjectFeature[]): ReviewQueuePoint[] {
  const out: ReviewQueuePoint[] = [];
  for (const feature of features) {
    for (const point of feature.properties.points) {
      out.push(reviewQueuePointFromProject(feature, point));
    }
  }
  return out;
}

export function overlapPartnerIds(
  projectId: string,
  overlaps: ApiOverlap[],
): string[] {
  const ids = new Set<string>();
  for (const o of overlaps) {
    if (o.desc_id === projectId) ids.add(o.gpc_id);
    if (o.gpc_id === projectId) ids.add(o.desc_id);
  }
  return [...ids];
}

export function projectFromFeature(
  feature: ApiProjectFeature,
  overlaps: ApiOverlap[],
): GridlockProject {
  const props = feature.properties;
  const points = [...props.points].sort((a, b) => a.seq - b.seq);
  const endpointA = endpointFromPoint(points[0]);
  const endpointB = endpointFromPoint(points[1] ?? points[0]);
  const partnerIds = overlapPartnerIds(props.id, overlaps);
  const locationPoints: ProjectLocationPoint[] = points.map((point) => ({
    seq: point.seq,
    name: point.name,
    lat: point.lat,
    lon: point.lon,
    method: point.method,
    confidence: point.confidence,
    matchName: point.match_name,
    matchScore: point.match_score,
    sourceUrl: point.source_url,
  }));

  return {
    id: props.id,
    projectKey: props.project_key,
    utility: props.utility === "DESC" ? "Dominion Energy SC" : "Georgia Power",
    utilityKey: utilityKeyFromApi(props.utility),
    state: stateFromUtility(props.utility),
    name: props.name,
    owner: props.owner,
    ownerInScope: props.owner_in_scope,
    endpointA,
    endpointB,
    center: centerFromProperties(props.center),
    startDate: props.start_date,
    startDateSource: props.start_date_source,
    inServiceDate: props.in_service_date,
    inServiceRaw: props.in_service_raw,
    overlapCount: partnerIds.length,
    overlapProjectIds: partnerIds,
    description: props.description,
    projectType: props.project_type,
    voltageKv: props.voltage_kv,
    lineMiles: props.line_miles,
    milesSource: props.miles_source,
    costUsd: props.cost_usd,
    costLow: props.cost_low,
    costHigh: props.cost_high,
    sourceDoc: props.source_doc,
    sourcePage: props.source_page,
    zone: props.zone,
    isBorder: props.is_border,
    status: props.status,
    workTypeRaw: props.work_type,
    located: props.located,
    locationConfidence: props.location_confidence,
    pointsLocated: props.points_located,
    pointsTotal: props.points_total,
    points: locationPoints,
  };
}

export function projectsFromFeatures(
  features: ApiProjectFeature[],
  overlaps: ApiOverlap[],
): GridlockProject[] {
  return features.map((f) => projectFromFeature(f, overlaps));
}

export function overlapFromApi(o: ApiOverlap, index: number): ProjectOverlap {
  return {
    id: `${o.desc_id}::${o.gpc_id}::${index}`,
    distanceMi: o.distance_mi,
    timeGapDays: o.window_gap_days ?? o.in_service_gap_days,
    inServiceGapDays: o.in_service_gap_days,
    windowGapDays: o.window_gap_days,
    utilityA: "Dominion Energy SC",
    projectIdA: o.desc_id,
    projectNameA: o.desc_name,
    utilityB: "Georgia Power",
    projectIdB: o.gpc_id,
    projectNameB: o.gpc_name,
    pairConfidence: o.pair_confidence,
    borderline: o.borderline,
    sharedAssets: o.shared_assets,
  };
}

export function overlapsFromApi(rows: ApiOverlap[]): ProjectOverlap[] {
  return rows.map((o, index) => overlapFromApi(o, index));
}

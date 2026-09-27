import { Line } from "react-simple-maps";
import type { VoltageClass } from "../../data/geocodeRepository";
import { VOLTAGE_COLORS, voltageClassForProjectName } from "../../data/geocodeRepository";
import type { GeocodeConfidence, ReviewQueuePoint } from "../../types/geocode";

/**
 * Corridor layer. Mirrors the backend buildGeometry rule: a project's located
 * points, in `point` order, are its path. A project with one located point has
 * no path to draw and keeps its marker instead.
 */

/** Heavier stroke for higher voltage, the way a utility one-line reads. */
const VOLTAGE_STROKE_WIDTH: Record<VoltageClass, number> = {
  "500 kV": 3.2,
  "230 kV": 2.4,
  "115 kV": 1.7,
  "46 kV": 1.2,
  Other: 1.2,
};

const CONFIDENCE_RANK: Record<GeocodeConfidence, number> = {
  unlocated: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/** A corridor built on weak geocodes must not read as a surveyed route. */
export const APPROXIMATE_DASH = "3 2.5";
const APPROXIMATE_MAX_RANK = CONFIDENCE_RANK.low;

/** Hovering a point dims every corridor except the one that point belongs to. */
const CORRIDOR_OPACITY = 0.85;
const CORRIDOR_OPACITY_FOCUSED = 1;
const CORRIDOR_OPACITY_DIMMED = 0.2;
const CORRIDOR_FOCUS_SCALE = 1.9;

export type ProjectCorridor = {
  id: string;
  projectName: string;
  coordinates: Array<[number, number]>;
  voltage: VoltageClass;
  /** Weakest geocode on the corridor — decides solid vs dashed. */
  confidence: GeocodeConfidence;
  /** True when `confidence` is too weak to draw the path as a firm route. */
  approximate: boolean;
  pointIds: string[];
  /** First and last point names, for naming the corridor in the detail card. */
  endpointNames: [string, string];
};

function isLocated(p: ReviewQueuePoint): boolean {
  return p.lat != null && p.lon != null && !Number.isNaN(p.lat) && !Number.isNaN(p.lon);
}

export function buildCorridors(points: ReviewQueuePoint[]): ProjectCorridor[] {
  const groups = new Map<string, ReviewQueuePoint[]>();
  for (const p of points) {
    if (!isLocated(p)) continue;
    const key = `${p.utility}|${p.projectKey}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }

  const corridors: ProjectCorridor[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((a, b) => a.point - b.point);
    const weakest = ordered.reduce<GeocodeConfidence>(
      (low, p) => (CONFIDENCE_RANK[p.confidence] < CONFIDENCE_RANK[low] ? p.confidence : low),
      "high",
    );
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    corridors.push({
      id: key,
      projectName: first.projectName,
      coordinates: ordered.map((p) => [p.lon as number, p.lat as number]),
      voltage: voltageClassForProjectName(first.projectName),
      confidence: weakest,
      approximate: CONFIDENCE_RANK[weakest] <= APPROXIMATE_MAX_RANK,
      pointIds: ordered.map((p) => p.id),
      endpointNames: [first.pointName, last.pointName],
    });
  }
  return corridors;
}

/** Point id -> the corridor it belongs to. Points on no corridor are absent. */
export function indexCorridorsByPoint(
  corridors: ProjectCorridor[],
): Map<string, ProjectCorridor> {
  const index = new Map<string, ProjectCorridor>();
  for (const corridor of corridors) {
    for (const pointId of corridor.pointIds) index.set(pointId, corridor);
  }
  return index;
}

type ProjectLineLayerProps = {
  corridors: ProjectCorridor[];
  /** Corridor carrying this point is emphasized; the rest dim. */
  focusedCorridorId?: string | null;
};

/**
 * Deliberately non-interactive: the markers keep every hover and click, so
 * drawing corridors underneath cannot regress the existing tooltip.
 */
export default function ProjectLineLayer({
  corridors,
  focusedCorridorId,
}: ProjectLineLayerProps) {
  return (
    <>
      {corridors.map((corridor) => {
        const focused = corridor.id === focusedCorridorId;
        const width = VOLTAGE_STROKE_WIDTH[corridor.voltage];
        const opacity = focusedCorridorId
          ? focused
            ? CORRIDOR_OPACITY_FOCUSED
            : CORRIDOR_OPACITY_DIMMED
          : CORRIDOR_OPACITY;
        return (
          <Line
            key={corridor.id}
            coordinates={corridor.coordinates}
            stroke={VOLTAGE_COLORS[corridor.voltage]}
            strokeWidth={focused ? width * CORRIDOR_FOCUS_SCALE : width}
            strokeDasharray={corridor.approximate ? APPROXIMATE_DASH : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={opacity}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none", transition: "opacity 0.15s ease" }}
          />
        );
      })}
    </>
  );
}

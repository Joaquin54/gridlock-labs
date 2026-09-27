import { Line, Marker } from "react-simple-maps";
import type { RankedOpportunity } from "../../data/repository";
import { utilityKeyFromName } from "../../data/repository";
import type { ReviewQueuePoint } from "../../types/geocode";

/**
 * The flagged cross-utility overlaps, drawn as numbered pairs.
 *
 * Every overlap in the dataset is Dominion x Georgia Power, so a pair belongs
 * to both utilities rather than either one. The connector is therefore drawn in
 * two halves, each utility colour on its own end, and the badge is split down
 * the middle in the same two colours.
 *
 * Only the top-ranked opportunities are drawn. Painting all 77 produced a mat
 * of faint lines that read as noise on top of the corridors; the ranked table
 * already carries the full list.
 */

/** How many ranked opportunities the map draws. */
export const MAPPED_OPPORTUNITY_LIMIT = 8;

const LINK_WIDTH = 2.4;
const LINK_WIDTH_FOCUSED = 3.6;
/** Connectors recede while a point is hovered. Badges never do. */
const LINK_DIMMED_OPACITY = 0.1;

/** Badge geometry in screen pixels; divided by zoom so it stays put. */
const BADGE_RADIUS = 9;
const BADGE_PLATE_RADIUS = 11.5;
const BADGE_FONT = 8.6;
const BADGE_RING_WIDTH = 1.6;
/** How much the badge grows under the cursor. */
const BADGE_HOVER_SCALE = 1.35;

const BADGE_MIN_SEPARATION_DEGREES = 0.19;
const BADGE_FAN_STEP_DEGREES = 0.19;
const BADGE_FAN_SPOKES = 8;
const BADGE_FAN_MAX_TRIES = 24;

function utilityColor(utility: string): string {
  return utilityKeyFromName(utility) === "dominion" ? "var(--dominion)" : "var(--georgia)";
}

export type OverlapLink = {
  id: string;
  rank: number;
  from: [number, number];
  to: [number, number];
  /** True geometric midpoint, where the connector changes colour. */
  lineMidpoint: [number, number];
  /** Badge position; nudged off the midpoint when badges would collide. */
  midpoint: [number, number];
  colorA: string;
  colorB: string;
  distanceMi: number | null;
  timeGapDays: number | null;
  projectIdA: string;
  projectIdB: string;
  projectNameA: string;
  projectNameB: string;
};

/** Mean of the located points of a project. Deliverable ids are utility_projectKey. */
function centroidsByProjectId(points: ReviewQueuePoint[]): Map<string, [number, number]> {
  const sums = new Map<string, { lon: number; lat: number; n: number }>();
  for (const p of points) {
    if (p.lat == null || p.lon == null || Number.isNaN(p.lat) || Number.isNaN(p.lon)) continue;
    const key = `${p.utility}_${p.projectKey}`;
    const acc = sums.get(key) ?? { lon: 0, lat: 0, n: 0 };
    acc.lon += p.lon;
    acc.lat += p.lat;
    acc.n += 1;
    sums.set(key, acc);
  }
  const out = new Map<string, [number, number]>();
  for (const [key, acc] of sums) out.set(key, [acc.lon / acc.n, acc.lat / acc.n]);
  return out;
}

/**
 * Several opportunities can share a project, which lands their badges on top of
 * each other. Badges are labels rather than data, so colliding ones fan out.
 * Greedy, so a badge pushed aside is itself checked against those already placed.
 */
function fanOutColliding(links: OverlapLink[]): OverlapLink[] {
  const placed: Array<[number, number]> = [];
  const clashes = (x: number, y: number): boolean =>
    placed.some(([px, py]) => Math.hypot(px - x, py - y) < BADGE_MIN_SEPARATION_DEGREES);

  for (const link of links) {
    const [originX, originY] = link.midpoint;
    let x = originX;
    let y = originY;
    for (let tries = 0; tries < BADGE_FAN_MAX_TRIES && clashes(x, y); tries += 1) {
      const angle = (2 * Math.PI * (tries % BADGE_FAN_SPOKES)) / BADGE_FAN_SPOKES;
      const radius = BADGE_FAN_STEP_DEGREES * (1 + Math.floor(tries / BADGE_FAN_SPOKES));
      x = originX + Math.cos(angle) * radius;
      y = originY + Math.sin(angle) * radius;
    }
    link.midpoint = [x, y];
    placed.push([x, y]);
  }
  return links;
}

export function buildOverlapLinks(
  opportunities: RankedOpportunity[],
  points: ReviewQueuePoint[],
  limit: number = MAPPED_OPPORTUNITY_LIMIT,
): OverlapLink[] {
  const centroids = centroidsByProjectId(points);
  const links: OverlapLink[] = [];
  for (const opportunity of opportunities) {
    if (links.length >= limit) break;
    const { overlap } = opportunity;
    const from = centroids.get(overlap.projectIdA);
    const to = centroids.get(overlap.projectIdB);
    if (!from || !to) continue;
    const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    links.push({
      id: overlap.id,
      rank: opportunity.rank,
      from,
      to,
      lineMidpoint: mid,
      midpoint: [mid[0], mid[1]],
      colorA: utilityColor(overlap.utilityA),
      colorB: utilityColor(overlap.utilityB),
      distanceMi: overlap.distanceMi,
      timeGapDays: overlap.timeGapDays,
      projectIdA: overlap.projectIdA,
      projectIdB: overlap.projectIdB,
      projectNameA: overlap.projectNameA,
      projectNameB: overlap.projectNameB,
    });
  }
  return fanOutColliding(links);
}

/**
 * Project id -> the ranked pairs it belongs to. A project can sit in several,
 * so the detail card lists them all rather than picking one.
 */
export function indexLinksByProject(links: OverlapLink[]): Map<string, OverlapLink[]> {
  const index = new Map<string, OverlapLink[]>();
  for (const link of links) {
    for (const id of [link.projectIdA, link.projectIdB]) {
      const bucket = index.get(id);
      if (bucket) bucket.push(link);
      else index.set(id, [link]);
    }
  }
  return index;
}

type OverlapBadgeLayerProps = {
  links: OverlapLink[];
  zoom: number;
  /** Project ids touched by the hovered point; their connectors stay lit. */
  focusedProjectIds?: ReadonlySet<string>;
  /** Pair whose badge is under the cursor. */
  hoveredPairId?: string | null;
  onHoverPair?: (pairId: string | null) => void;
};

/** The connectors need no zoom, their stroke is screen-space. */
type OverlapLinkLayerProps = Omit<OverlapBadgeLayerProps, "zoom">;

/**
 * Non-interactive: the markers own every pointer event so nothing here can
 * regress the existing tooltip.
 */
export default function OverlapLinkLayer({
  links,
  focusedProjectIds,
  hoveredPairId,
}: OverlapLinkLayerProps) {
  const focusing = Boolean(focusedProjectIds?.size);
  const hoveringBadge = Boolean(hoveredPairId);

  return (
    <>
      {links.map((link) => {
        const isHovered = link.id === hoveredPairId;
        const related =
          focusedProjectIds?.has(link.projectIdA) || focusedProjectIds?.has(link.projectIdB);
        // A hovered badge wins: its own pair lights, everything else recedes.
        const emphasised = isHovered || (!hoveringBadge && focusing && Boolean(related));
        const dimmed = hoveringBadge ? !isHovered : focusing && !related;
        const opacity = dimmed ? LINK_DIMMED_OPACITY : 1;
        const width = emphasised ? LINK_WIDTH_FOCUSED : LINK_WIDTH;
        const shared = {
          strokeWidth: width,
          strokeLinecap: "round" as const,
          fill: "none",
          opacity,
          vectorEffect: "non-scaling-stroke" as const,
          style: { pointerEvents: "none" as const, transition: "opacity 0.15s ease" },
        };
        return (
          <g key={link.id}>
            <Line from={link.from} to={link.lineMidpoint} stroke={link.colorA} {...shared} />
            <Line from={link.lineMidpoint} to={link.to} stroke={link.colorB} {...shared} />
          </g>
        );
      })}
    </>
  );
}

/**
 * The rank badges, rendered separately so the map can paint them above the
 * markers; under 656 dots a badge is invisible. They never dim, because they
 * are landmarks and a hover elsewhere should not hide them.
 */
export function OverlapBadgeLayer({
  links,
  zoom,
  hoveredPairId,
  onHoverPair,
}: OverlapBadgeLayerProps) {
  const scale = (value: number): number => value / zoom;

  return (
    <>
      {links.map((link) => {
        const r = scale(BADGE_RADIUS);
        const hovered = link.id === hoveredPairId;
        return (
          <Marker
            key={`${link.id}-badge`}
            coordinates={link.midpoint}
            onMouseEnter={() => onHoverPair?.(link.id)}
            onMouseLeave={() => onHoverPair?.(null)}
          >
            {/* Scaling the group pops every part at once and can be transitioned,
                which a radius baked into a path `d` cannot. */}
            <g
              transform={hovered ? `scale(${BADGE_HOVER_SCALE})` : "scale(1)"}
              style={{
                cursor: "default",
                transition: "transform 0.12s ease",
              }}
            >
              {/* Transparent hit area so the whole badge is easy to catch. */}
              <circle r={scale(BADGE_PLATE_RADIUS)} fill="transparent" />
              <circle r={scale(BADGE_PLATE_RADIUS)} fill="var(--surface)" opacity={0.85} />
              <path d={`M0,${-r} A${r},${r} 0 0,0 0,${r} Z`} fill={link.colorA} />
              <path d={`M0,${-r} A${r},${r} 0 0,1 0,${r} Z`} fill={link.colorB} />
              <circle
                r={r}
                fill="none"
                stroke="#ffffff"
                strokeWidth={hovered ? BADGE_RING_WIDTH * 1.5 : BADGE_RING_WIDTH}
                vectorEffect="non-scaling-stroke"
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={scale(BADGE_FONT)}
                fontWeight={700}
                fill="#ffffff"
                stroke="rgba(0,0,0,0.35)"
                strokeWidth={scale(0.5)}
                paintOrder="stroke"
                style={{ pointerEvents: "none" }}
              >
                {link.rank}
              </text>
            </g>
          </Marker>
        );
      })}
    </>
  );
}

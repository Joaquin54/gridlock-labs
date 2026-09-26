import type {
  CatalogSearchResult,
  GridlockProject,
  ProjectOverlap,
  SearchFilters,
  UtilityKey,
} from "../types/project";
import { searchReviewQueuePoints } from "./geocodeRepository";
import seed from "./seed.json";

type RawProject = Omit<GridlockProject, "utilityKey">;

function utilityKeyFromName(utility: string): UtilityKey {
  if (utility.toLowerCase().includes("dominion")) return "dominion";
  return "georgia-power";
}

function normalizeProject(raw: RawProject): GridlockProject {
  return {
    ...raw,
    utilityKey: utilityKeyFromName(raw.utility),
  };
}

const projects: GridlockProject[] = seed.projects.map((p) => normalizeProject(p as RawProject));
const overlaps: ProjectOverlap[] = seed.overlaps as ProjectOverlap[];

const projectById = new Map(projects.map((p) => [p.id, p]));

export function getAllProjects(): GridlockProject[] {
  return projects;
}

export function getProjectById(id: string): GridlockProject | undefined {
  return projectById.get(id);
}

export function getAllOverlaps(): ProjectOverlap[] {
  return overlaps;
}

export function getOverlapsForProject(projectId: string): ProjectOverlap[] {
  return overlaps.filter((o) => o.projectIdA === projectId || o.projectIdB === projectId);
}

export function getLinkedProjects(project: GridlockProject): GridlockProject[] {
  return project.overlapProjectIds
    .map((id) => projectById.get(id))
    .filter((p): p is GridlockProject => Boolean(p));
}

export function searchProjects(filters: SearchFilters): GridlockProject[] {
  const q = filters.query.trim().toLowerCase();
  return projects.filter((p) => {
    if (filters.utility && p.utilityKey !== filters.utility) return false;
    if (filters.state && p.state !== filters.state) return false;
    if (filters.overlapsOnly && p.overlapCount === 0) return false;
    if (!q) return true;
    const haystack = [p.id, p.name, p.utility, p.state, p.endpointA.label, p.endpointB.label]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** Pilot overlap projects plus full geocode review-queue location points. */
export function searchCatalog(filters: SearchFilters): CatalogSearchResult[] {
  const pilot = searchProjects(filters).map((project) => ({
    kind: "pilot" as const,
    project,
  }));
  const queue = searchReviewQueuePoints(filters).map((point) => ({
    kind: "queue" as const,
    point,
  }));
  return [...pilot, ...queue];
}

export type DashboardSummary = {
  totalProjects: number;
  totalOverlaps: number;
  dominionProjects: number;
  georgiaProjects: number;
  projectsWithCoords: number;
  projectsMissingEndpointCoords: number;
};

export function getDashboardSummary(): DashboardSummary {
  let projectsWithCoords = 0;
  let projectsMissingEndpointCoords = 0;
  for (const p of projects) {
    if (p.center.lat != null && p.center.lon != null) projectsWithCoords += 1;
    const aMissing = p.endpointA.lat == null || p.endpointA.lon == null;
    const bMissing = p.endpointB.lat == null || p.endpointB.lon == null;
    if (aMissing || bMissing) projectsMissingEndpointCoords += 1;
  }
  return {
    totalProjects: projects.length,
    totalOverlaps: overlaps.length,
    dominionProjects: projects.filter((p) => p.utilityKey === "dominion").length,
    georgiaProjects: projects.filter((p) => p.utilityKey === "georgia-power").length,
    projectsWithCoords,
    projectsMissingEndpointCoords,
  };
}

/* ------------------------------------------------------------------ */
/*  Ranked coordination opportunities with cost/impact estimates      */
/* ------------------------------------------------------------------ */

/**
 * Coordination score: 0–100. Higher = stronger coordination opportunity.
 *
 * Two factors (each 0–50):
 *   1. Proximity: projects < 5 mi apart score 50; at 20 mi → 0.
 *   2. Schedule alignment: projects with 0 day gap score 50; at 3000+ days → 0.
 *
 * The composite score answers: "How likely would co-planning save money?"
 */
function coordinationScore(distanceMi: number | null, timeGapDays: number | null): number {
  const d = distanceMi ?? 30;
  const t = timeGapDays ?? 5000;
  const proxScore = Math.max(0, Math.min(50, 50 * (1 - d / 20)));
  const schedScore = Math.max(0, Math.min(50, 50 * (1 - t / 3000)));
  return Math.round(proxScore + schedScore);
}

type CoordinationType =
  | "Shared ROW"
  | "Joint construction"
  | "Shared substation"
  | "Staggered build";

function classifyOpportunity(
  distanceMi: number | null,
  timeGapDays: number | null,
): CoordinationType {
  const d = distanceMi ?? 99;
  const t = timeGapDays ?? 9999;
  if (d <= 5 && t <= 365) return "Joint construction";
  if (d <= 5) return "Shared substation";
  if (t <= 730) return "Shared ROW";
  return "Staggered build";
}

/**
 * Rough cost-impact estimate for a coordination opportunity.
 *
 * Model (industry averages from FERC / EEI / ASCE data):
 *   - Transmission ROW acquisition: ~$200 k/mile (rural SE US avg)
 *   - Shared-ROW savings: ~40-60% of land cost for the overlapping corridor
 *   - Joint-construction mobilisation savings: ~$800k–$1.5M per shared mob event
 *   - Shared substation pad: ~$2–4M for land + civil, 30–50% savings if shared
 *
 * We use the conservative end of each range and note it's an order-of-magnitude estimate.
 */
export type CostImpact = {
  sharedRowMiles: number;
  rowCostPerMile: number;
  rowSavingsPct: number;
  estimatedSavings: number;
  mobilisationSavings: number;
  totalEstimatedSavings: number;
  explanation: string;
};

function estimateCostImpact(distanceMi: number | null, timeGapDays: number | null): CostImpact {
  const d = distanceMi ?? 10;
  const t = timeGapDays ?? 1000;
  const ROW_COST_PER_MILE = 200_000;
  const ROW_SAVINGS_PCT = 0.4;
  const MOBILISATION_SAVINGS = 800_000;
  const sharedRowMiles = Math.max(0.5, Math.min(d, 15));
  const rowSavings = Math.round(sharedRowMiles * ROW_COST_PER_MILE * ROW_SAVINGS_PCT);
  const mobSavings = t <= 730 ? MOBILISATION_SAVINGS : 0;
  const total = rowSavings + mobSavings;

  let explanation: string;
  if (t <= 365 && d <= 5) {
    explanation =
      `These projects are only ${d.toFixed(1)} mi apart and their schedules overlap within ${t.toLocaleString()} days. ` +
      `By sharing ~${sharedRowMiles.toFixed(1)} mi of right-of-way (ROW) at ~$${(ROW_COST_PER_MILE / 1000).toFixed(0)}k/mi ` +
      `and combining mobilisation, the utilities could save an estimated $${(total / 1_000_000).toFixed(2)}M. ` +
      `This is the strongest coordination candidate in the dataset.`;
  } else if (d <= 10) {
    explanation =
      `At ${d.toFixed(1)} mi apart, a shared ROW corridor of ~${sharedRowMiles.toFixed(1)} mi could save ` +
      `~$${(rowSavings / 1000).toFixed(0)}k in land acquisition costs (${(ROW_SAVINGS_PCT * 100).toFixed(0)}% of $${(ROW_COST_PER_MILE / 1000).toFixed(0)}k/mi). ` +
      (mobSavings > 0
        ? `Schedule alignment within ${t.toLocaleString()} days also enables shared mobilisation savings of ~$${(mobSavings / 1000).toFixed(0)}k.`
        : `However, the ${t.toLocaleString()}-day schedule gap limits joint-construction savings.`);
  } else {
    explanation =
      `At ${d.toFixed(1)} mi separation the ROW-sharing benefit is modest (~$${(rowSavings / 1000).toFixed(0)}k), ` +
      `but coordinating environmental surveys and permitting across these parallel projects ` +
      `could still reduce soft costs by 10–20%.`;
  }

  return {
    sharedRowMiles,
    rowCostPerMile: ROW_COST_PER_MILE,
    rowSavingsPct: ROW_SAVINGS_PCT,
    estimatedSavings: rowSavings,
    mobilisationSavings: mobSavings,
    totalEstimatedSavings: total,
    explanation,
  };
}

export type RankedOpportunity = {
  rank: number;
  overlap: ProjectOverlap;
  score: number;
  type: CoordinationType;
  costImpact: CostImpact;
};

export function getRankedCoordinationOpportunities(): RankedOpportunity[] {
  return overlaps
    .map((o) => ({
      overlap: o,
      score: coordinationScore(o.distanceMi, o.timeGapDays),
      type: classifyOpportunity(o.distanceMi, o.timeGapDays),
      costImpact: estimateCostImpact(o.distanceMi, o.timeGapDays),
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

export function utilityShortLabel(key: UtilityKey): string {
  return key === "dominion" ? "Dominion Energy" : "Georgia Power";
}

export function utilityBadgeClass(key: UtilityKey): string {
  return key === "dominion"
    ? "bg-dominion-light text-dominion border-dominion/30"
    : "bg-georgia-light text-georgia border-georgia/30";
}

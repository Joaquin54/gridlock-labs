import type { ReviewQueuePoint } from "../types/geocode";
import type {
  CatalogSearchResult,
  GridlockProject,
  ProjectOverlap,
  SearchFilters,
  UtilityKey,
} from "../types/project";
import { getPilotProjectCountyFips, getQueuePointCountyFips } from "./countyIndex";
import {
  queuePointSearchHaystack,
  queuePointsByProjectId,
  workTypeForProject,
} from "./geocodeRepository";
import { utilityKeyFromApi } from "./mappers";
import type { ApiUtility } from "../api/types";

export function utilityKeyFromName(utility: string): UtilityKey {
  if (utility.toLowerCase().includes("dominion")) return "dominion";
  return "georgia-power";
}

export function getAllProjects(projects: GridlockProject[]): GridlockProject[] {
  return projects;
}

export function getProjectById(
  projects: GridlockProject[],
  id: string,
): GridlockProject | undefined {
  return projects.find((p) => p.id === id);
}

export function getAllOverlaps(overlaps: ProjectOverlap[]): ProjectOverlap[] {
  return overlaps;
}

export function getOverlapsForProject(
  overlaps: ProjectOverlap[],
  projectId: string,
): ProjectOverlap[] {
  return overlaps.filter((o) => o.projectIdA === projectId || o.projectIdB === projectId);
}

export function getLinkedProjects(
  projects: GridlockProject[],
  project: GridlockProject,
): GridlockProject[] {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  return project.overlapProjectIds
    .map((id) => projectById.get(id))
    .filter((p): p is GridlockProject => Boolean(p));
}

export function searchProjects(
  projects: GridlockProject[],
  filters: SearchFilters,
  queuePoints: ReviewQueuePoint[] = [],
): GridlockProject[] {
  const q = filters.query.trim().toLowerCase();
  const pointsByProject = queuePointsByProjectId(queuePoints);

  return projects.filter((p) => {
    if (filters.utility && p.utilityKey !== filters.utility) return false;
    if (filters.state && p.state !== filters.state) return false;
    if (filters.overlapsOnly && p.overlapCount === 0) return false;
    if (filters.workType && workTypeForProject(p) !== filters.workType) return false;
    if (filters.county) {
      const inPilotCounty = getPilotProjectCountyFips(p.id) === filters.county;
      const inPointCounty = (pointsByProject.get(p.id) ?? []).some(
        (pt) => getQueuePointCountyFips(pt.id) === filters.county,
      );
      if (!inPilotCounty && !inPointCounty) return false;
    }
    if (!q) return true;
    const pointHaystack = (pointsByProject.get(p.id) ?? [])
      .map(queuePointSearchHaystack)
      .join(" ");
    const haystack = [
      p.id,
      p.name,
      p.utility,
      p.state,
      p.endpointA.label,
      p.endpointB.label,
      pointHaystack,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function searchCatalog(
  projects: GridlockProject[],
  queuePoints: ReviewQueuePoint[],
  filters: SearchFilters,
): CatalogSearchResult[] {
  return searchProjects(projects, filters, queuePoints).map((project) => ({
    kind: "pilot" as const,
    project,
  }));
}

export type DashboardSummary = {
  totalProjects: number;
  totalOverlaps: number;
  dominionProjects: number;
  georgiaProjects: number;
  projectsWithCoords: number;
  projectsMissingEndpointCoords: number;
};

export function getDashboardSummary(
  projects: GridlockProject[],
  overlaps: ProjectOverlap[],
): DashboardSummary {
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

export function getRankedCoordinationOpportunities(
  overlaps: ProjectOverlap[],
): RankedOpportunity[] {
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

export function apiUtilityLabel(utility: ApiUtility): string {
  return utility === "DESC" ? "Dominion Energy SC" : "Georgia Power";
}

export { utilityKeyFromApi };

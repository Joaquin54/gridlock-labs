import type { GridlockProject, ProjectOverlap, SearchFilters, UtilityKey } from "../types/project";
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

export function utilityShortLabel(key: UtilityKey): string {
  return key === "dominion" ? "Dominion Energy" : "Georgia Power";
}

export function utilityBadgeClass(key: UtilityKey): string {
  return key === "dominion"
    ? "bg-dominion-light text-dominion border-dominion/30"
    : "bg-georgia-light text-georgia border-georgia/30";
}

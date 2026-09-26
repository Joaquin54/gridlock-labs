import type { ReviewQueuePoint } from "./geocode";

export type UtilityKey = "dominion" | "georgia-power";

export type ProjectEndpoint = {
  label: string | null;
  lat: number | null;
  lon: number | null;
};

export type GridlockProject = {
  id: string;
  utility: string;
  utilityKey: UtilityKey;
  state: string;
  name: string;
  endpointA: ProjectEndpoint;
  endpointB: ProjectEndpoint;
  center: { lat: number | null; lon: number | null };
  inServiceDate: string | null;
  overlapCount: number;
  overlapProjectIds: string[];
};

export type ProjectOverlap = {
  id: string;
  distanceMi: number | null;
  timeGapDays: number | null;
  utilityA: string;
  projectIdA: string;
  projectNameA: string;
  utilityB: string;
  projectIdB: string;
  projectNameB: string;
};

export type SearchFilters = {
  query: string;
  utility: "" | UtilityKey;
  state: "" | "GA" | "SC";
  overlapsOnly: boolean;
};

export type CatalogSearchResult =
  | { kind: "pilot"; project: GridlockProject }
  | { kind: "queue"; point: ReviewQueuePoint };

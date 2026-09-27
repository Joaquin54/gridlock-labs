export type UtilityKey = "dominion" | "georgia-power";

export type WorkType =
  | "rebuild"
  | "construct/new"
  | "replace"
  | "reconductor"
  | "install";

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
  description: string | null;
  voltageKv: number | null;
  lineMiles: number | null;
  zone: string | null;
  isBorder: boolean;
  workTypeRaw: string | null;
  located: boolean;
  locationConfidence: "high" | "medium" | "low" | null;
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
  pairConfidence?: "high" | "medium" | "low";
  borderline?: boolean;
  sharedAssets?: string[];
};

export type SearchFilters = {
  query: string;
  utility: "" | UtilityKey;
  state: "" | "GA" | "SC";
  /** County FIPS (13xxx GA, 45xxx SC) */
  county: string;
  workType: "" | WorkType;
  overlapsOnly: boolean;
};

export type CatalogSearchResult = { kind: "pilot"; project: GridlockProject };

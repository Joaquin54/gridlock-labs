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

export type ProjectLocationPoint = {
  seq: number;
  name: string;
  lat: number | null;
  lon: number | null;
  method: string | null;
  confidence: "high" | "medium" | "low";
  matchName: string | null;
  matchScore: number | null;
  sourceUrl: string | null;
};

export type GridlockProject = {
  id: string;
  projectKey: string;
  utility: string;
  utilityKey: UtilityKey;
  state: string;
  name: string;
  owner: string;
  ownerInScope: boolean;
  endpointA: ProjectEndpoint;
  endpointB: ProjectEndpoint;
  center: { lat: number | null; lon: number | null };
  startDate: string | null;
  startDateSource: string | null;
  inServiceDate: string | null;
  inServiceRaw: string | null;
  overlapCount: number;
  overlapProjectIds: string[];
  description: string | null;
  projectType: string | null;
  voltageKv: number | null;
  lineMiles: number | null;
  milesSource: string | null;
  costUsd: number | null;
  costLow: number | null;
  costHigh: number | null;
  sourceDoc: string;
  sourcePage: number;
  zone: string | null;
  isBorder: boolean;
  status: string | null;
  workTypeRaw: string | null;
  located: boolean;
  locationConfidence: "high" | "medium" | "low" | null;
  pointsLocated: number;
  pointsTotal: number;
  points: ProjectLocationPoint[];
};

export type ProjectOverlap = {
  id: string;
  distanceMi: number | null;
  /** Construction-window gap (used for coordination savings T). */
  timeGapDays: number | null;
  inServiceGapDays: number | null;
  windowGapDays: number | null;

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

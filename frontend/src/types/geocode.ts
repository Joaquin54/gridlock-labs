import type { UtilityKey } from "./project";

export type GeocodeConfidence = "unlocated" | "low" | "medium" | "high";
export type GeocodeTask = "FIND" | "CHECK" | "VERIFY" | "CONFIRM";

export type ReviewQueuePoint = {
  id: string;
  utility: string;
  projectKey: string;
  projectName: string;
  point: number;
  pointName: string;
  lat: number | null;
  lon: number | null;
  method: string | null;
  confidence: GeocodeConfidence;
  task: GeocodeTask;
  region: string;
  miles: number | null;
  isBorder: boolean;
  googleMapsUrl: string | null;
  osmUrl: string | null;
  description: string;
};

export function utilityKeyFromQueueCode(code: string): UtilityKey {
  return code === "DESC" ? "dominion" : "georgia-power";
}

export function regionLabel(region: string): string {
  const labels: Record<string, string> = {
    savannah_coast: "Savannah / coast",
    augusta_east: "Augusta / east",
    atlanta_metro: "Atlanta metro",
    sc: "South Carolina",
    rest_of_ga: "Rest of Georgia",
    unknown: "Unknown",
  };
  return labels[region] ?? region.replace(/_/g, " ");
}

export function confidenceMarkerFill(confidence: GeocodeConfidence): string {
  switch (confidence) {
    case "high":
      return "var(--green)";
    case "medium":
      return "var(--accent)";
    case "low":
      return "var(--dominion)";
    default:
      return "var(--text-muted)";
  }
}

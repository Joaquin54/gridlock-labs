import { apiGet } from "./client";
import type { ApiOverlap, ApiProjectCollection, ApiProjectFeature, ApiStats } from "./types";

export async function fetchProjects(): Promise<ApiProjectFeature[]> {
  const collection = await apiGet<ApiProjectCollection>("/projects");
  return collection.features;
}

export async function fetchProjectById(id: string): Promise<ApiProjectFeature> {
  return apiGet<ApiProjectFeature>(`/projects/${encodeURIComponent(id)}`);
}

export async function fetchOverlaps(): Promise<ApiOverlap[]> {
  return apiGet<ApiOverlap[]>("/overlaps");
}

export async function fetchStats(): Promise<ApiStats> {
  return apiGet<ApiStats>("/stats");
}

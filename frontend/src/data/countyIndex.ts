import { geoContains } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { feature as topoFeature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { ReviewQueuePoint } from "../types/geocode";
import type { GridlockProject } from "../types/project";

export const COUNTIES_GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";

export type CountyOption = {
  fips: string;
  name: string;
  state: "GA" | "SC";
};

type CountyFeature = Feature<Geometry, { name?: string }> & { id?: string | number };

type IndexedCoord = { id: string; lat: number; lon: number };

let countyOptions: CountyOption[] = [];
const queuePointCounty = new Map<string, string>();
const pilotProjectCounty = new Map<string, string>();
let indexPromise: Promise<void> | null = null;

function isScOrGaCountyFips(id: string | number | undefined): boolean {
  const fips = String(id ?? "");
  return fips.startsWith("13") || fips.startsWith("45");
}

function stateFromCountyFips(fips: string): "GA" | "SC" {
  return fips.startsWith("13") ? "GA" : "SC";
}

function assignCounties(
  items: IndexedCoord[],
  counties: CountyFeature[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    const coord: [number, number] = [item.lon, item.lat];
    for (const county of counties) {
      if (geoContains(county, coord)) {
        map.set(item.id, String(county.id));
        break;
      }
    }
  }
  return map;
}

function queueCoords(points: ReviewQueuePoint[]): IndexedCoord[] {
  return points
    .filter((p) => p.lat != null && p.lon != null && !Number.isNaN(p.lat) && !Number.isNaN(p.lon))
    .map((p) => ({ id: p.id, lat: p.lat as number, lon: p.lon as number }));
}

function pilotCoords(projects: GridlockProject[]): IndexedCoord[] {
  return projects
    .filter((p) => p.center.lat != null && p.center.lon != null && !Number.isNaN(p.center.lat))
    .map((p) => ({
      id: p.id,
      lat: p.center.lat as number,
      lon: p.center.lon as number,
    }));
}

/** Load SC/GA county shapes and map queue + pilot coordinates to county FIPS (cached). */
export function ensureCountyIndex(
  queuePoints: ReviewQueuePoint[],
  pilotProjects: GridlockProject[],
): Promise<void> {
  if (indexPromise) return indexPromise;

  indexPromise = (async () => {
    const res = await fetch(COUNTIES_GEO_URL);
    const topology = (await res.json()) as Topology;
    const countiesTopo = topology.objects.counties;
    if (!countiesTopo) return;

    const collection = topoFeature(topology, countiesTopo);
    if (collection.type !== "FeatureCollection") return;

    const scGaCounties = collection.features.filter((f) => isScOrGaCountyFips(f.id)) as CountyFeature[];

    countyOptions = scGaCounties
      .map((f) => {
        const fips = String(f.id ?? "");
        return {
          fips,
          name: f.properties?.name ?? "County",
          state: stateFromCountyFips(fips),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const [id, fips] of assignCounties(queueCoords(queuePoints), scGaCounties)) {
      queuePointCounty.set(id, fips);
    }
    for (const [id, fips] of assignCounties(pilotCoords(pilotProjects), scGaCounties)) {
      pilotProjectCounty.set(id, fips);
    }
  })();

  return indexPromise;
}

export function getCountyOptionsForState(state: "" | "GA" | "SC"): CountyOption[] {
  if (!state) return [];
  return countyOptions.filter((c) => c.state === state);
}

export function isValidCountyFipsForState(fips: string, state: "" | "GA" | "SC"): boolean {
  if (!fips) return true;
  if (!state) return false;
  const prefix = state === "GA" ? "13" : "45";
  if (!fips.startsWith(prefix) || !/^\d{5}$/.test(fips)) return false;
  if (countyOptions.length === 0) return true;
  return countyOptions.some((c) => c.fips === fips);
}

export function getQueuePointCountyFips(pointId: string): string | undefined {
  return queuePointCounty.get(pointId);
}

export function getPilotProjectCountyFips(projectId: string): string | undefined {
  return pilotProjectCounty.get(projectId);
}

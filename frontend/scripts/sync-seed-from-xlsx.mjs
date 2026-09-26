/**
 * Regenerates src/data/seed.json from Sperry-Tech-Challenge/Projects_Overlaps.xlsx
 * Run from frontend/: bun run sync-seed
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const xlsxPath = join(root, "Sperry-Tech-Challenge/Projects_Overlaps.xlsx");
const outPath = join(root, "frontend/src/data/seed.json");

function clean(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isNaN(v)) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v;
}

const wb = XLSX.read(readFileSync(xlsxPath), { cellDates: true });
const projects = XLSX.utils.sheet_to_json(wb.Sheets.projects);
const overlaps = XLSX.utils.sheet_to_json(wb.Sheets.overlaps);

const projRows = projects.map((r) => {
  const overlapsIds = [1, 2, 3].map((i) => clean(r[`overlap_${i}`])).filter(Boolean);
  return {
    id: clean(r.project_id),
    utility: clean(r.utility),
    state: clean(r.state),
    name: clean(r.project_name),
    endpointA: { label: clean(r.name_a), lat: clean(r.lat_a), lon: clean(r.lon_a) },
    endpointB: { label: clean(r.name_b), lat: clean(r.lat_b), lon: clean(r.lon_b) },
    center: { lat: clean(r.lat_center), lon: clean(r.lon_center) },
    inServiceDate: clean(r.in_service_date),
    overlapCount: Number(r.overlap_count) || 0,
    overlapProjectIds: overlapsIds,
  };
});

const ovRows = overlaps.map((r) => ({
  id: clean(r.overlap_id),
  distanceMi: clean(r.distance_mi),
  timeGapDays: r["time_gap (day)"] != null ? Number(r["time_gap (day)"]) : null,
  utilityA: clean(r.utility_a),
  projectIdA: clean(r.project_id_a),
  projectNameA: clean(r.project_name_a),
  utilityB: clean(r.utility_b),
  projectIdB: clean(r.project_id_b),
  projectNameB: clean(r.project_name_b),
}));

writeFileSync(outPath, `${JSON.stringify({ projects: projRows, overlaps: ovRows }, null, 2)}\n`);
console.log(`Wrote ${outPath} (${projRows.length} projects, ${ovRows.length} overlaps)`);

// Regenerates src/data/overlaps.json from the deliverable overlap table.
// Run: bun run sync-overlaps
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(here, "../../docs/deliverable/overlaps.csv");
const TARGET = resolve(here, "../src/data/overlaps.json");

/** Splits one CSV line, honouring quoted fields (project ids contain commas). */
function splitRow(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      cells.push(cell);
      cell = "";
      continue;
    }
    cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

const lines = readFileSync(SOURCE, "utf8").trim().split(/\r?\n/);
const header = splitRow(lines[0]);
const at = (name) => {
  const i = header.indexOf(name);
  if (i === -1) throw new Error(`overlaps.csv is missing column "${name}"`);
  return i;
};

const col = {
  id: at("overlap_id"),
  distance: at("distance_mi"),
  gap: at("time_gap (day)"),
  utilityA: at("utility_a"),
  idA: at("project_id_a"),
  nameA: at("project_name_a"),
  utilityB: at("utility_b"),
  idB: at("project_id_b"),
  nameB: at("project_name_b"),
  confA: at("confidence_a"),
  confB: at("confidence_b"),
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const overlaps = lines.slice(1).map((line) => {
  const c = splitRow(line);
  return {
    id: c[col.id],
    distanceMi: num(c[col.distance]),
    timeGapDays: num(c[col.gap]),
    utilityA: c[col.utilityA],
    projectIdA: c[col.idA],
    projectNameA: c[col.nameA],
    utilityB: c[col.utilityB],
    projectIdB: c[col.idB],
    projectNameB: c[col.nameB],
    confidenceA: c[col.confA] || null,
    confidenceB: c[col.confB] || null,
  };
});

writeFileSync(TARGET, `${JSON.stringify({ overlaps }, null, 2)}\n`);
console.log(`wrote ${overlaps.length} overlaps to src/data/overlaps.json`);

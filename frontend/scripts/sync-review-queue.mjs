/**
 * Regenerates src/data/review-queue.json from review_queue.csv at repo root.
 * Run from frontend/: bun run sync-review-queue
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const script = `
import csv, json
from pathlib import Path
root = Path(${JSON.stringify(root)})
rows = []
with open(root / "review_queue.csv", newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        def num(x):
            if x is None or x == "": return None
            try: return float(x)
            except ValueError: return None
        def b(x):
            return str(x).lower() in ("true", "1", "yes")
        lat, lon = num(r.get("current_lat")), num(r.get("current_lon"))
        rows.append({
            "id": f"{r['utility']}-{r['project_key']}-{r['point']}",
            "utility": r["utility"],
            "projectKey": r["project_key"],
            "projectName": r["name"],
            "point": int(r["point"]) if r.get("point") else 0,
            "pointName": r["point_name"],
            "lat": lat,
            "lon": lon,
            "method": r["method"] or None,
            "confidence": r["confidence"] or "unlocated",
            "task": r["task"] or "FIND",
            "region": r["region"] or "unknown",
            "miles": num(r.get("miles")),
            "isBorder": b(r.get("is_border")),
            "googleMapsUrl": r.get("google_maps_url") or None,
            "osmUrl": r.get("osm_url") or None,
            "description": (r.get("description") or "")[:500],
        })
out = root / "frontend/src/data/review-queue.json"
out.write_text(json.dumps({"points": rows}, indent=2) + "\\n")
print(f"Wrote {len(rows)} points to {out}")
`;

const result = spawnSync("python3", ["-c", script], { stdio: "inherit" });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

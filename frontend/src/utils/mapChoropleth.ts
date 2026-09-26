import { scaleThreshold } from "d3-scale";

/** Matches KBR StateMap — fill for zero project / point count. */
export const MAP_ZERO_FILL = "#e8ffea";

/** Eight-step choropleth — mint → navy (KBR StateMap). */
export const MAP_COLOR_STOPS = [
  "#c0f0c4",
  "#9ce6a7",
  "#72d497",
  "#3eb896",
  "#18888c",
  "#1c708f",
  "#195182",
  "#0d3763",
] as const;

export const MAP_HOVER_FILL = "#ffe259";
export const MAP_HOVER_STROKE = "#f97316";
export const MAP_SELECTED_STROKE = "#1a56db";
/** Orange highlight outline (county hover / state hover). */
export const MAP_HOVER_STROKE_WIDTH = 3;
export const MAP_SELECTED_STROKE_WIDTH = 3;
export const MAP_DEFAULT_STROKE = "#ffffff";
export const MAP_MUTED_STATE_FILL = "#e8edf5";
/** County interior lines */
export const MAP_INSET_STROKE = "#2f6b52";
export const MAP_COUNTY_STROKE_WIDTH = 0.9;
/** SC ↔ GA (and outer state) boundary — drawn above counties */
export const MAP_STATE_BOUNDARY_STROKE = "#1a4d38";
export const MAP_STATE_BOUNDARY_WIDTH = 2.5;

export type CountyCountScale = {
  getFill: (count: number) => string;
};

/** Quantile thresholds over non-zero counts so the full KBR ramp is used locally. */
export function buildCountyCountScale(counts: Iterable<number>): CountyCountScale {
  const values = [...counts].filter((c) => c > 0).sort((a, b) => a - b);
  if (values.length === 0) {
    return { getFill: () => MAP_ZERO_FILL };
  }

  const thresholds: number[] = [];
  for (let i = 1; i <= 7; i++) {
    const idx = Math.min(values.length - 1, Math.floor((i / 8) * values.length));
    let t = values[idx];
    const prev = thresholds[thresholds.length - 1];
    if (prev !== undefined && t <= prev) {
      t = prev + 1;
    }
    thresholds.push(t);
  }

  const scale = scaleThreshold<number, string>()
    .domain(thresholds)
    .range([...MAP_COLOR_STOPS]);

  return {
    getFill: (count: number) => {
      if (count <= 0) return MAP_ZERO_FILL;
      return scale(count);
    },
  };
}

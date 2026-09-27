/** Panel shell — single inset card used for every chart, map, and list panel. */
export const CLS_DASHBOARD_PANEL_SHELL =
  "bg-surface border border-border rounded-lg w-full px-4 pt-[0.9rem] pb-[0.9rem]";

/** Panel title — shared size, weight, and spacing below the header row. */
export const CLS_DASHBOARD_PANEL_HEADER =
  "shrink-0 text-text-primary text-[0.9rem] font-semibold mb-[0.65rem]";

/** Muted helper line under a panel title (charts). */
export const CLS_DASHBOARD_PANEL_CAPTION = "m-0 mb-1 text-[0.8125rem] leading-snug text-text-muted";

/** In-panel list / key-value rows (matches chart tooltip size). */
export const CLS_DASHBOARD_PANEL_BODY = "text-[0.8125rem] text-text-secondary";

/** Section intro blurb under page / analytics headings. */
export const CLS_DASHBOARD_INTRO =
  "m-0 max-w-5xl text-[0.8125rem] leading-snug text-text-secondary";

/** Major section heading (below page title). */
export const CLS_DASHBOARD_SECTION_TITLE =
  "m-0 text-[0.95rem] font-semibold leading-tight text-text-primary";

/** Recharts axis ticks (px). */
export const CHART_TICK_FONT_SIZE = 12;

export const CHART_AXIS_TICK = {
  fill: "var(--text-secondary)",
  fontSize: CHART_TICK_FONT_SIZE,
} as const;

export const CHART_LEGEND_WRAPPER_STYLE = {
  fontSize: "0.8125rem",
  color: "var(--text-secondary)",
  lineHeight: "1.25",
} as const;

export const CHART_LEGEND_ICON_SIZE = 12;

export const CHART_LEGEND_BOTTOM = {
  verticalAlign: "bottom" as const,
  height: 36,
  iconSize: CHART_LEGEND_ICON_SIZE,
  wrapperStyle: CHART_LEGEND_WRAPPER_STYLE,
};

export const CHART_LEGEND_TOP = {
  verticalAlign: "top" as const,
  height: 28,
  iconSize: CHART_LEGEND_ICON_SIZE,
  wrapperStyle: CHART_LEGEND_WRAPPER_STYLE,
};

export const CHART_TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-md)",
  fontSize: "0.8125rem",
} as const;

/** Pie slice separators — radial strokes (constant width), not paddingAngle gaps. */
export const CHART_PIE_SLICE_STROKE = {
  stroke: "var(--surface)",
  strokeWidth: 2,
  rootTabIndex: -1,
} as const;

/** Recharts defaults put tabIndex on the chart SVG; charts here are pointer-driven. */
export const CHART_RECHARTS_PROPS = {
  accessibilityLayer: false,
} as const;

/** Pie root layer is focusable by default; keep sectors clickable without a focus ring. */
export const CHART_PIE_NO_FOCUS_RING = {
  rootTabIndex: -1,
} as const;

/** Prevent mousedown from focusing Recharts SVG hit targets (avoids the blue click outline). */
export function suppressRechartsPointerFocus(event: Event): void {
  const target = event.target;
  if (target instanceof Element && target.closest(".recharts-wrapper")) {
    event.preventDefault();
  }
}

export const CHART_TOOLTIP_LABEL_STYLE = {
  color: "var(--text-primary)",
  fontWeight: 600,
} as const;

/** Inset row/card sitting on the panel background. */
export const CLS_PANEL_ITEM = "rounded-md border border-border bg-bg px-2.5 py-2";

/** Inset row that navigates on click. */
export const CLS_PANEL_ITEM_INTERACTIVE =
  "cursor-pointer transition-[border-color,background,box-shadow] duration-150 hover:border-accent hover:bg-surface-hover hover:shadow-sm focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

/** Monospace metadata strip above an item title. */
export const CLS_PANEL_ITEM_META =
  "flex flex-wrap items-center gap-1.5 font-mono text-[0.6875rem] leading-none text-text-muted";

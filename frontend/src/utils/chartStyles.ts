/** Panel shell — single inset card used for every chart, map, and list panel. */
export const CLS_DASHBOARD_PANEL_SHELL =
  "bg-surface border border-border rounded-lg w-full px-4 pt-[0.9rem] pb-[0.9rem]";

/** Panel title — shared size, weight, and spacing below the header row. */
export const CLS_DASHBOARD_PANEL_HEADER =
  "shrink-0 text-text-primary text-[0.9rem] font-semibold mb-[0.65rem]";

/** Inset row/card sitting on the panel background. */
export const CLS_PANEL_ITEM = "rounded-md border border-border bg-bg px-2.5 py-2";

/** Inset row that navigates on click. */
export const CLS_PANEL_ITEM_INTERACTIVE =
  "cursor-pointer transition-[border-color,background,box-shadow] duration-150 hover:border-accent hover:bg-surface-hover hover:shadow-sm focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

/** Monospace metadata strip above an item title. */
export const CLS_PANEL_ITEM_META =
  "flex flex-wrap items-center gap-1.5 font-mono text-[0.6875rem] leading-none text-text-muted";

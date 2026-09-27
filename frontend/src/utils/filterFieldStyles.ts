import { cn } from "./cn";

/** Active filter — accent border, darker fill, pulsing accent glow (KBR FilterSelect). */
export const CLS_FILTER_CONTROL_ACTIVE = cn(
  "!border-accent bg-accent/80 text-text-primary dark:bg-accent/45",
  "animate-filter-selected-pulse",
  "hover:!border-accent focus:!border-accent",
);

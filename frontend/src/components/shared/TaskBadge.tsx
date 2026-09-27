import type { GeocodeTask } from "../../types/geocode";
import { cn } from "../../utils/cn";

const styles: Record<GeocodeTask, string> = {
  FIND: "bg-red-50 text-red-700 border-red-200/90 dark:bg-red-950/45 dark:text-red-300 dark:border-red-900/50",
  CHECK: "bg-accent-light text-accent-text border-accent/25",
  VERIFY: "bg-surface-hover text-text-secondary border-border",
  CONFIRM: "bg-green-light text-green border-green/30",
};

type TaskBadgeProps = {
  task: GeocodeTask;
  className?: string;
};

export default function TaskBadge({ task, className }: TaskBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-[0.45rem] py-[0.12rem] font-mono text-[10px] font-semibold tracking-[0.04em]",
        styles[task],
        className,
      )}
    >
      {task}
    </span>
  );
}

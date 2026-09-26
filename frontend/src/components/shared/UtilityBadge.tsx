import { utilityBadgeClass, utilityShortLabel } from "../../data/repository";
import type { UtilityKey } from "../../types/project";
import { cn } from "../../utils/cn";

type UtilityBadgeProps = {
  utilityKey: UtilityKey;
  className?: string;
};

export default function UtilityBadge({ utilityKey, className }: UtilityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm border text-[0.72rem] font-semibold uppercase tracking-wide",
        utilityBadgeClass(utilityKey),
        className,
      )}
    >
      {utilityShortLabel(utilityKey)}
    </span>
  );
}

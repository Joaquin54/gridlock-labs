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
        "inline-flex items-center whitespace-nowrap rounded-full border px-[0.45rem] py-[0.12rem] font-sans text-[10px] font-medium tracking-[0.01em]",
        utilityBadgeClass(utilityKey),
        className,
      )}
    >
      {utilityShortLabel(utilityKey)}
    </span>
  );
}

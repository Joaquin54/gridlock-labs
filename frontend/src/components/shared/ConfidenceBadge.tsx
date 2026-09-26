import type { GeocodeConfidence } from "../../types/geocode";
import { cn } from "../../utils/cn";

const styles: Record<GeocodeConfidence, string> = {
  unlocated: "bg-surface-hover text-text-muted border-border",
  low: "bg-dominion-light text-dominion border-dominion/30",
  medium: "bg-accent-light text-accent-text border-accent/30",
  high: "bg-green-light text-green border-green/30",
};

type ConfidenceBadgeProps = {
  confidence: GeocodeConfidence;
  className?: string;
};

export default function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-[0.45rem] py-[0.12rem] font-sans text-[10px] font-medium capitalize tracking-[0.01em]",
        styles[confidence],
        className,
      )}
    >
      {confidence}
    </span>
  );
}

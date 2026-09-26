import { cn } from "../../utils/cn";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  accent?: "default" | "dominion" | "georgia" | "green";
};

const accentRing: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "border-l-accent",
  dominion: "border-l-dominion",
  georgia: "border-l-georgia",
  green: "border-l-green",
};

export default function StatCard({ label, value, hint, accent = "default" }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-lg shadow-sm px-4 py-3 border-l-4",
        accentRing[accent],
      )}
    >
      <p className="text-[0.78rem] uppercase tracking-wide text-text-muted m-0">{label}</p>
      <p className="text-[1.65rem] font-semibold text-text-primary m-0 mt-1 leading-none">
        {value}
      </p>
      {hint ? <p className="text-[0.78rem] text-text-secondary m-0 mt-1.5">{hint}</p> : null}
    </div>
  );
}

import { cn } from "../../utils/cn";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  accent?: "default" | "dominion" | "georgia" | "green";
};

const accentText: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "text-accent",
  dominion: "text-dominion",
  georgia: "text-georgia",
  green: "text-green",
};

export default function StatCard({ label, value, hint, accent = "default" }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-lg w-full min-w-0 text-center px-2 py-2 min-[901px]:px-4 min-[901px]:py-[0.9rem]">
      <div
        className={cn(
          "font-mono font-bold leading-[1.2] truncate text-[0.95rem] min-[901px]:text-[1.45rem]",
          accentText[accent],
        )}
      >
        {value}
      </div>
      <div className="text-text-secondary leading-tight text-[0.625rem] mt-1 min-[901px]:text-[0.8125rem] min-[901px]:mt-[0.375rem]">
        {label}
      </div>
      {hint ? (
        <div className="text-text-muted text-[0.6875rem] leading-tight mt-1">{hint}</div>
      ) : null}
    </div>
  );
}

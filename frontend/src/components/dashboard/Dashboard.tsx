import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  getAllOverlaps,
  getAllProjects,
  getDashboardSummary,
  utilityShortLabel,
} from "../../data/repository";
import {
  CLS_DASHBOARD_PANEL_HEADER,
  CLS_DASHBOARD_PANEL_SHELL,
  CLS_PANEL_ITEM,
  CLS_PANEL_ITEM_INTERACTIVE,
  CLS_PANEL_ITEM_META,
} from "../../utils/chartStyles";
import { cn } from "../../utils/cn";
import { formatCount, formatDateLabel, formatMiles } from "../../utils/format";
import StatCard from "../shared/StatCard";
import UtilityBadge from "../shared/UtilityBadge";
import RegionalProjectMap from "./RegionalProjectMap";

const CLS_TH =
  "px-2 py-[0.36rem] text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap";

const CLS_TD = "px-2 py-[0.42rem] text-text-secondary";

export default function Dashboard() {
  const navigate = useNavigate();
  const projects = getAllProjects();
  const overlaps = getAllOverlaps();
  const summary = getDashboardSummary();

  const utilityChartData = useMemo(
    () => [
      { name: "Dominion", count: summary.dominionProjects, fill: "var(--dominion)" },
      { name: "Georgia Power", count: summary.georgiaProjects, fill: "var(--georgia)" },
    ],
    [summary.dominionProjects, summary.georgiaProjects],
  );

  const overlapByProject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of overlaps) {
      counts.set(o.projectIdA, (counts.get(o.projectIdA) ?? 0) + 1);
      counts.set(o.projectIdB, (counts.get(o.projectIdB) ?? 0) + 1);
    }
    return projects
      .filter((p) => (counts.get(p.id) ?? 0) > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        overlaps: counts.get(p.id) ?? 0,
        utilityKey: p.utilityKey,
      }))
      .sort((a, b) => b.overlaps - a.overlaps);
  }, [overlaps, projects]);

  return (
    <div className="flex w-full flex-col px-6 py-[1.1rem] max-[900px]:px-3 max-[900px]:py-3">
      <div className="mb-3 flex flex-col gap-1">
        <h1 className="m-0 text-[1.05rem] font-semibold leading-tight text-text-primary">
          Gridlock overlap dashboard
        </h1>
        <p className="m-0 max-w-3xl text-[0.8125rem] leading-snug text-text-secondary">
          Dominion Energy (South Carolina) and Georgia Power transmission projects — spatial and
          schedule overlap signals from the current pilot dataset.
        </p>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4 min-[901px]:gap-3">
        <StatCard label="Projects tracked" value={formatCount(summary.totalProjects)} />
        <StatCard
          label="Cross-utility overlaps"
          value={formatCount(summary.totalOverlaps)}
          accent="green"
        />
        <StatCard
          label="Dominion (SC)"
          value={formatCount(summary.dominionProjects)}
          accent="dominion"
        />
        <StatCard
          label="Georgia Power"
          value={formatCount(summary.georgiaProjects)}
          accent="georgia"
        />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <RegionalProjectMap
          projects={projects}
          onSelectProject={(id) => navigate(`/projects/${id}`)}
        />
        <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[310px] flex-col")}>
          <div className={CLS_DASHBOARD_PANEL_HEADER}>Projects by utility</div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilityChartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  width={32}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-hover)" }}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-md)",
                    fontSize: "0.8125rem",
                  }}
                  labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
                />
                <Bar dataKey="count" maxBarSize={72} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mt-[0.85rem] grid grid-cols-1 items-start gap-[0.85rem] xl:grid-cols-2">
        <section className={CLS_DASHBOARD_PANEL_SHELL}>
          <div className={CLS_DASHBOARD_PANEL_HEADER}>Recent overlap pairs</div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {overlaps.map((o) => (
              <li key={o.id} className={CLS_PANEL_ITEM}>
                <div className={CLS_PANEL_ITEM_META}>
                  <span>{o.id}</span>
                  <span className="text-border-strong" aria-hidden>
                    ·
                  </span>
                  <span>{formatMiles(o.distanceMi)}</span>
                </div>
                <p className="m-0 mt-1.5 text-[0.8125rem] leading-snug">
                  <button
                    type="button"
                    className="cursor-pointer border-none bg-transparent p-0 text-left font-medium text-accent-text hover:underline"
                    onClick={() => navigate(`/projects/${o.projectIdA}`)}
                  >
                    {o.projectNameA}
                  </button>
                  <span className="text-text-muted"> ↔ </span>
                  <button
                    type="button"
                    className="cursor-pointer border-none bg-transparent p-0 text-left font-medium text-accent-text hover:underline"
                    onClick={() => navigate(`/projects/${o.projectIdB}`)}
                  >
                    {o.projectNameB}
                  </button>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className={CLS_DASHBOARD_PANEL_SHELL}>
          <div className={CLS_DASHBOARD_PANEL_HEADER}>Highest overlap activity</div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {overlapByProject.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={cn(
                    CLS_PANEL_ITEM,
                    CLS_PANEL_ITEM_INTERACTIVE,
                    "flex w-full items-start justify-between gap-3 text-left",
                  )}
                  onClick={() => navigate(`/projects/${row.id}`)}
                >
                  <div className="min-w-0">
                    <div className={CLS_PANEL_ITEM_META}>
                      <UtilityBadge utilityKey={row.utilityKey} />
                      <span>{row.id}</span>
                    </div>
                    <span className="mt-1.5 block text-[0.8125rem] font-medium leading-snug text-text-primary">
                      {row.name}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[0.8125rem] font-semibold leading-none text-green">
                    {row.overlaps}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "mt-[0.85rem]")}>
        <div className={CLS_DASHBOARD_PANEL_HEADER}>All projects (quick view)</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.8125rem]">
            <thead>
              <tr className="border-b-2 border-border-strong text-left">
                <th className={CLS_TH}>ID</th>
                <th className={CLS_TH}>Utility</th>
                <th className={CLS_TH}>State</th>
                <th className={CLS_TH}>In service</th>
                <th className={cn(CLS_TH, "text-right")}>Overlaps</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-b border-border transition-[background] duration-100 last:border-b-0 hover:bg-surface-hover"
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  <td className={cn(CLS_TD, "font-mono text-[0.6875rem] text-text-muted")}>
                    {p.id}
                  </td>
                  <td className={cn(CLS_TD, "text-text-primary")}>
                    {utilityShortLabel(p.utilityKey)}
                  </td>
                  <td className={CLS_TD}>{p.state}</td>
                  <td className={CLS_TD}>{formatDateLabel(p.inServiceDate)}</td>
                  <td className={cn(CLS_TD, "text-right font-mono tabular-nums")}>
                    {p.overlapCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

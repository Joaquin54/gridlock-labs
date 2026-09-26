import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  getAllOverlaps,
  getAllProjects,
  getDashboardSummary,
  utilityShortLabel,
} from "../../data/repository";
import { CLS_DASHBOARD_PANEL_HEADER, CLS_DASHBOARD_PANEL_SHELL } from "../../utils/chartStyles";
import { formatCount, formatDateLabel, formatMiles } from "../../utils/format";
import StatCard from "../shared/StatCard";
import UtilityBadge from "../shared/UtilityBadge";
import RegionalProjectMap from "./RegionalProjectMap";

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
    <div className="p-4 max-[900px]:p-3 space-y-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-text-primary m-0">Gridlock overlap dashboard</h1>
        <p className="text-sm text-text-secondary m-0 max-w-3xl">
          Dominion Energy (South Carolina) and Georgia Power transmission projects — spatial and
          schedule overlap signals from the current pilot dataset.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
        <RegionalProjectMap
          projects={projects}
          onSelectProject={(id) => navigate(`/projects/${id}`)}
        />
        <section className={CLS_DASHBOARD_PANEL_SHELL}>
          <header className={CLS_DASHBOARD_PANEL_HEADER}>Projects by utility</header>
          <div className="p-4 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilityChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className={CLS_DASHBOARD_PANEL_SHELL}>
          <header className={CLS_DASHBOARD_PANEL_HEADER}>Recent overlap pairs</header>
          <ul className="divide-y divide-border m-0 p-0 list-none">
            {overlaps.map((o) => (
              <li key={o.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-[0.72rem] font-mono text-text-muted">
                  <span>{o.id}</span>
                  <span>{formatMiles(o.distanceMi)}</span>
                </div>
                <p className="m-0 mt-1 text-sm text-text-primary">
                  <button
                    type="button"
                    className="text-left text-accent font-medium hover:underline bg-transparent border-none cursor-pointer p-0"
                    onClick={() => navigate(`/projects/${o.projectIdA}`)}
                  >
                    {o.projectNameA}
                  </button>
                  <span className="text-text-muted"> ↔ </span>
                  <button
                    type="button"
                    className="text-left text-accent font-medium hover:underline bg-transparent border-none cursor-pointer p-0"
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
          <header className={CLS_DASHBOARD_PANEL_HEADER}>Highest overlap activity</header>
          <ul className="divide-y divide-border m-0 p-0 list-none">
            {overlapByProject.map((row) => (
              <li key={row.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <UtilityBadge utilityKey={row.utilityKey} />
                    <span className="font-mono text-[0.72rem] text-text-muted">{row.id}</span>
                  </div>
                  <button
                    type="button"
                    className="text-left text-sm text-text-primary hover:text-accent bg-transparent border-none cursor-pointer p-0 font-medium"
                    onClick={() => navigate(`/projects/${row.id}`)}
                  >
                    {row.name}
                  </button>
                </div>
                <span className="shrink-0 text-sm font-semibold text-green">{row.overlaps}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={CLS_DASHBOARD_PANEL_SHELL}>
        <header className={CLS_DASHBOARD_PANEL_HEADER}>All projects (quick view)</header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-text-muted border-b border-border">
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Utility</th>
                <th className="px-4 py-2 font-medium">State</th>
                <th className="px-4 py-2 font-medium">In service</th>
                <th className="px-4 py-2 font-medium">Overlaps</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border hover:bg-surface-hover cursor-pointer"
                  onClick={() => navigate(`/projects/${p.id}`)}
                >
                  <td className="px-4 py-2 font-mono text-[0.78rem]">{p.id}</td>
                  <td className="px-4 py-2">{utilityShortLabel(p.utilityKey)}</td>
                  <td className="px-4 py-2">{p.state}</td>
                  <td className="px-4 py-2">{formatDateLabel(p.inServiceDate)}</td>
                  <td className="px-4 py-2">{p.overlapCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

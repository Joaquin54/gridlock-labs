import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getAllReviewQueuePoints,
  getBorderBreakdown,
  getGeocodeDashboardSummary,
  getLineMilesBuckets,
  getRegionByUtility,
  getReviewQueueChartData,
  getReviewQueuePrioritySample,
  getUniqueProjectCountsByUtility,
  getUtilitySplit,
  getVoltageBreakdown,
  getWorkTypeBreakdown,
} from "../../data/geocodeRepository";
import {
  getAllProjects,
  getDashboardSummary,
  getRankedCoordinationOpportunities,
  utilityShortLabel,
} from "../../data/repository";
import { regionLabel, utilityKeyFromQueueCode } from "../../types/geocode";
import {
  CHART_AXIS_TICK,
  CHART_LEGEND_BOTTOM,
  CHART_LEGEND_TOP,
  CHART_PIE_SLICE_STROKE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
  CHART_TICK_FONT_SIZE,
  CLS_DASHBOARD_INTRO,
  CLS_DASHBOARD_PANEL_BODY,
  CLS_DASHBOARD_PANEL_CAPTION,
  CLS_DASHBOARD_PANEL_HEADER,
  CLS_DASHBOARD_PANEL_SHELL,
  CLS_DASHBOARD_SECTION_TITLE,
} from "../../utils/chartStyles";
import { cn } from "../../utils/cn";
import {
  formatCoord,
  formatCount,
  formatDateLabel,
  formatMiles,
  formatPercent,
} from "../../utils/format";
import ConfidenceBadge from "../shared/ConfidenceBadge";
import StatCard from "../shared/StatCard";
import TaskBadge from "../shared/TaskBadge";
import UtilityBadge from "../shared/UtilityBadge";
import RegionalProjectMap from "./RegionalProjectMap";

const CLS_TH =
  "px-2 py-[0.36rem] text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap";

const CLS_TD = "px-2 py-[0.42rem] text-[0.8125rem] text-text-secondary";

type PieLegendEntry = {
  payload?: { value?: number };
};

function pieLegendLabel(value: string, entry: PieLegendEntry): ReactNode {
  const count = entry.payload?.value;
  if (count == null) return value;
  return (
    <span>
      {value}
      {"  "}
      <span className="font-mono text-text-muted opacity-80">{formatCount(count)}</span>
    </span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const projects = getAllProjects();
  const summary = getDashboardSummary();
  const geocodeSummary = getGeocodeDashboardSummary();
  const geocodeCharts = getReviewQueueChartData();
  const geocodePoints = getAllReviewQueuePoints();
  const reviewPriority = getReviewQueuePrioritySample(14);

  const rankedOpportunities = getRankedCoordinationOpportunities();
  const voltageData = getVoltageBreakdown();
  const workTypeData = getWorkTypeBreakdown();
  const borderData = getBorderBreakdown();
  const milesBuckets = getLineMilesBuckets();
  const utilitySplit = getUtilitySplit();
  const regionByUtility = getRegionByUtility();
  const uniqueByUtility = getUniqueProjectCountsByUtility();
  const borderProjectCount = borderData[0]?.value ?? 0;

  return (
    <div className="flex w-full flex-col px-6 py-[1.1rem] max-[900px]:px-3 max-[900px]:py-3">
      <div className="mb-3 flex flex-col gap-1">
        <h1 className="m-0 text-[1.05rem] font-semibold leading-tight text-text-primary">
          Project Overlap Dashboard
        </h1>
        <p className={CLS_DASHBOARD_INTRO}>
          Full GPC + Dominion SC portfolio from project listings and the geocode review queue (
          {formatCount(geocodeSummary.totalPoints)} location points). Pilot overlap analysis (
          {formatCount(summary.totalProjects)} curated projects,{" "}
          {formatCount(summary.totalOverlaps)} pairs) is summarized in the ranked table below.
        </p>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2 lg:grid-cols-4 min-[901px]:gap-3">
        <StatCard label="Unique projects" value={formatCount(geocodeSummary.uniqueProjects)} />
        <StatCard label="Location points" value={formatCount(geocodeSummary.totalPoints)} />
        <StatCard
          label="Points on map"
          value={formatCount(geocodeSummary.withCoordinates)}
          accent="green"
        />
        <StatCard label="Mapped coverage" value={formatPercent(geocodeSummary.locatedPct, 1)} />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4 min-[901px]:gap-3">
        <StatCard
          label="Georgia Power projects"
          value={formatCount(uniqueByUtility.gpc)}
          accent="georgia"
        />
        <StatCard
          label="Dominion (SC) projects"
          value={formatCount(uniqueByUtility.desc)}
          accent="dominion"
        />
        <StatCard
          label="Border-area projects"
          value={formatCount(borderProjectCount)}
          accent="dominion"
        />
        <StatCard
          label="Pilot cross-utility overlaps"
          value={formatCount(summary.totalOverlaps)}
          accent="green"
        />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <RegionalProjectMap
          geocodePoints={geocodePoints}
          geocodeMarkerColorBy="utility"
          title="SC & GA portfolio footprint"
        />
        <div className="flex min-h-[310px] flex-col gap-3">
          <div className="grid min-h-[150px] flex-1 grid-cols-2 gap-2 min-[901px]:gap-3">
            <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-0 flex-col")}>
              <div className={CLS_DASHBOARD_PANEL_HEADER}>Portfolio by utility (points)</div>
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={utilitySplit}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="68%"
                      {...CHART_PIE_SLICE_STROKE}
                    >
                      {utilitySplit.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(value) => [
                        `${value} points (${((Number(value) / geocodeSummary.totalPoints) * 100).toFixed(1)}%)`,
                      ]}
                    />
                    <Legend {...CHART_LEGEND_BOTTOM} formatter={pieLegendLabel} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-0 flex-col")}>
              <div className={CLS_DASHBOARD_PANEL_HEADER}>Border vs interior</div>
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={borderData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="42%"
                      outerRadius="68%"
                      {...CHART_PIE_SLICE_STROKE}
                    >
                      {borderData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(value) => [`${value} projects`]}
                    />
                    <Legend {...CHART_LEGEND_BOTTOM} formatter={pieLegendLabel} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
          <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[150px] flex-1 flex-col")}>
            <div className={CLS_DASHBOARD_PANEL_HEADER}>Work type (unique projects)</div>
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={workTypeData}
                  layout="vertical"
                  margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tick={CHART_AXIS_TICK}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={84}
                    tickLine={false}
                    axisLine={false}
                    tick={CHART_AXIS_TICK}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--surface-hover)" }}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  />
                  <Bar dataKey="count" fill="var(--accent)" maxBarSize={16} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>

      {/* ── Ranked coordination opportunities ── */}
      <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "mt-6")}>
        <div className={CLS_DASHBOARD_PANEL_HEADER}>Top coordination opportunities — ranked</div>
        <p className="m-0 mb-3 max-w-4xl text-[0.8125rem] leading-snug text-text-secondary">
          Each cross-utility overlap is scored 0–100 based on spatial proximity (closer = better ROW
          sharing) and schedule alignment (overlapping timelines = joint construction savings). The
          top-ranked pair includes a rough cost/impact estimate.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.8125rem]">
            <thead>
              <tr className="border-b-2 border-border-strong text-left">
                <th className={CLS_TH}>Rank</th>
                <th className={CLS_TH}>Score</th>
                <th className={CLS_TH}>Opportunity type</th>
                <th className={CLS_TH}>Dominion project</th>
                <th className={CLS_TH}>Georgia Power project</th>
                <th className={cn(CLS_TH, "text-right")}>Distance</th>
                <th className={cn(CLS_TH, "text-right")}>Time gap</th>
                <th className={cn(CLS_TH, "text-right")}>Est. savings</th>
              </tr>
            </thead>
            <tbody>
              {rankedOpportunities.map((opp) => (
                <tr
                  key={opp.overlap.id}
                  className={cn(
                    "border-b border-border last:border-b-0",
                    opp.rank === 1 && "bg-green-light/50",
                  )}
                >
                  <td className={cn(CLS_TD, "text-center")}>
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[0.6875rem] font-bold",
                        opp.rank === 1
                          ? "bg-green text-white"
                          : opp.rank <= 3
                            ? "bg-accent-light text-accent-text"
                            : "bg-surface-hover text-text-muted",
                      )}
                    >
                      {opp.rank}
                    </span>
                  </td>
                  <td className={CLS_TD}>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-12 overflow-hidden rounded-full bg-surface-hover">
                        <div
                          className="h-full rounded-full bg-green transition-all"
                          style={{ width: `${opp.score}%` }}
                        />
                      </div>
                      <span className="font-mono text-[0.6875rem] font-semibold text-text-primary">
                        {opp.score}
                      </span>
                    </div>
                  </td>
                  <td className={CLS_TD}>
                    <span
                      className={cn(
                        "inline-flex items-center whitespace-nowrap rounded-full border px-[0.45rem] py-[0.12rem] font-sans text-[10px] font-medium tracking-[0.01em]",
                        opp.type === "Joint construction"
                          ? "border-green/30 bg-green-light text-green"
                          : opp.type === "Shared ROW"
                            ? "border-accent/30 bg-accent-light text-accent-text"
                            : opp.type === "Shared substation"
                              ? "border-dominion/30 bg-dominion-light text-dominion"
                              : "border-border bg-surface-hover text-text-muted",
                      )}
                    >
                      {opp.type}
                    </span>
                  </td>
                  <td className={cn(CLS_TD, "max-w-[10rem] truncate text-text-primary")}>
                    <button
                      type="button"
                      className="cursor-pointer truncate border-none bg-transparent p-0 text-left text-[0.8125rem] font-medium text-accent-text hover:underline"
                      onClick={() => navigate(`/projects/${opp.overlap.projectIdA}`)}
                    >
                      {opp.overlap.projectNameA}
                    </button>
                  </td>
                  <td className={cn(CLS_TD, "max-w-[10rem] truncate text-text-primary")}>
                    <button
                      type="button"
                      className="cursor-pointer truncate border-none bg-transparent p-0 text-left text-[0.8125rem] font-medium text-accent-text hover:underline"
                      onClick={() => navigate(`/projects/${opp.overlap.projectIdB}`)}
                    >
                      {opp.overlap.projectNameB}
                    </button>
                  </td>
                  <td className={cn(CLS_TD, "text-right font-mono text-[0.6875rem] tabular-nums")}>
                    {formatMiles(opp.overlap.distanceMi)}
                  </td>
                  <td className={cn(CLS_TD, "text-right font-mono text-[0.6875rem] tabular-nums")}>
                    {opp.overlap.timeGapDays != null
                      ? `${opp.overlap.timeGapDays.toLocaleString()} d`
                      : "—"}
                  </td>
                  <td
                    className={cn(
                      CLS_TD,
                      "text-right font-mono text-[0.6875rem] font-semibold tabular-nums",
                      opp.costImpact.totalEstimatedSavings >= 1_000_000
                        ? "text-green"
                        : "text-text-primary",
                    )}
                  >
                    ${(opp.costImpact.totalEstimatedSavings / 1_000_000).toFixed(2)}M
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── #1 Opportunity deep dive ── */}
      {rankedOpportunities[0] && (
        <section
          className={cn(
            CLS_DASHBOARD_PANEL_SHELL,
            "mt-[0.85rem] border-green/40 bg-green-light/20",
          )}
        >
          <div className={cn(CLS_DASHBOARD_PANEL_HEADER, "flex items-center gap-2")}>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green font-mono text-[0.6875rem] font-bold text-white">
              1
            </span>
            Coordination spotlight — cost/impact estimate
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[0.8125rem]">
                <button
                  type="button"
                  className="cursor-pointer border-none bg-transparent p-0 font-semibold text-accent-text hover:underline"
                  onClick={() => navigate(`/projects/${rankedOpportunities[0].overlap.projectIdA}`)}
                >
                  {rankedOpportunities[0].overlap.projectNameA}
                </button>
                <span className="text-text-muted">↔</span>
                <button
                  type="button"
                  className="cursor-pointer border-none bg-transparent p-0 font-semibold text-accent-text hover:underline"
                  onClick={() => navigate(`/projects/${rankedOpportunities[0].overlap.projectIdB}`)}
                >
                  {rankedOpportunities[0].overlap.projectNameB}
                </button>
              </div>
              <p className="m-0 mb-3 text-[0.8125rem] leading-relaxed text-text-secondary">
                {rankedOpportunities[0].costImpact.explanation}
              </p>
              <p className={cn(CLS_DASHBOARD_PANEL_CAPTION, "italic")}>
                Estimates use conservative industry averages (FERC/EEI data for rural SE US). Actual
                savings depend on terrain, permitting, and negotiated land costs.
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-border bg-surface px-4 py-3">
              <div className="text-[0.8125rem] font-semibold uppercase tracking-widest text-text-muted">
                Savings breakdown
              </div>
              <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                <span className="text-text-secondary">Shared ROW corridor</span>
                <span className="font-mono font-semibold text-text-primary">
                  ~{rankedOpportunities[0].costImpact.sharedRowMiles.toFixed(1)} mi
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                <span className="text-text-secondary">ROW cost/mile</span>
                <span className="font-mono text-text-primary">
                  ${(rankedOpportunities[0].costImpact.rowCostPerMile / 1000).toFixed(0)}k
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                <span className="text-text-secondary">
                  Land savings ({(rankedOpportunities[0].costImpact.rowSavingsPct * 100).toFixed(0)}
                  % shared)
                </span>
                <span className="font-mono font-semibold text-green">
                  ${(rankedOpportunities[0].costImpact.estimatedSavings / 1000).toFixed(0)}k
                </span>
              </div>
              {rankedOpportunities[0].costImpact.mobilisationSavings > 0 && (
                <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                  <span className="text-text-secondary">Joint mobilisation</span>
                  <span className="font-mono font-semibold text-green">
                    ${(rankedOpportunities[0].costImpact.mobilisationSavings / 1000).toFixed(0)}k
                  </span>
                </div>
              )}
              <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-border pt-2 text-[0.8125rem]">
                <span className="font-semibold text-text-primary">Total estimated savings</span>
                <span className="font-mono text-[0.95rem] font-bold text-green">
                  $
                  {(rankedOpportunities[0].costImpact.totalEstimatedSavings / 1_000_000).toFixed(2)}
                  M
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "mt-[0.85rem]")}>
        <div className={CLS_DASHBOARD_PANEL_HEADER}>
          Pilot projects (quick view — {formatCount(summary.totalProjects)} curated)
        </div>
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

      {/* ── Portfolio analytics ── */}
      <div className="mb-3 mt-8 flex flex-col gap-1 border-t border-border pt-6">
        <h2 className={CLS_DASHBOARD_SECTION_TITLE}>Portfolio analytics</h2>
        <p className={CLS_DASHBOARD_INTRO}>
          Breakdown of {formatCount(geocodeSummary.uniqueProjects)} transmission projects across
          Dominion Energy SC and Georgia Power — voltage, work type, geography, and line-mile scale.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Voltage class donut */}
        <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[260px] flex-col")}>
          <div className={CLS_DASHBOARD_PANEL_HEADER}>Voltage class mix</div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={voltageData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="45%"
                  outerRadius="72%"
                  paddingAngle={3}
                  strokeWidth={0}
                  label={({
                    name,
                    percent,
                    x,
                    y,
                  }: {
                    name?: string;
                    percent?: number;
                    x?: number;
                    y?: number;
                  }) =>
                    x != null && y != null ? (
                      <text
                        x={x}
                        y={y}
                        fill="var(--text-secondary)"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={CHART_TICK_FONT_SIZE}
                      >
                        {`${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      </text>
                    ) : null
                  }
                  labelLine={{ stroke: "var(--text-muted)", strokeWidth: 1 }}
                >
                  {voltageData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value) => [`${value} projects`]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Line miles distribution */}
        <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[260px] flex-col")}>
          <div className={CLS_DASHBOARD_PANEL_HEADER}>Line miles distribution</div>
          <p className={CLS_DASHBOARD_PANEL_CAPTION}>
            How long are planned transmission line segments?
          </p>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={milesBuckets} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="bucket"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tick={CHART_AXIS_TICK}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  width={32}
                  tickLine={false}
                  axisLine={false}
                  tick={CHART_AXIS_TICK}
                />
                <Tooltip
                  cursor={{ fill: "var(--surface-hover)" }}
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value) => [`${value} points`, "Count"]}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                />
                <Bar dataKey="count" fill="var(--georgia)" maxBarSize={48} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "mt-3 flex min-h-[260px] flex-col")}>
        <div className={CLS_DASHBOARD_PANEL_HEADER}>Region by utility</div>
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regionByUtility} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="region"
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tick={CHART_AXIS_TICK}
                interval={0}
                tickFormatter={(v: string) => regionLabel(v)}
              />
              <YAxis
                allowDecimals={false}
                width={32}
                tickLine={false}
                axisLine={false}
                tick={CHART_AXIS_TICK}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-hover)" }}
                contentStyle={CHART_TOOLTIP_STYLE}
                labelFormatter={(label) => regionLabel(String(label))}
                labelStyle={CHART_TOOLTIP_LABEL_STYLE}
              />
              <Legend {...CHART_LEGEND_TOP} />
              <Bar
                dataKey="gpc"
                name="Georgia Power"
                stackId="a"
                fill="var(--georgia)"
                maxBarSize={48}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="desc"
                name="Dominion (SC)"
                stackId="a"
                fill="var(--dominion)"
                maxBarSize={48}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Utility split — small donut beside the overlap pairs */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_0.6fr]">
        <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[200px] flex-col")}>
          <div className={CLS_DASHBOARD_PANEL_HEADER}>Utility portfolio split (all points)</div>
          <div className="flex flex-1 items-center justify-center gap-6">
            <div className="h-[160px] w-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={utilitySplit}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="50%"
                    outerRadius="90%"
                    paddingAngle={4}
                    strokeWidth={0}
                  >
                    {utilitySplit.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value) => [
                      `${value} points (${((Number(value) / geocodeSummary.totalPoints) * 100).toFixed(1)}%)`,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className={cn("m-0 flex list-none flex-col gap-3 p-0", CLS_DASHBOARD_PANEL_BODY)}>
              {utilitySplit.map((u) => (
                <li key={u.name} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: u.fill }}
                  />
                  <span className="text-text-primary font-medium">{u.name}</span>
                  <span className="font-mono text-text-muted">{u.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[200px] flex-col")}>
          <div className={CLS_DASHBOARD_PANEL_HEADER}>Key metrics</div>
          <ul className={cn("m-0 flex list-none flex-col gap-[0.7rem] p-0", CLS_DASHBOARD_PANEL_BODY)}>
            <li className="flex items-baseline justify-between gap-2">
              <span className="text-text-secondary">Unique projects</span>
              <span className="font-mono font-semibold text-text-primary">
                {formatCount(geocodeSummary.uniqueProjects)}
              </span>
            </li>
            <li className="flex items-baseline justify-between gap-2">
              <span className="text-text-secondary">Total queue points</span>
              <span className="font-mono font-semibold text-text-primary">
                {formatCount(geocodeSummary.totalPoints)}
              </span>
            </li>
            <li className="flex items-baseline justify-between gap-2">
              <span className="text-text-secondary">Points with coordinates</span>
              <span className="font-mono font-semibold text-green">
                {formatPercent(geocodeSummary.locatedPct, 1)}
              </span>
            </li>
            <li className="flex items-baseline justify-between gap-2">
              <span className="text-text-secondary">Border-area projects</span>
              <span className="font-mono font-semibold text-dominion">{borderData[0].value}</span>
            </li>
            <li className="flex items-baseline justify-between gap-2">
              <span className="text-text-secondary">Pilot overlaps detected</span>
              <span className="font-mono font-semibold text-accent-text">
                {formatCount(summary.totalOverlaps)}
              </span>
            </li>
          </ul>
        </section>
      </div>

      {/* ── Geocode review queue ── */}
      <div className="mb-3 mt-8 flex flex-col gap-1 border-t border-border pt-6">
        <h2 className={CLS_DASHBOARD_SECTION_TITLE}>Geocode review queue</h2>
        <p className={CLS_DASHBOARD_INTRO}>
          Point-level locations extracted from utility project descriptions. Tasks progress from
          FIND → CONFIRM; confidence reflects how sure we are in lat/lon until field verification
          completes.
        </p>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4 min-[901px]:gap-3">
        <StatCard label="Queue points" value={formatCount(geocodeSummary.totalPoints)} />
        <StatCard
          label="With coordinates"
          value={formatPercent(geocodeSummary.locatedPct, 1)}
          accent="green"
        />
        <StatCard
          label="Still to locate (FIND)"
          value={formatCount(geocodeSummary.findRemaining)}
          accent="dominion"
        />
        <StatCard
          label="High confidence"
          value={formatCount(geocodeSummary.highConfidence)}
          accent="georgia"
        />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <RegionalProjectMap geocodePoints={geocodePoints} title="Coordinate verification map" />
        <div className="flex min-h-[310px] flex-col gap-3">
          <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[140px] flex-1 flex-col")}>
            <div className={CLS_DASHBOARD_PANEL_HEADER}>Review task backlog</div>
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={geocodeCharts.taskData}
                  layout="vertical"
                  margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tick={CHART_AXIS_TICK}
                  />
                  <YAxis
                    type="category"
                    dataKey="task"
                    width={64}
                    tickLine={false}
                    axisLine={false}
                    tick={CHART_AXIS_TICK}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--surface-hover)" }}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  />
                  <Bar dataKey="count" fill="var(--accent)" maxBarSize={20} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[140px] flex-1 flex-col")}>
            <div className={CLS_DASHBOARD_PANEL_HEADER}>Confidence mix</div>
            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={geocodeCharts.confidenceBars}
                  margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tick={CHART_AXIS_TICK}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={32}
                    tickLine={false}
                    axisLine={false}
                    tick={CHART_AXIS_TICK}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--surface-hover)" }}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  />
                  <Bar dataKey="count" maxBarSize={48} radius={[6, 6, 0, 0]}>
                    {geocodeCharts.confidenceBars.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[120px] flex-col")}>
            <div className={CLS_DASHBOARD_PANEL_HEADER}>Top regions</div>
            <div className="min-h-[100px] flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={geocodeCharts.regionData}
                  layout="vertical"
                  margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tick={CHART_AXIS_TICK}
                  />
                  <YAxis
                    type="category"
                    dataKey="region"
                    width={96}
                    tickLine={false}
                    axisLine={false}
                    tick={CHART_AXIS_TICK}
                    tickFormatter={(v: string) => regionLabel(v)}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--surface-hover)" }}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value) => [value, "Points"]}
                    labelFormatter={(label) => regionLabel(String(label))}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--georgia)"
                    maxBarSize={16}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>

      <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "mt-[0.85rem]")}>
        <div className={CLS_DASHBOARD_PANEL_HEADER}>
          Priority review (FIND & low confidence first)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.8125rem]">
            <thead>
              <tr className="border-b-2 border-border-strong text-left">
                <th className={CLS_TH}>Utility</th>
                <th className={CLS_TH}>Task</th>
                <th className={CLS_TH}>Confidence</th>
                <th className={CLS_TH}>Point</th>
                <th className={CLS_TH}>Region</th>
                <th className={cn(CLS_TH, "text-right")}>Lat</th>
                <th className={cn(CLS_TH, "text-right")}>Lon</th>
                <th className={cn(CLS_TH, "text-right")}>Links</th>
              </tr>
            </thead>
            <tbody>
              {reviewPriority.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-b-0">
                  <td className={CLS_TD}>
                    <UtilityBadge utilityKey={utilityKeyFromQueueCode(p.utility)} />
                  </td>
                  <td className={CLS_TD}>
                    <TaskBadge task={p.task} />
                  </td>
                  <td className={CLS_TD}>
                    <ConfidenceBadge confidence={p.confidence} />
                  </td>
                  <td
                    className={cn(CLS_TD, "max-w-[14rem] truncate text-text-primary")}
                    title={p.pointName}
                  >
                    {p.pointName}
                  </td>
                  <td className={CLS_TD}>{regionLabel(p.region)}</td>
                  <td className={cn(CLS_TD, "text-right font-mono text-[0.6875rem] tabular-nums")}>
                    {formatCoord(p.lat)}
                  </td>
                  <td className={cn(CLS_TD, "text-right font-mono text-[0.6875rem] tabular-nums")}>
                    {formatCoord(p.lon)}
                  </td>
                  <td className={cn(CLS_TD, "text-right")}>
                    {p.googleMapsUrl ? (
                      <a
                        href={p.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-text hover:underline"
                      >
                        Map
                      </a>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-2 text-[0.6875rem] text-text-muted">
          {formatCount(geocodeSummary.uniqueProjects)} distinct projects ·{" "}
          {formatCount(geocodeSummary.withCoordinates)} of {formatCount(geocodeSummary.totalPoints)}{" "}
          points have coordinates. Regenerate from CSV:{" "}
          <code className="font-mono text-[0.65rem]">bun run sync-review-queue</code>
        </p>
      </section>
    </div>
  );
}

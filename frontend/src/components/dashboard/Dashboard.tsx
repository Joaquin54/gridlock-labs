import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo } from "react";
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
import { useGridlockData } from "../../data/GridlockDataContext";
import {
  getBorderBreakdown,
  getGeocodeDashboardSummary,
  getUtilitySplit,
  getVoltageBreakdown,
  voltageClassLegendSortKey,
  getWorkTypeBreakdown,
} from "../../data/geocodeRepository";
import { utilityShortLabel } from "../../data/repository";
import { projectDetailPath } from "../../utils/routes";
import type { WorkType } from "../../types/project";
import {
  CHART_AXIS_TICK,
  CHART_LEGEND_BOTTOM,
  CHART_LEGEND_TOP,
  CHART_PIE_NO_FOCUS_RING,
  CHART_PIE_SLICE_STROKE,
  CHART_RECHARTS_PROPS,
  suppressRechartsPointerFocus,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
  CLS_DASHBOARD_PANEL_CAPTION,
  CLS_DASHBOARD_PANEL_HEADER,
  CLS_DASHBOARD_PANEL_SHELL,
} from "../../utils/chartStyles";
import { cn } from "../../utils/cn";
import {
  formatCount,
  formatDateLabel,
  formatMiles,
  formatPercent,
  formatUsdCompact,
  formatUsdRange,
} from "../../utils/format";
import StatCard from "../shared/StatCard";
import RegionalProjectMap from "./RegionalProjectMap";

const CLS_TH =
  "px-2 py-[0.36rem] text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-text-muted whitespace-nowrap";

const CLS_TD = "px-2 py-[0.42rem] text-[0.8125rem] text-text-secondary";

type PieLegendEntry = {
  payload?: { value?: number; count?: number };
};

function pieLegendLabel(value: string, entry: PieLegendEntry): ReactNode {
  const count = entry.payload?.count ?? entry.payload?.value;
  if (count == null) return value;
  return (
    <span>
      {value}
      {"  "}
      <span className="font-mono text-text-muted opacity-80">{formatCount(count)}</span>
    </span>
  );
}

type WorkTypeBarRow = { name: WorkType; gpc: number; desc: number };

function workTypeAxisLabel(label: string): string {
  if (!label) return label;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function workTypeBarRowFromClick(data: unknown): WorkTypeBarRow | undefined {
  if (!data || typeof data !== "object") return undefined;
  const withPayload = data as { payload?: Partial<WorkTypeBarRow> };
  const row = withPayload.payload ?? (data as Partial<WorkTypeBarRow>);
  if (!row.name || typeof row.name !== "string") return undefined;
  return row as WorkTypeBarRow;
}

function voltagePieLegendLabel(value: string, entry: PieLegendEntry): ReactNode {
  const count = entry.payload?.count ?? entry.payload?.value;
  if (count == null) return value;
  return (
    <span className="inline-flex flex-col items-start gap-0 leading-none">
      <span>{value}</span>
      <span className="font-mono text-[0.75rem] text-text-muted opacity-80">
        {formatCount(count)}
      </span>
    </span>
  );
}

export default function Dashboard() {
  useEffect(() => {
    document.addEventListener("mousedown", suppressRechartsPointerFocus, true);
    return () => document.removeEventListener("mousedown", suppressRechartsPointerFocus, true);
  }, []);

  const navigate = useNavigate();
  const {
    projects,
    queuePoints: geocodePoints,
    dashboardSummary: summary,
    rankedOpportunities,
    savingsTotals,
    savingsSpotlight,
  } = useGridlockData();
  const geocodeSummary = getGeocodeDashboardSummary(geocodePoints);

  const pilotProjectsWithOverlaps = useMemo(
    () =>
      projects
        .filter((p) => p.overlapCount > 0)
        .sort((a, b) => b.overlapCount - a.overlapCount),
    [projects],
  );

  const voltageData = getVoltageBreakdown(projects);
  const workTypeData = getWorkTypeBreakdown(projects);

  const openWorkTypeSearch = useCallback(
    (workType: WorkType) => {
      const params = new URLSearchParams();
      params.set("workType", workType);
      navigate(`/search?${params.toString()}`);
    },
    [navigate],
  );

  const handleWorkTypeBarClick = useCallback(
    (data: unknown) => {
      const row = workTypeBarRowFromClick(data);
      if (!row?.name) return;
      openWorkTypeSearch(row.name);
    },
    [openWorkTypeSearch],
  );
  const borderProjectCount = getBorderBreakdown(projects)[0]?.value ?? 0;
  const utilitySplit = getUtilitySplit(geocodePoints);

  return (
    <div className="flex w-full flex-col px-6 py-[1.1rem] max-[900px]:px-3 max-[900px]:py-3">
      <div className="mb-3 flex flex-col gap-1">
        <h1 className="m-0 text-[1.05rem] font-semibold leading-tight text-text-primary">
          Project Overlap Dashboard
        </h1>
        {/* <p className={CLS_DASHBOARD_INTRO}>
          Full GPC + Dominion SC portfolio from project listings and the geocode review queue (
          {formatCount(geocodeSummary.totalPoints)} location points). Pilot overlap analysis (
          {formatCount(summary.totalProjects)} curated projects,{" "}
          {formatCount(summary.totalOverlaps)} pairs) is summarized in the ranked table below.
        </p> */}
      </div>

      <div
        className={cn(
          "mb-3 grid grid-cols-2 gap-2 min-[901px]:gap-3",
          savingsTotals ? "lg:grid-cols-5" : "lg:grid-cols-4",
        )}
      >
        <StatCard
          label="Project point overlaps"
          value={formatCount(summary.totalOverlaps)}
          accent="green"
        />
        {savingsTotals && (
          <StatCard
            label="Coordination savings (headline)"
            value={formatUsdCompact(savingsTotals.headline.mid)}
            accent="green"
          />
        )}
        <StatCard label="Unique projects" value={formatCount(geocodeSummary.uniqueProjects)} />
        <StatCard label="Location points" value={formatCount(geocodeSummary.totalPoints)} />
        <StatCard
          label="Border-area projects"
          value={formatCount(borderProjectCount)}
          accent="dominion"
        />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <RegionalProjectMap
          geocodePoints={geocodePoints}
          geocodeMarkerColorBy="utility"
          title="SC & GA heatmap with project points"
          countyInteractivity={false}
          onSelectProject={(id) => navigate(projectDetailPath(id))}
        />
        <div className="flex min-h-[310px] flex-col gap-3">
          <div className="grid min-h-[210px] flex-1 grid-cols-1 gap-3 min-[901px]:grid-cols-2 min-[901px]:gap-3">
            <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[200px] flex-col")}>
              <div className={CLS_DASHBOARD_PANEL_HEADER}>Utility split</div>
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart
                    {...CHART_RECHARTS_PROPS}
                    margin={{ top: 0, right: 0, bottom: 2, left: 0 }}
                  >
                    <Pie
                      data={utilitySplit}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="100%"
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
                    <Legend
                      {...CHART_LEGEND_BOTTOM}
                      height={28}
                      wrapperStyle={{ ...CHART_LEGEND_BOTTOM.wrapperStyle, paddingTop: 8 }}
                      formatter={pieLegendLabel}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section
              className={cn(
                CLS_DASHBOARD_PANEL_SHELL,
                "flex min-h-[200px] flex-col [&_.recharts-legend-item]:!mr-1.5",
              )}
            >
              <div className={CLS_DASHBOARD_PANEL_HEADER}>Voltage class mix</div>
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart
                    {...CHART_RECHARTS_PROPS}
                    margin={{ top: 0, right: 0, bottom: 2, left: 0 }}
                  >
                    <Pie
                      data={voltageData}
                      dataKey="sliceValue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="100%"
                      {...CHART_PIE_SLICE_STROKE}
                    >
                      {voltageData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(_value, _name, item) => [
                        `${item.payload.count} projects`,
                      ]}
                    />
                    <Legend
                      {...CHART_LEGEND_BOTTOM}
                      height={28}
                      itemSorter={(item) => voltageClassLegendSortKey(String(item.value ?? ""))}
                      wrapperStyle={{
                        ...CHART_LEGEND_BOTTOM.wrapperStyle,
                        paddingTop: 4,
                        transform: "translateY(4px)",
                      }}
                      formatter={voltagePieLegendLabel}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
          <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[150px] flex-1 flex-col")}>
            <div className={CLS_DASHBOARD_PANEL_HEADER}>Work type statistics</div>
            <div className="min-h-0 flex-1 [&_.recharts-bar-rectangle]:cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  {...CHART_RECHARTS_PROPS}
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
                    width={108}
                    tickLine={false}
                    axisLine={false}
                    tick={CHART_AXIS_TICK}
                    tickFormatter={workTypeAxisLabel}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--surface-hover)" }}
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    labelFormatter={workTypeAxisLabel}
                  />
                  <Legend {...CHART_LEGEND_TOP} />
                  <Bar
                    dataKey="gpc"
                    name="Georgia Power"
                    fill="var(--map-utility-georgia)"
                    maxBarSize={10}
                    radius={[0, 3, 3, 0]}
                    onClick={handleWorkTypeBarClick}
                  />
                  <Bar
                    dataKey="desc"
                    name="Dominion (SC)"
                    fill="var(--map-utility-dominion)"
                    maxBarSize={10}
                    radius={[0, 3, 3, 0]}
                    onClick={handleWorkTypeBarClick}
                  />
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
          sharing) and schedule alignment (overlapping build windows).{" "}
          {savingsTotals
            ? `Sourced savings use the backend coordination model (S% × min(cost) × T × D) with a realistic headline total of ${formatUsdCompact(savingsTotals.headline.mid)} mid-case across non-overlapping pairs.`
            : "Est. savings use a rough ROW heuristic until the savings API is available."}
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
                      onClick={() => navigate(projectDetailPath(opp.overlap.projectIdA))}
                    >
                      {opp.overlap.projectNameA}
                    </button>
                  </td>
                  <td className={cn(CLS_TD, "max-w-[10rem] truncate text-text-primary")}>
                    <button
                      type="button"
                      className="cursor-pointer truncate border-none bg-transparent p-0 text-left text-[0.8125rem] font-medium text-accent-text hover:underline"
                      onClick={() => navigate(projectDetailPath(opp.overlap.projectIdB))}
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
                    {opp.costImpact.sourced ? (
                      <span className="block">
                        {formatUsdCompact(opp.costImpact.sourced.savingsMid)}
                        <span className="block text-[0.625rem] font-normal text-text-muted">
                          {formatUsdRange(
                            opp.costImpact.sourced.savingsLow,
                            opp.costImpact.sourced.savingsHigh,
                          )}
                        </span>
                      </span>
                    ) : (
                      formatUsdCompact(opp.costImpact.totalEstimatedSavings)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── #1 Opportunity deep dive ── */}
      {savingsSpotlight && (
        <section
          className={cn(
            CLS_DASHBOARD_PANEL_SHELL,
            "mt-[0.85rem] border-green/40 bg-green-light/20",
          )}
        >
          <div className={cn(CLS_DASHBOARD_PANEL_HEADER, "flex flex-wrap items-center gap-2")}>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green font-mono text-[0.6875rem] font-bold text-white">
              $
            </span>
            Coordination spotlight — sourced cost/impact estimate
            {savingsSpotlight.costImpact.sourced?.overlapId && (
              <span className="font-mono text-[0.6875rem] font-normal text-text-muted">
                {savingsSpotlight.costImpact.sourced.overlapId}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[0.8125rem]">
                <button
                  type="button"
                  className="cursor-pointer border-none bg-transparent p-0 font-semibold text-accent-text hover:underline"
                  onClick={() =>
                    navigate(projectDetailPath(savingsSpotlight.overlap.projectIdA))
                  }
                >
                  {savingsSpotlight.overlap.projectNameA}
                </button>
                <span className="text-text-muted">↔</span>
                <button
                  type="button"
                  className="cursor-pointer border-none bg-transparent p-0 font-semibold text-accent-text hover:underline"
                  onClick={() =>
                    navigate(projectDetailPath(savingsSpotlight.overlap.projectIdB))
                  }
                >
                  {savingsSpotlight.overlap.projectNameB}
                </button>
              </div>
              <p className="m-0 mb-3 text-[0.8125rem] leading-relaxed text-text-secondary">
                {savingsSpotlight.costImpact.explanation}
              </p>
              <p className={cn(CLS_DASHBOARD_PANEL_CAPTION, "italic")}>
                {savingsSpotlight.costImpact.sourced
                  ? "Method: S% (MISO MTEP mobilization + construction management, plus conditional components) × min(DESC cost, estimated GPC cost) × schedule factor T × distance factor D. GPC costs are estimated from DESC unit rates where IRP figures are redacted."
                  : "Estimates use conservative industry averages (FERC/EEI data for rural SE US). Actual savings depend on terrain, permitting, and negotiated land costs."}
              </p>
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-border bg-surface px-4 py-3">
              <div className="text-[0.8125rem] font-semibold uppercase tracking-widest text-text-muted">
                Savings breakdown
              </div>
              {savingsSpotlight.costImpact.sourced ? (
                <>
                  <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                    <span className="text-text-secondary">Schedule factor (T)</span>
                    <span className="font-mono font-semibold text-text-primary">
                      {savingsSpotlight.costImpact.sourced.scheduleT}
                      <span className="ml-1 font-sans font-normal text-text-muted">
                        ({savingsSpotlight.costImpact.sourced.windowGapDays.toLocaleString()} d window
                        gap)
                      </span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                    <span className="text-text-secondary">Distance factor (D)</span>
                    <span className="font-mono text-text-primary">
                      {savingsSpotlight.costImpact.sourced.distanceD.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                    <span className="text-text-secondary">Shareable overhead (S% mid)</span>
                    <span className="font-mono text-text-primary">
                      {savingsSpotlight.costImpact.sourced.sPctMid}%
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                    <span className="text-text-secondary">Binding project cost (mid)</span>
                    <span className="font-mono text-text-primary">
                      {formatUsdCompact(
                        Math.min(
                          savingsSpotlight.costImpact.sourced.costDesc,
                          savingsSpotlight.costImpact.sourced.costGpcMid,
                        ),
                      )}
                    </span>
                  </div>
                  <p className="m-0 text-[0.75rem] leading-snug text-text-muted">
                    {savingsSpotlight.costImpact.sourced.components.replace(/_/g, " ")} ·{" "}
                    {savingsSpotlight.costImpact.sourced.costMethod}
                  </p>
                  <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-border pt-2 text-[0.8125rem]">
                    <span className="font-semibold text-text-primary">Coordination savings (mid)</span>
                    <span className="font-mono text-[0.95rem] font-bold text-green">
                      {formatUsdCompact(savingsSpotlight.costImpact.sourced.savingsMid)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 text-[0.75rem] text-text-muted">
                    <span>Low – high band</span>
                    <span className="font-mono tabular-nums">
                      {formatUsdRange(
                        savingsSpotlight.costImpact.sourced.savingsLow,
                        savingsSpotlight.costImpact.sourced.savingsHigh,
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                    <span className="text-text-secondary">Shared ROW corridor</span>
                    <span className="font-mono font-semibold text-text-primary">
                      ~{savingsSpotlight.costImpact.sharedRowMiles.toFixed(1)} mi
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-border pt-2 text-[0.8125rem]">
                    <span className="font-semibold text-text-primary">Total estimated savings</span>
                    <span className="font-mono text-[0.95rem] font-bold text-green">
                      {formatUsdCompact(savingsSpotlight.costImpact.totalEstimatedSavings)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "mt-[0.85rem]")}>
        <div className={CLS_DASHBOARD_PANEL_HEADER}>
          Project overlaps list
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
              {pilotProjectsWithOverlaps.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-b border-border transition-[background] duration-100 last:border-b-0 hover:bg-surface-hover"
                  onClick={() => navigate(projectDetailPath(p.id))}
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

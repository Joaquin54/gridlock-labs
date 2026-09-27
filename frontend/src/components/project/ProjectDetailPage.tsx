import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { workTypeForProject } from "../../data/geocodeRepository";
import { useGridlockData } from "../../data/GridlockDataContext";
import { savingsPairKey, utilityShortLabel } from "../../data/repository";
import type { GridlockProject, ProjectOverlap } from "../../types/project";
import {
  CLS_DASHBOARD_PANEL_HEADER,
  CLS_DASHBOARD_PANEL_SHELL,
  CLS_PANEL_ITEM,
  CLS_PANEL_ITEM_INTERACTIVE,
  CLS_PANEL_ITEM_META,
} from "../../utils/chartStyles";
import { cn } from "../../utils/cn";
import {
  formatCoord,
  formatDateLabel,
  formatDays,
  formatHumanLabel,
  formatMiles,
  formatProjectCost,
  formatUsdCompact,
  formatUsdRange,
} from "../../utils/format";
import { projectDetailPath } from "../../utils/routes";
import RegionalProjectMap from "../dashboard/RegionalProjectMap";
import UtilityBadge from "../shared/UtilityBadge";

const CLS_FIELD_LABEL = "m-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted";

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
      <span className="shrink-0 text-text-secondary">{label}</span>
      <span
        className={cn(
          "text-right text-text-primary",
          mono && "font-mono text-[0.75rem] tabular-nums",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function EndpointBlock({
  title,
  endpoint,
}: {
  title: string;
  endpoint: { label: string | null; lat: number | null; lon: number | null };
}) {
  const pending = endpoint.lat == null || endpoint.lon == null;
  return (
    <div className="rounded-md border border-border bg-bg px-3 py-2.5">
      <p className={CLS_FIELD_LABEL}>{title}</p>
      <p className="m-0 mt-1.5 text-[0.8125rem] font-medium leading-snug text-text-primary">
        {endpoint.label?.trim() || "—"}
      </p>
      <p className="m-0 mt-1.5 font-mono text-[0.6875rem] leading-none text-text-secondary">
        {pending ? (
          <span className="text-amber-700 dark:text-amber-300">Coordinates pending</span>
        ) : (
          <>
            {formatCoord(endpoint.lat)}, {formatCoord(endpoint.lon)}
          </>
        )}
      </p>
    </div>
  );
}

function workTypeLabel(project: GridlockProject): string {
  const classified = workTypeForProject(project);
  if (classified) return classified;
  return formatHumanLabel(project.workTypeRaw);
}

function getMapProjectsAndPosition(
  project: GridlockProject,
  linked: GridlockProject[],
): {
  mapProjects: GridlockProject[];
  initialPosition: { coordinates: [number, number]; zoom: number };
} {
  const seen = new Set<string>([project.id]);
  const all: GridlockProject[] = [project];
  for (const lp of linked) {
    if (!seen.has(lp.id)) {
      seen.add(lp.id);
      all.push(lp);
    }
  }

  const hasCenter = project.center.lat != null && project.center.lon != null;
  const coordinates: [number, number] = hasCenter
    ? [project.center.lon as number, project.center.lat as number]
    : [-82.25, 32.85];
  const zoom = hasCenter ? 30 : 6.25;

  return { mapProjects: all, initialPosition: { coordinates, zoom } };
}

function overlapSavingsKey(o: ProjectOverlap): string {
  return savingsPairKey(o.projectIdA, o.projectIdB);
}

export default function ProjectDetailPage() {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const projectId = projectIdParam ? decodeURIComponent(projectIdParam) : undefined;
  const navigate = useNavigate();
  const { getProject, overlapsForProject, linkedProjects, savingsByPair } = useGridlockData();
  const project = projectId ? getProject(projectId) : undefined;

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <strong className="text-[15px] text-text-secondary">Project not found</strong>
        <Link to="/search" className="mt-2 text-[0.8125rem] text-accent-text">
          Back to search
        </Link>
      </div>
    );
  }

  const overlaps = [...overlapsForProject(project.id)].sort(
    (a, b) => (a.distanceMi ?? 99) - (b.distanceMi ?? 99),
  );
  const linked = linkedProjects(project);
  const { mapProjects, initialPosition } = getMapProjectsAndPosition(project, linked);
  const costLabel = formatProjectCost(project.costUsd, project.costLow, project.costHigh);
  const hasPublishedCost = project.costUsd != null;

  return (
    <div className="flex w-full flex-col pb-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-3 inline-flex w-fit cursor-pointer items-center gap-[0.4rem] rounded-sm border border-border bg-surface-hover px-[0.65rem] py-[0.3rem] text-[12px] font-medium text-text-secondary transition-[color,border-color,background] duration-150 hover:border-border-strong hover:bg-surface hover:text-text-primary"
      >
        ← Back
      </button>

      <header className="mb-3 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[0.6875rem] leading-none text-text-muted">
          <UtilityBadge utilityKey={project.utilityKey} />
          <span>{project.id}</span>
          {project.projectKey && project.projectKey !== project.id && (
            <>
              <span className="text-border-strong" aria-hidden>·</span>
              <span>{project.projectKey}</span>
            </>
          )}
          <span className="text-border-strong" aria-hidden>·</span>
          <span>{project.state}</span>
          {project.isBorder && (
            <>
              <span className="text-border-strong" aria-hidden>·</span>
              <span className="text-dominion">Border corridor</span>
            </>
          )}
        </div>
        <h1 className="m-0 text-[1.35rem] font-semibold leading-tight text-text-primary">
          {project.name}
        </h1>
        <p className="m-0 text-[0.8125rem] leading-snug text-text-secondary">
          {project.utility}
          {project.status ? ` · ${formatHumanLabel(project.status)}` : ""}
          {" · "}
          In service {formatDateLabel(project.inServiceDate)}
        </p>
      </header>

      {project.description?.trim() && (
        <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "mb-3")}>
          <div className={CLS_DASHBOARD_PANEL_HEADER}>Description</div>
          <p className="m-0 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-text-secondary">
            {project.description.trim()}
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <RegionalProjectMap
          key={project.id}
          projects={mapProjects}
          selectedProjectId={project.id}
          onSelectProject={(id) => {
            if (id !== project.id) navigate(projectDetailPath(id));
          }}
          title={`${project.name} — overlap footprint`}
          initialPosition={initialPosition}
        />

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-surface px-4 py-[0.9rem] text-center">
              <div className="font-mono text-[1.45rem] font-bold leading-[1.2] text-accent">
                {project.overlapCount}
              </div>
              <div className="mt-[0.375rem] text-[0.8125rem] leading-tight text-text-secondary">
                Overlaps
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface px-4 py-[0.9rem] text-center">
              <div className="font-mono text-[1.05rem] font-bold leading-[1.2] text-text-primary">
                {project.voltageKv != null ? `${project.voltageKv} kV` : "—"}
              </div>
              <div className="mt-[0.375rem] text-[0.8125rem] leading-tight text-text-secondary">
                Voltage
              </div>
            </div>
            <div className="col-span-2 rounded-lg border border-border bg-surface px-4 py-[0.9rem] text-center sm:col-span-1">
              <div className="font-mono text-[1.05rem] font-bold leading-[1.2] text-green">
                {costLabel}
              </div>
              <div className="mt-[0.375rem] text-[0.8125rem] leading-tight text-text-secondary">
                {hasPublishedCost ? "Published cost" : "Estimated cost"}
              </div>
            </div>
          </div>

          <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex flex-col gap-2")}>
            <div className={cn(CLS_DASHBOARD_PANEL_HEADER, "mb-0")}>Schedule & scope</div>
            <DetailRow label="Start date" value={formatDateLabel(project.startDate)} mono />
            {project.startDateSource && (
              <DetailRow
                label="Start date source"
                value={formatHumanLabel(project.startDateSource)}
              />
            )}
            <DetailRow label="In-service date" value={formatDateLabel(project.inServiceDate)} mono />
            {project.inServiceRaw && project.inServiceRaw !== project.inServiceDate && (
              <DetailRow label="In-service (raw)" value={project.inServiceRaw} mono />
            )}
            <DetailRow label="Line length" value={formatMiles(project.lineMiles)} mono />
            {project.milesSource && (
              <DetailRow label="Miles source" value={formatHumanLabel(project.milesSource)} />
            )}
            <DetailRow label="Work type" value={workTypeLabel(project)} />
            {project.projectType && (
              <DetailRow label="Project type" value={formatHumanLabel(project.projectType)} />
            )}
            {project.zone && <DetailRow label="Zone" value={project.zone} />}
            <DetailRow label="Owner" value={project.owner} />
            <DetailRow
              label="In overlap scope"
              value={project.ownerInScope ? "Yes" : "No"}
            />
          </section>

          <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex flex-col gap-2")}>
            <div className={cn(CLS_DASHBOARD_PANEL_HEADER, "mb-0")}>Location quality</div>
            <DetailRow
              label="Located"
              value={project.located ? "Yes" : "No"}
            />
            <DetailRow
              label="Location confidence"
              value={formatHumanLabel(project.locationConfidence)}
            />
            <DetailRow
              label="Points geocoded"
              value={`${project.pointsLocated} / ${project.pointsTotal}`}
              mono
            />
            <DetailRow
              label="Map center"
              value={
                project.center.lat != null && project.center.lon != null
                  ? `${formatCoord(project.center.lat)}, ${formatCoord(project.center.lon)}`
                  : "Pending"
              }
              mono
            />
          </section>

          <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex flex-col gap-2")}>
            <div className={cn(CLS_DASHBOARD_PANEL_HEADER, "mb-0")}>Source</div>
            <DetailRow label="Document" value={project.sourceDoc} />
            <DetailRow label="Page" value={String(project.sourcePage)} mono />
            {!hasPublishedCost && project.utilityKey === "georgia-power" && (
              <p className="m-0 text-[0.75rem] leading-snug text-text-muted">
                GPC capital costs are often redacted in the IRP; per-pair coordination savings on
                overlaps use DESC unit-rate estimates where needed.
              </p>
            )}
          </section>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EndpointBlock title="Endpoint A" endpoint={project.endpointA} />
            <EndpointBlock title="Endpoint B" endpoint={project.endpointB} />
          </div>
        </div>
      </div>

      {project.points.length > 0 && (
        <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "mt-3")}>
          <div className={CLS_DASHBOARD_PANEL_HEADER}>
            Location points ({project.points.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[0.8125rem]">
              <thead>
                <tr className="border-b border-border text-left text-[0.6875rem] uppercase tracking-wide text-text-muted">
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Name</th>
                  <th className="px-2 py-1.5">Coordinates</th>
                  <th className="px-2 py-1.5">Method</th>
                  <th className="px-2 py-1.5">Confidence</th>
                  <th className="px-2 py-1.5">Match</th>
                </tr>
              </thead>
              <tbody>
                {project.points.map((pt) => {
                  const pending = pt.lat == null || pt.lon == null;
                  return (
                    <tr key={pt.seq} className="border-b border-border last:border-b-0">
                      <td className="px-2 py-1.5 font-mono text-[0.6875rem]">{pt.seq}</td>
                      <td className="px-2 py-1.5 font-medium text-text-primary">{pt.name}</td>
                      <td className="px-2 py-1.5 font-mono text-[0.6875rem] text-text-secondary">
                        {pending ? "Pending" : `${formatCoord(pt.lat)}, ${formatCoord(pt.lon)}`}
                      </td>
                      <td className="px-2 py-1.5 text-text-secondary">
                        {formatHumanLabel(pt.method)}
                      </td>
                      <td className="px-2 py-1.5 capitalize text-text-secondary">{pt.confidence}</td>
                      <td className="px-2 py-1.5 text-text-secondary">
                        {pt.matchName ? (
                          <span>
                            {pt.matchName}
                            {pt.matchScore != null && (
                              <span className="ml-1 font-mono text-[0.6875rem] text-text-muted">
                                ({pt.matchScore.toFixed(2)})
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                        {pt.sourceUrl && (
                          <a
                            href={pt.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 text-[0.6875rem] text-accent-text hover:underline"
                          >
                            OSM
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "mt-3")}>
        <div className={CLS_DASHBOARD_PANEL_HEADER}>
          Cross-utility overlaps ({overlaps.length})
        </div>
        {overlaps.length === 0 ? (
          <p className="m-0 py-4 text-center text-[0.8125rem] text-text-muted">
            No overlap pairs for this project.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {overlaps.map((o) => {
              const otherId = o.projectIdA === project.id ? o.projectIdB : o.projectIdA;
              const otherName = o.projectIdA === project.id ? o.projectNameB : o.projectNameA;
              const otherUtility = o.projectIdA === project.id ? o.utilityB : o.utilityA;
              const sourced = savingsByPair.get(overlapSavingsKey(o));
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className={cn(
                      CLS_PANEL_ITEM,
                      CLS_PANEL_ITEM_INTERACTIVE,
                      "block w-full text-left",
                    )}
                    onClick={() => navigate(projectDetailPath(otherId))}
                  >
                    <div className={CLS_PANEL_ITEM_META}>
                      <span>{formatMiles(o.distanceMi)}</span>
                      {o.pairConfidence && (
                        <>
                          <span className="text-border-strong" aria-hidden>·</span>
                          <span className="capitalize">{o.pairConfidence} confidence</span>
                        </>
                      )}
                      {o.borderline && (
                        <>
                          <span className="text-border-strong" aria-hidden>·</span>
                          <span className="text-amber-700 dark:text-amber-300">Borderline</span>
                        </>
                      )}
                    </div>
                    <span className="mt-1.5 block text-[0.8125rem] font-medium leading-snug text-text-primary">
                      {otherName}
                    </span>
                    <span className="mt-0.5 block text-[0.6875rem] text-text-muted">
                      {otherUtility}
                    </span>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-text-secondary">
                      <span>
                        Window gap:{" "}
                        <span className="font-mono text-text-primary">
                          {o.windowGapDays != null ? formatDays(o.windowGapDays) : "—"}
                        </span>
                      </span>
                      <span>
                        In-service gap:{" "}
                        <span className="font-mono text-text-primary">
                          {o.inServiceGapDays != null ? formatDays(o.inServiceGapDays) : "—"}
                        </span>
                      </span>
                    </div>
                    {o.sharedAssets && o.sharedAssets.length > 0 && (
                      <p className="m-0 mt-1.5 text-[0.6875rem] leading-snug text-text-muted">
                        Shared assets: {o.sharedAssets.join("; ")}
                      </p>
                    )}
                    {sourced && (
                      <p className="m-0 mt-1.5 text-[0.75rem] leading-snug">
                        <span className="text-text-secondary">Coordination savings (mid): </span>
                        <span className="font-mono font-semibold text-green">
                          {formatUsdCompact(sourced.savingsMid)}
                        </span>
                        <span className="ml-1 font-mono text-[0.6875rem] text-text-muted">
                          ({formatUsdRange(sourced.savingsLow, sourced.savingsHigh)})
                        </span>
                        {sourced.inRealisticHeadline && (
                          <span className="ml-1 text-[0.6875rem] text-green">· headline pair</span>
                        )}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

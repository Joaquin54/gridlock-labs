import { Link, useNavigate, useParams } from "react-router-dom";
import { useGridlockData } from "../../data/GridlockDataContext";
import { utilityShortLabel } from "../../data/repository";
import type { GridlockProject } from "../../types/project";
import {
  CLS_DASHBOARD_PANEL_HEADER,
  CLS_DASHBOARD_PANEL_SHELL,
  CLS_PANEL_ITEM,
  CLS_PANEL_ITEM_INTERACTIVE,
  CLS_PANEL_ITEM_META,
} from "../../utils/chartStyles";
import { cn } from "../../utils/cn";
import { formatCoord, formatDateLabel, formatDays, formatMiles } from "../../utils/format";
import { projectDetailPath } from "../../utils/routes";
import RegionalProjectMap from "../dashboard/RegionalProjectMap";
import UtilityBadge from "../shared/UtilityBadge";

const CLS_FIELD_LABEL = "m-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted";

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

export default function ProjectDetailPage() {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const projectId = projectIdParam ? decodeURIComponent(projectIdParam) : undefined;
  const navigate = useNavigate();
  const { getProject, overlapsForProject, linkedProjects } = useGridlockData();
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

  const overlaps = overlapsForProject(project.id);
  const linked = linkedProjects(project);
  const { mapProjects, initialPosition } = getMapProjectsAndPosition(project, linked);

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
          <span className="text-border-strong" aria-hidden>
            ·
          </span>
          <span>{project.state}</span>
        </div>
        <h1 className="m-0 text-[1.35rem] font-semibold leading-tight text-text-primary">
          {project.name}
        </h1>
        <p className="m-0 text-[0.8125rem] leading-snug text-text-secondary">
          {project.utility} · In service {formatDateLabel(project.inServiceDate)}
        </p>
      </header>

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
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-surface px-4 py-[0.9rem] text-center">
              <div className="font-mono text-[1.45rem] font-bold leading-[1.2] text-accent">
                {project.overlapCount}
              </div>
              <div className="mt-[0.375rem] text-[0.8125rem] leading-tight text-text-secondary">
                Overlaps
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface px-4 py-[0.9rem] text-center">
              <div className="font-mono text-[1.45rem] font-bold leading-[1.2] text-text-primary">
                {project.state}
              </div>
              <div className="mt-[0.375rem] text-[0.8125rem] leading-tight text-text-secondary">
                State
              </div>
            </div>
          </div>

          <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex flex-col gap-2.5")}>
            <div className={cn(CLS_DASHBOARD_PANEL_HEADER, "mb-0")}>Project details</div>
            <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
              <span className="text-text-secondary">Utility</span>
              <span className="font-medium text-text-primary">
                {utilityShortLabel(project.utilityKey)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
              <span className="text-text-secondary">In-service date</span>
              <span className="font-mono text-text-primary">
                {formatDateLabel(project.inServiceDate)}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
              <span className="text-text-secondary">Map center</span>
              <span className="font-mono text-[0.75rem] text-text-primary">
                {project.center.lat != null && project.center.lon != null
                  ? `${formatCoord(project.center.lat)}, ${formatCoord(project.center.lon)}`
                  : "Pending"}
              </span>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EndpointBlock title="Endpoint A" endpoint={project.endpointA} />
            <EndpointBlock title="Endpoint B" endpoint={project.endpointB} />
          </div>

          <section className={CLS_DASHBOARD_PANEL_SHELL}>
            <div className={CLS_DASHBOARD_PANEL_HEADER}>
              Cross-utility overlap records ({overlaps.length})
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
                          <span>{o.id}</span>
                          <span className="text-border-strong" aria-hidden>
                            ·
                          </span>
                          <span>{formatMiles(o.distanceMi)}</span>
                          <span className="text-border-strong" aria-hidden>
                            ·
                          </span>
                          <span>{formatDays(o.timeGapDays)}</span>
                        </div>
                        <span className="mt-1.5 block text-[0.8125rem] font-medium leading-snug text-text-primary">
                          {otherName}
                        </span>
                        <span className="mt-0.5 block text-[0.6875rem] text-text-muted">
                          {otherUtility}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

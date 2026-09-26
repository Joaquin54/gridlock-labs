import { Link, useNavigate, useParams } from "react-router-dom";
import { getLinkedProjects, getOverlapsForProject, getProjectById } from "../../data/repository";
import { CLS_DASHBOARD_PANEL_HEADER, CLS_DASHBOARD_PANEL_SHELL } from "../../utils/chartStyles";
import { formatCoord, formatDateLabel, formatDays, formatMiles } from "../../utils/format";
import RegionalProjectMap from "../dashboard/RegionalProjectMap";
import UtilityBadge from "../shared/UtilityBadge";

function EndpointBlock({
  title,
  endpoint,
}: {
  title: string;
  endpoint: { label: string | null; lat: number | null; lon: number | null };
}) {
  const pending = endpoint.lat == null || endpoint.lon == null;
  return (
    <div className="rounded-md border border-border bg-bg p-3">
      <p className="m-0 text-[0.72rem] uppercase tracking-wide text-text-muted">{title}</p>
      <p className="m-0 mt-1 font-medium text-text-primary">{endpoint.label?.trim() || "—"}</p>
      <p className="m-0 mt-2 text-[0.82rem] text-text-secondary font-mono">
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

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const project = projectId ? getProjectById(projectId) : undefined;

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-text-secondary font-medium">Project not found</p>
        <Link to="/search" className="text-accent text-sm mt-2 inline-block">
          Back to search
        </Link>
      </div>
    );
  }

  const overlaps = getOverlapsForProject(project.id);
  const linked = getLinkedProjects(project);

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="text-sm text-accent bg-transparent border-none cursor-pointer p-0 hover:underline"
      >
        ← Back
      </button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <UtilityBadge utilityKey={project.utilityKey} />
          <span className="font-mono text-sm text-text-muted">{project.id}</span>
          <span className="text-sm text-text-muted">{project.state}</span>
        </div>
        <h1 className="text-2xl font-semibold m-0 text-text-primary">{project.name}</h1>
        <p className="text-sm text-text-secondary m-0">
          {project.utility} · In service {formatDateLabel(project.inServiceDate)}
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface border border-border rounded-lg px-3 py-2">
          <p className="m-0 text-[0.72rem] uppercase text-text-muted">Overlaps</p>
          <p className="m-0 text-xl font-semibold">{project.overlapCount}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg px-3 py-2 col-span-2 sm:col-span-3">
          <p className="m-0 text-[0.72rem] uppercase text-text-muted">Map center</p>
          <p className="m-0 font-mono text-sm">
            {project.center.lat != null && project.center.lon != null
              ? `${formatCoord(project.center.lat)}, ${formatCoord(project.center.lon)}`
              : "Pending"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <EndpointBlock title="Endpoint A" endpoint={project.endpointA} />
        <EndpointBlock title="Endpoint B" endpoint={project.endpointB} />
      </div>

      <RegionalProjectMap
        projects={[project]}
        selectedProjectId={project.id}
        onSelectProject={() => undefined}
      />

      <section className={CLS_DASHBOARD_PANEL_SHELL}>
        <header className={CLS_DASHBOARD_PANEL_HEADER}>Cross-utility overlap records</header>
        {overlaps.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-muted m-0">
            No overlap pairs for this project.
          </p>
        ) : (
          <ul className="m-0 p-0 list-none divide-y divide-border">
            {overlaps.map((o) => {
              const otherId = o.projectIdA === project.id ? o.projectIdB : o.projectIdA;
              const otherName = o.projectIdA === project.id ? o.projectNameB : o.projectNameA;
              return (
                <li key={o.id} className="px-4 py-3">
                  <div className="flex flex-wrap gap-3 text-[0.78rem] text-text-muted font-mono">
                    <span>{o.id}</span>
                    <span>{formatMiles(o.distanceMi)}</span>
                    <span>{formatDays(o.timeGapDays)}</span>
                  </div>
                  <button
                    type="button"
                    className="mt-1 text-sm text-accent font-medium bg-transparent border-none cursor-pointer p-0 hover:underline text-left"
                    onClick={() => navigate(`/projects/${otherId}`)}
                  >
                    Paired with: {otherName}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {linked.length > 0 ? (
        <section className={CLS_DASHBOARD_PANEL_SHELL}>
          <header className={CLS_DASHBOARD_PANEL_HEADER}>Linked projects (sheet references)</header>
          <ul className="m-0 p-0 list-none divide-y divide-border">
            {linked.map((lp) => (
              <li key={lp.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${lp.id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-surface-hover bg-transparent border-none cursor-pointer"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <UtilityBadge utilityKey={lp.utilityKey} />
                    <span className="font-mono text-[0.72rem] text-text-muted">{lp.id}</span>
                  </div>
                  <span className="text-sm text-text-primary">{lp.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

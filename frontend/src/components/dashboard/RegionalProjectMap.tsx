import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import type { GridlockProject } from "../../types/project";
import { CLS_DASHBOARD_PANEL_HEADER, CLS_DASHBOARD_PANEL_SHELL } from "../../utils/chartStyles";
import { cn } from "../../utils/cn";
import UtilityBadge from "../shared/UtilityBadge";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const HIGHLIGHT_STATES = new Set(["South Carolina", "Georgia"]);

/** Zoom/center tuned for SC + GA while keeping the full US in frame (geoAlbersUsa). */
const MAP_CENTER: [number, number] = [-82.25, 32.85];
const MAP_ZOOM = 6;

const MARKER_RADIUS = 2;
const MARKER_RADIUS_ACTIVE = 2.75;

type RegionalProjectMapProps = {
  projects: GridlockProject[];
  onSelectProject?: (projectId: string) => void;
  selectedProjectId?: string | null;
};

export default function RegionalProjectMap({
  projects,
  onSelectProject,
  selectedProjectId,
}: RegionalProjectMapProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const mappable = useMemo(
    () =>
      projects.filter(
        (p) => p.center.lat != null && p.center.lon != null && !Number.isNaN(p.center.lat),
      ),
    [projects],
  );

  return (
    <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[380px] flex-col")}>
      <div className={CLS_DASHBOARD_PANEL_HEADER}>SC &amp; GA project footprint</div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative w-full flex-1 min-h-[310px] max-h-[500px] bg-accent-light/40 dark:bg-surface-hover rounded-md overflow-hidden">
          <ComposableMap
            projection="geoAlbersUsa"
            width={800}
            height={600}
            style={{ width: "100%", height: "100%" }}
          >
            <ZoomableGroup center={MAP_CENTER} zoom={MAP_ZOOM}>
              <Geographies geography={GEO_URL}>
                {({
                  geographies,
                }: {
                  geographies: Array<{ rsmKey: string; properties: { name?: string } }>;
                }) =>
                  geographies.map((geo) => {
                    const name = geo.properties.name ?? "";
                    const highlighted = HIGHLIGHT_STATES.has(name);
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={highlighted ? "#c8e6c9" : "#e8edf5"}
                        stroke="#94a3b8"
                        strokeWidth={highlighted ? 0.8 : 0.35}
                        style={{
                          default: { outline: "none" },
                          hover: { outline: "none", fill: highlighted ? "#a5d6a7" : "#dde4f0" },
                          pressed: { outline: "none" },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
              {mappable.map((p) => {
                const active = p.id === selectedProjectId || p.id === hoverId;
                return (
                  <Marker
                    key={p.id}
                    coordinates={[p.center.lon as number, p.center.lat as number]}
                    onMouseEnter={() => setHoverId(p.id)}
                    onMouseLeave={() => setHoverId((id) => (id === p.id ? null : id))}
                    onClick={() => onSelectProject?.(p.id)}
                  >
                    <circle
                      r={active ? MARKER_RADIUS_ACTIVE : MARKER_RADIUS}
                      fill={p.utilityKey === "dominion" ? "var(--dominion)" : "var(--georgia)"}
                      stroke="#ffffff"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                      className="cursor-pointer transition-[r] duration-150"
                    />
                  </Marker>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>
        </div>
        <p className="m-0 mt-2 text-[0.6875rem] leading-snug text-text-muted">
          {mappable.length} of {projects.length} projects have map centers. Endpoint coordinates may
          still be pending — see project details.
        </p>
        {hoverId ? (
          <div className="mt-2 rounded-md border border-border bg-surface px-[0.875rem] py-[0.625rem] text-[0.8125rem] shadow-md">
            {(() => {
              const p = projects.find((x) => x.id === hoverId);
              if (!p) return null;
              return (
                <>
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 font-mono text-[0.6875rem] leading-none text-text-muted">
                    <UtilityBadge utilityKey={p.utilityKey} />
                    <span>{p.id}</span>
                  </div>
                  <p className="m-0 font-medium leading-snug text-text-primary">{p.name}</p>
                </>
              );
            })()}
          </div>
        ) : null}
      </div>
    </section>
  );
}

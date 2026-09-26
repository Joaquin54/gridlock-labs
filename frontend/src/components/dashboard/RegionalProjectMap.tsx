import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import type { GridlockProject } from "../../types/project";
import { CLS_DASHBOARD_PANEL_HEADER, CLS_DASHBOARD_PANEL_SHELL } from "../../utils/chartStyles";
import { cn } from "../../utils/cn";
import UtilityBadge from "../shared/UtilityBadge";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const HIGHLIGHT_STATES = new Set(["South Carolina", "Georgia"]);

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
    <section className={CLS_DASHBOARD_PANEL_SHELL}>
      <header className={CLS_DASHBOARD_PANEL_HEADER}>SC &amp; GA project footprint</header>
      <div className="p-3">
        <div className="relative w-full aspect-[4/3] min-h-[280px] bg-accent-light/40 dark:bg-surface-hover rounded-md overflow-hidden">
          <ComposableMap
            projection="geoAlbersUsa"
            width={800}
            height={600}
            style={{ width: "100%", height: "100%" }}
          >
            <ZoomableGroup center={[-82.5, 32.8]} zoom={3.2}>
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
                const hasOverlap = p.overlapCount > 0;
                return (
                  <Marker
                    key={p.id}
                    coordinates={[p.center.lon as number, p.center.lat as number]}
                    onMouseEnter={() => setHoverId(p.id)}
                    onMouseLeave={() => setHoverId((id) => (id === p.id ? null : id))}
                    onClick={() => onSelectProject?.(p.id)}
                  >
                    <circle
                      r={active ? 7 : hasOverlap ? 6 : 5}
                      className={cn(
                        "cursor-pointer transition-all duration-150",
                        p.utilityKey === "dominion" ? "fill-dominion" : "fill-georgia",
                        hasOverlap ? "stroke-white stroke-[2px]" : "stroke-transparent",
                      )}
                    />
                  </Marker>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>
        </div>
        <p className="text-[0.78rem] text-text-muted m-0 mt-2">
          {mappable.length} of {projects.length} projects have map centers. Endpoint coordinates may
          still be pending — see project details.
        </p>
        {hoverId ? (
          <div className="mt-2 p-2 rounded-md border border-border bg-surface text-sm">
            {(() => {
              const p = projects.find((x) => x.id === hoverId);
              if (!p) return null;
              return (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <UtilityBadge utilityKey={p.utilityKey} />
                    <span className="font-mono text-[0.72rem] text-text-muted">{p.id}</span>
                  </div>
                  <p className="m-0 text-text-primary font-medium">{p.name}</p>
                </>
              );
            })()}
          </div>
        ) : null}
      </div>
    </section>
  );
}

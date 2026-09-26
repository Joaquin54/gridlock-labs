import { useCallback, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import type { GridlockProject } from "../../types/project";
import { CLS_DASHBOARD_PANEL_HEADER, CLS_DASHBOARD_PANEL_SHELL } from "../../utils/chartStyles";
import { cn } from "../../utils/cn";
import UtilityBadge from "../shared/UtilityBadge";

const STATES_GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const COUNTIES_GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";

const HIGHLIGHT_STATES = new Set(["South Carolina", "Georgia"]);

/** Georgia (13) and South Carolina (45) county FIPS prefixes. */
function isScOrGaCounty(id: string | number | undefined): boolean {
  const fips = String(id ?? "");
  return fips.startsWith("13") || fips.startsWith("45");
}

type MapPosition = {
  coordinates: [number, number];
  zoom: number;
};

const MAP_DEFAULT_POSITION: MapPosition = {
  coordinates: [-82.25, 32.85],
  /** Tighter on SC + GA at load; dot size does not follow this value (see MARKER_SIZE_CALIBRATION_ZOOM). */
  zoom: 6.25,
};

const MAP_MIN_ZOOM = 1.2;
/** Upper zoom cap (d3-zoom allows more; SVG only scales vectors—no new map detail past ~20×). */
const MAP_MAX_ZOOM = 24;

const MARKER_RADIUS = 2;
const MARKER_RADIUS_ACTIVE = 2.75;

/** On-screen dot size at default zoom matches markers at this legacy map zoom (r ≈ base). */
const MARKER_LEGACY_REFERENCE_ZOOM = 4.5;

/** Map-space radius: legacy size at default zoom; shrinks when zooming in further. */
function markerRadiusForZoom(zoom: number, active: boolean): number {
  const base = active ? MARKER_RADIUS_ACTIVE : MARKER_RADIUS;
  const calibration =
    MARKER_LEGACY_REFERENCE_ZOOM * MAP_DEFAULT_POSITION.zoom ** 0.35;
  const scaled = (base * calibration) / zoom ** 1.35;
  return Math.min(base * 1.75, Math.max(0.2, scaled));
}

type StateGeo = {
  rsmKey: string;
  properties: { name?: string };
};

type CountyGeo = {
  rsmKey: string;
  id?: string | number;
  properties: { name?: string };
};

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
  const [hoverCounty, setHoverCounty] = useState<{ name: string; fips: string } | null>(null);
  const [mapPosition, setMapPosition] = useState<MapPosition>(MAP_DEFAULT_POSITION);

  const mappable = useMemo(
    () =>
      projects.filter(
        (p) => p.center.lat != null && p.center.lon != null && !Number.isNaN(p.center.lat),
      ),
    [projects],
  );

  const handleMoveEnd = useCallback((position: MapPosition) => {
    setMapPosition(position);
  }, []);

  const zoomBy = useCallback((delta: number) => {
    setMapPosition((prev) => ({
      ...prev,
      zoom: Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, prev.zoom + delta)),
    }));
  }, []);

  const resetView = useCallback(() => {
    setMapPosition(MAP_DEFAULT_POSITION);
  }, []);

  const showCountyDetail = mapPosition.zoom >= 5.5;

  return (
    <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[380px] flex-col")}>
      <div className="mb-[0.65rem] flex flex-wrap items-center justify-between gap-2">
        <div className={cn(CLS_DASHBOARD_PANEL_HEADER, "mb-0")}>SC &amp; GA project footprint</div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            className="min-h-[1.75rem] min-w-[1.75rem] rounded-sm border border-border bg-surface-hover px-2 font-sans text-[13px] font-medium text-text-secondary cursor-pointer hover:border-border-strong hover:text-text-primary"
            onClick={() => zoomBy(-0.75)}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="min-h-[1.75rem] min-w-[1.75rem] rounded-sm border border-border bg-surface-hover px-2 font-sans text-[13px] font-medium text-text-secondary cursor-pointer hover:border-border-strong hover:text-text-primary"
            onClick={() => zoomBy(0.75)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="min-h-[1.75rem] rounded-sm border border-border bg-surface-hover px-2 font-sans text-[11px] font-medium text-text-secondary cursor-pointer hover:border-border-strong hover:text-text-primary"
            onClick={resetView}
          >
            Reset
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative w-full flex-1 min-h-[310px] max-h-[500px] bg-accent-light/40 dark:bg-surface-hover rounded-md overflow-hidden touch-none">
          {hoverCounty ? (
            <div
              className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border border-border bg-surface px-2 py-1 text-[0.75rem] text-text-primary shadow-md"
              role="status"
            >
              {hoverCounty.name}
              <span className="ml-1 font-mono text-[0.65rem] text-text-muted">
                {hoverCounty.fips}
              </span>
            </div>
          ) : null}
          <ComposableMap
            projection="geoAlbersUsa"
            width={800}
            height={600}
            style={{ width: "100%", height: "100%" }}
          >
            <ZoomableGroup
              center={mapPosition.coordinates}
              zoom={mapPosition.zoom}
              minZoom={MAP_MIN_ZOOM}
              maxZoom={MAP_MAX_ZOOM}
              onMoveEnd={handleMoveEnd}
            >
              <Geographies geography={STATES_GEO_URL}>
                {({ geographies }: { geographies: StateGeo[] }) =>
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

              <Geographies geography={COUNTIES_GEO_URL}>
                {({ geographies }: { geographies: CountyGeo[] }) =>
                  geographies
                    .filter((geo) => isScOrGaCounty(geo.id))
                    .map((geo) => {
                      const fips = String(geo.id ?? "");
                      const name = geo.properties.name ?? "County";
                      const hovered = hoverCounty?.fips === fips;
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={
                            hovered
                              ? "#86efac"
                              : showCountyDetail
                                ? "rgba(200, 230, 201, 0.45)"
                                : "rgba(200, 230, 201, 0.12)"
                          }
                          stroke="#64748b"
                          strokeWidth={showCountyDetail ? 0.6 : 0.35}
                          style={{
                            default: {
                              outline: "none",
                              vectorEffect: "non-scaling-stroke",
                            },
                            hover: {
                              outline: "none",
                              fill: "#86efac",
                              cursor: "default",
                              vectorEffect: "non-scaling-stroke",
                            },
                            pressed: { outline: "none" },
                          }}
                          onMouseEnter={() => setHoverCounty({ name, fips })}
                          onMouseLeave={() => setHoverCounty((c) => (c?.fips === fips ? null : c))}
                        />
                      );
                    })
                }
              </Geographies>

              {mappable.map((p) => {
                const active = p.id === selectedProjectId || p.id === hoverId;
                const r = markerRadiusForZoom(mapPosition.zoom, active);
                return (
                  <Marker
                    key={p.id}
                    coordinates={[p.center.lon as number, p.center.lat as number]}
                    onMouseEnter={() => setHoverId(p.id)}
                    onMouseLeave={() => setHoverId((id) => (id === p.id ? null : id))}
                    onClick={() => onSelectProject?.(p.id)}
                  >
                    <circle
                      r={r}
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
          Drag to pan, scroll to zoom (SC &amp; GA counties). {mappable.length} of {projects.length}{" "}
          projects have map centers.
        </p>
        <div
          className={cn(
            "mt-2 min-h-[3.75rem] box-border rounded-md border px-[0.875rem] py-[0.625rem] text-[0.8125rem]",
            hoverId
              ? "border-border bg-surface shadow-md"
              : "border-transparent bg-transparent",
          )}
          aria-live="polite"
        >
          {hoverId ? (
            (() => {
              const p = projects.find((x) => x.id === hoverId);
              if (!p) return null;
              return (
                <>
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 font-mono text-[0.6875rem] leading-none text-text-muted">
                    <UtilityBadge utilityKey={p.utilityKey} />
                    <span>{p.id}</span>
                  </div>
                  <p className="m-0 truncate font-medium leading-snug text-text-primary">{p.name}</p>
                </>
              );
            })()
          ) : (
            <span className="sr-only">Hover a project on the map for details</span>
          )}
        </div>
      </div>
    </section>
  );
}

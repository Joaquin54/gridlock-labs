import { geoBounds, geoCentroid, geoContains } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { feature as topoFeature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { ReviewQueuePoint } from "../../types/geocode";
import { confidenceMarkerFill, utilityKeyFromQueueCode } from "../../types/geocode";
import type { GridlockProject } from "../../types/project";
import { CLS_DASHBOARD_PANEL_HEADER, CLS_DASHBOARD_PANEL_SHELL } from "../../utils/chartStyles";
import { cn } from "../../utils/cn";
import {
  buildCountyCountScale,
  MAP_COUNTY_STROKE_WIDTH,
  MAP_DEFAULT_STROKE,
  MAP_HOVER_FILL,
  MAP_HOVER_STROKE,
  MAP_HOVER_STROKE_WIDTH,
  MAP_INSET_STROKE,
  MAP_MUTED_STATE_FILL,
  MAP_SELECTED_STROKE,
  MAP_SELECTED_STROKE_WIDTH,
  MAP_STATE_BOUNDARY_STROKE,
  MAP_STATE_BOUNDARY_WIDTH,
  MAP_ZERO_FILL,
} from "../../utils/mapChoropleth";
import ConfidenceBadge from "../shared/ConfidenceBadge";
import TaskBadge from "../shared/TaskBadge";
import UtilityBadge from "../shared/UtilityBadge";

const STATES_GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const COUNTIES_GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";

const HIGHLIGHT_STATES = new Set(["South Carolina", "Georgia"]);

/** Screen-space strokes; do not set fill/stroke here — props control colors (avoids uneven hover). */
const COUNTY_GEO_STYLE = {
  default: {
    outline: "none",
    cursor: "pointer",
    vectorEffect: "non-scaling-stroke",
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
    transition: "fill 0.15s ease",
  },
  hover: {
    outline: "none",
    cursor: "pointer",
    vectorEffect: "non-scaling-stroke",
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  },
  pressed: {
    outline: "none",
    cursor: "pointer",
    vectorEffect: "non-scaling-stroke",
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  },
};

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
  zoom: 6.25,
};

const MAP_MIN_ZOOM = 1.2;
const MAP_MAX_ZOOM = 24;

const MARKER_RADIUS = 2;
const MARKER_LEGACY_REFERENCE_ZOOM = 4.5;
/** Screen-space floor so dots stay visible and easy to hit when zoomed in. */
const MARKER_MIN_RADIUS = 0.30;
/** Subtle hover / selection emphasis — same min radius, slightly larger ring. */
const MARKER_HOVER_SCALE = 1.5;

function markerRadiusForZoom(zoom: number, hovered: boolean, baseRadius: number): number {
  const calibration = MARKER_LEGACY_REFERENCE_ZOOM * MAP_DEFAULT_POSITION.zoom ** 0.35;
  const scaled = (baseRadius * calibration) / zoom ** 1.35;
  const maxRadius = baseRadius * 1.75;
  const r = Math.min(maxRadius, Math.max(MARKER_MIN_RADIUS, scaled));
  return hovered ? r * MARKER_HOVER_SCALE : r;
}

type StateGeo = {
  rsmKey: string;
  properties: { name?: string };
};

type CountyProperties = { name?: string };

type CountyGeo = {
  rsmKey: string;
  id?: string | number;
  properties: CountyProperties;
};

type CountyFeature = Feature<Geometry, CountyProperties> & {
  rsmKey: string;
  id?: string | number;
};

type GeocodeMarkerColorBy = "utility" | "confidence";

type RegionalProjectMapProps = {
  projects?: GridlockProject[];
  geocodePoints?: ReviewQueuePoint[];
  /** When showing geocode points: color dots by utility or geocode confidence. */
  geocodeMarkerColorBy?: GeocodeMarkerColorBy;
  onSelectProject?: (projectId: string) => void;
  selectedProjectId?: string | null;
  title?: string;
  initialPosition?: MapPosition;
};

function geocodeMarkerFill(point: ReviewQueuePoint, colorBy: GeocodeMarkerColorBy): string {
  if (colorBy === "utility") {
    return utilityKeyFromQueueCode(point.utility) === "dominion"
      ? "var(--dominion)"
      : "var(--georgia)";
  }
  return confidenceMarkerFill(point.confidence);
}

function zoomToCountyFeature(geo: CountyFeature): MapPosition {
  const centroid = geoCentroid(geo);
  const [[west, south], [east, north]] = geoBounds(geo);
  const span = Math.max(east - west, north - south, 0.02);
  const zoom = Math.min(MAP_MAX_ZOOM, Math.max(9.5, 2.75 / span));
  return { coordinates: [centroid[0], centroid[1]], zoom };
}

export default function RegionalProjectMap({
  projects = [],
  geocodePoints,
  geocodeMarkerColorBy = "confidence",
  onSelectProject,
  selectedProjectId,
  title = "SC & GA project footprint",
  initialPosition,
}: RegionalProjectMapProps) {
  const startPosition = initialPosition ?? MAP_DEFAULT_POSITION;
  const [startLng, startLat] = startPosition.coordinates;
  const startZoom = startPosition.zoom;
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverState, setHoverState] = useState<string | null>(null);
  const [hoverCounty, setHoverCounty] = useState<{
    name: string;
    fips: string;
    count: number;
  } | null>(null);
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | null>(null);
  const [countyCounts, setCountyCounts] = useState<Map<string, number>>(() => new Map());
  const [mapPosition, setMapPosition] = useState<MapPosition>(startPosition);

  useEffect(() => {
    setMapPosition({ coordinates: [startLng, startLat], zoom: startZoom });
    setSelectedCountyFips(null);
    setHoverCounty(null);
    setHoverId(null);
  }, [startLng, startLat, startZoom]);

  const useGeocode = Boolean(geocodePoints?.length);

  const mappableGeocode = useMemo(
    () =>
      (geocodePoints ?? []).filter((p) => p.lat != null && p.lon != null && !Number.isNaN(p.lat)),
    [geocodePoints],
  );

  const mappableProjects = useMemo(
    () =>
      projects.filter(
        (p) => p.center.lat != null && p.center.lon != null && !Number.isNaN(p.center.lat),
      ),
    [projects],
  );

  const mapPoints = useMemo(
    () =>
      useGeocode
        ? mappableGeocode.map((p) => ({ lat: p.lat as number, lon: p.lon as number }))
        : mappableProjects.map((p) => ({
            lat: p.center.lat as number,
            lon: p.center.lon as number,
          })),
    [useGeocode, mappableGeocode, mappableProjects],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadCountyCounts(): Promise<void> {
      try {
        const res = await fetch(COUNTIES_GEO_URL);
        const topology = (await res.json()) as Topology;
        const countiesTopo = topology.objects.counties;
        if (!countiesTopo) {
          if (!cancelled) setCountyCounts(new Map());
          return;
        }
        const collection = topoFeature(topology, countiesTopo);
        if (collection.type !== "FeatureCollection") {
          if (!cancelled) setCountyCounts(new Map());
          return;
        }

        const scGaCounties = collection.features.filter((f) => isScOrGaCounty(f.id));
        const counts = new Map<string, number>();
        for (const county of scGaCounties) {
          counts.set(String(county.id), 0);
        }

        for (const point of mapPoints) {
          const coord: [number, number] = [point.lon, point.lat];
          for (const county of scGaCounties) {
            if (geoContains(county, coord)) {
              const fips = String(county.id);
              counts.set(fips, (counts.get(fips) ?? 0) + 1);
              break;
            }
          }
        }

        if (!cancelled) {
          setCountyCounts(counts);
        }
      } catch {
        if (!cancelled) {
          setCountyCounts(new Map());
        }
      }
    }

    void loadCountyCounts();
    return () => {
      cancelled = true;
    };
  }, [mapPoints]);

  const countyColorScale = useMemo(
    () => buildCountyCountScale(countyCounts.values()),
    [countyCounts],
  );

  const markerBase = useGeocode ? 1.35 : MARKER_RADIUS;

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
    setSelectedCountyFips(null);
    setMapPosition(startPosition);
  }, [startPosition]);

  const handleCountyClick = useCallback(
    (geo: CountyGeo) => {
      const fips = String(geo.id ?? "");
      if (selectedCountyFips === fips) {
        setSelectedCountyFips(null);
        setMapPosition(startPosition);
        return;
      }
      setSelectedCountyFips(fips);
      setMapPosition(zoomToCountyFeature(geo as CountyFeature));
    },
    [selectedCountyFips, startPosition],
  );

  return (
    <section className={cn(CLS_DASHBOARD_PANEL_SHELL, "flex min-h-[380px] flex-col")}>
      <div className="mb-[0.65rem] flex flex-wrap items-center justify-between gap-2">
        <div className={cn(CLS_DASHBOARD_PANEL_HEADER, "mb-0")}>{title}</div>
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
              className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border border-border bg-surface px-2 py-1 text-[0.8125rem] text-text-primary shadow-md"
              role="status"
            >
              {hoverCounty.name}
              <span className="ml-2 text-text-secondary">
                {hoverCounty.count} point{hoverCounty.count === 1 ? "" : "s"}
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
                    const hovered = hoverState === name;
                    const baseFill = highlighted ? MAP_ZERO_FILL : MAP_MUTED_STATE_FILL;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={hovered && highlighted ? MAP_HOVER_FILL : baseFill}
                        stroke={
                          hovered && highlighted
                            ? MAP_HOVER_STROKE
                            : highlighted
                              ? MAP_INSET_STROKE
                              : "#94a3b8"
                        }
                        strokeWidth={
                          hovered && highlighted ? MAP_HOVER_STROKE_WIDTH : highlighted ? 0.2 : 0.2
                        }
                        style={{
                          default: {
                            outline: "none",
                            transition: "fill 0.15s ease, stroke 0.15s ease",
                            vectorEffect: hovered && highlighted ? "non-scaling-stroke" : undefined,
                          },
                          hover: { outline: "none" },
                          pressed: { outline: "none" },
                        }}
                        onMouseEnter={() => {
                          if (highlighted) setHoverState(name);
                        }}
                        onMouseLeave={() => {
                          setHoverState((s) => (s === name ? null : s));
                        }}
                      />
                    );
                  })
                }
              </Geographies>

              <Geographies geography={COUNTIES_GEO_URL}>
                {({ geographies }: { geographies: CountyGeo[] }) => {
                  const scGa = geographies.filter((geo) => isScOrGaCounty(geo.id));
                  const elevatedFips = hoverCounty?.fips ?? selectedCountyFips;

                  const renderCountyLayer = (
                    geo: CountyGeo,
                    onTop: boolean,
                  ): JSX.Element | null => {
                    const fips = String(geo.id ?? "");
                    const name = geo.properties.name ?? "County";
                    const count = countyCounts.get(fips) ?? 0;
                    const isElevated = elevatedFips === fips;
                    if (onTop !== isElevated) return null;

                    const hovered = hoverCounty?.fips === fips;
                    const selected = selectedCountyFips === fips;
                    const fill = hovered ? MAP_HOVER_FILL : countyColorScale.getFill(count);
                    const stroke = hovered
                      ? MAP_HOVER_STROKE
                      : selected
                        ? MAP_SELECTED_STROKE
                        : MAP_INSET_STROKE;
                    const strokeWidth = hovered
                      ? MAP_HOVER_STROKE_WIDTH
                      : selected
                        ? MAP_SELECTED_STROKE_WIDTH
                        : MAP_COUNTY_STROKE_WIDTH;

                    return (
                      <Geography
                        key={onTop ? `${geo.rsmKey}-top` : geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        style={COUNTY_GEO_STYLE}
                        onMouseEnter={() => setHoverCounty({ name, fips, count })}
                        onMouseLeave={() => setHoverCounty((c) => (c?.fips === fips ? null : c))}
                        onClick={() => handleCountyClick(geo)}
                      />
                    );
                  };

                  return (
                    <>
                      {scGa.map((geo) => renderCountyLayer(geo, false))}
                      {scGa.map((geo) => renderCountyLayer(geo, true))}
                    </>
                  );
                }}
              </Geographies>

              <Geographies geography={STATES_GEO_URL}>
                {({ geographies }: { geographies: StateGeo[] }) =>
                  geographies
                    .filter((geo) => HIGHLIGHT_STATES.has(geo.properties.name ?? ""))
                    .map((geo) => (
                      <Geography
                        key={`${geo.rsmKey}-boundary`}
                        geography={geo}
                        fill="none"
                        stroke={MAP_STATE_BOUNDARY_STROKE}
                        strokeWidth={MAP_STATE_BOUNDARY_WIDTH}
                        style={{
                          default: {
                            outline: "none",
                            pointerEvents: "none",
                            vectorEffect: "non-scaling-stroke",
                            strokeLinejoin: "round",
                          },
                          hover: { outline: "none", pointerEvents: "none" },
                          pressed: { outline: "none", pointerEvents: "none" },
                        }}
                      />
                    ))
                }
              </Geographies>

              {useGeocode
                ? mappableGeocode.map((p) => {
                    const active = p.id === hoverId;
                    const r = markerRadiusForZoom(mapPosition.zoom, active, markerBase);
                    return (
                      <Marker
                        key={p.id}
                        coordinates={[p.lon as number, p.lat as number]}
                        onMouseEnter={() => setHoverId(p.id)}
                        onMouseLeave={() => setHoverId((id) => (id === p.id ? null : id))}
                        onClick={() => {
                          if (p.googleMapsUrl) window.open(p.googleMapsUrl, "_blank", "noopener");
                        }}
                      >
                        <circle
                          r={r}
                          fill={geocodeMarkerFill(p, geocodeMarkerColorBy)}
                          stroke={MAP_DEFAULT_STROKE}
                          strokeWidth={1}
                          vectorEffect="non-scaling-stroke"
                          className="cursor-pointer transition-[r] duration-150"
                        />
                      </Marker>
                    );
                  })
                : mappableProjects.map((p) => {
                    const active = p.id === selectedProjectId || p.id === hoverId;
                    const r = markerRadiusForZoom(mapPosition.zoom, active, markerBase);
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
                          stroke={MAP_DEFAULT_STROKE}
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
          Drag to pan, scroll to zoom. Click a county to zoom in; click again or Reset to return.{" "}
          {useGeocode ? (
            <>
              {mappableGeocode.length} located points ({geocodePoints?.length ?? 0} in queue).
              County shading by point density.
            </>
          ) : (
            <>
              {mappableProjects.length} of {projects.length} projects have map centers.
            </>
          )}
        </p>
        <div
          className={cn(
            "mt-2 min-h-[3.75rem] box-border rounded-md border px-[0.875rem] py-[0.625rem] text-[0.8125rem]",
            hoverId ? "border-border bg-surface shadow-md" : "border-transparent bg-transparent",
          )}
          aria-live="polite"
        >
          {hoverId ? (
            (() => {
              if (useGeocode) {
                const p = mappableGeocode.find((x) => x.id === hoverId);
                if (!p) return null;
                return (
                  <>
                    <div className="mb-1 flex flex-wrap items-center gap-1.5 font-mono text-[0.6875rem] leading-none text-text-muted">
                      <UtilityBadge utilityKey={utilityKeyFromQueueCode(p.utility)} />
                      <TaskBadge task={p.task} />
                      <ConfidenceBadge confidence={p.confidence} />
                    </div>
                    <p className="m-0 truncate font-medium leading-snug text-text-primary">
                      {p.pointName}
                    </p>
                    <p className="m-0 mt-0.5 truncate text-[0.75rem] text-text-secondary">
                      {p.projectName}
                    </p>
                  </>
                );
              }
              const p = projects.find((x) => x.id === hoverId);
              if (!p) return null;
              return (
                <>
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 font-mono text-[0.6875rem] leading-none text-text-muted">
                    <UtilityBadge utilityKey={p.utilityKey} />
                    <span>{p.id}</span>
                  </div>
                  <p className="m-0 truncate font-medium leading-snug text-text-primary">
                    {p.name}
                  </p>
                </>
              );
            })()
          ) : (
            <span className="sr-only">Hover a point on the map for details</span>
          )}
        </div>
      </div>
    </section>
  );
}

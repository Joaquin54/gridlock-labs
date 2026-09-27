import { geoDistance } from "d3-geo";
import { Marker, useMapContext } from "react-simple-maps";

/**
 * Ordinary map furniture: water, place anchors and a scale bar.
 *
 * The analysis is denominated in miles — 25 of them — so a reader needs a
 * distance reference and something to orient against. None of this encodes
 * project data; it is the base map the data sits on.
 */

const EARTH_RADIUS_MILES = 3958.8;

/**
 * Anchors only — the regions the data already speaks in (`savannah_coast`,
 * `augusta_east`, `atlanta_metro`) plus the two state capitals.
 */
const PLACES: ReadonlyArray<{ name: string; coordinates: [number, number] }> = [
  { name: "Atlanta", coordinates: [-84.388, 33.749] },
  { name: "Augusta", coordinates: [-82.0105, 33.4735] },
  { name: "Savannah", coordinates: [-81.0912, 32.0809] },
  { name: "Columbia", coordinates: [-81.0348, 34.0007] },
];

/** Bar lengths to choose from; 25 is the challenge's overlap threshold. */
const SCALE_STEPS_MILES = [10, 25, 50, 100, 200] as const;
/** The bar takes the longest step that still fits, so it steps down as you zoom in. */
const SCALE_MAX_PX = 120;

export function MapWater({ width, height }: { width: number; height: number }) {
  // us-atlas carries land only, so anything the state shapes do not cover is water.
  return <rect x={0} y={0} width={width} height={height} fill="var(--map-water)" />;
}

export function PlaceLabels({ zoom }: { zoom: number }) {
  const scale = (value: number): number => value / zoom;
  return (
    <>
      {PLACES.map((place) => (
        <Marker key={place.name} coordinates={place.coordinates}>
          <g style={{ pointerEvents: "none" }}>
            <circle
              r={scale(1.6)}
              fill="none"
              stroke="var(--map-label)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              opacity={0.75}
            />
            <text
              x={scale(4)}
              y={scale(1.4)}
              fontSize={scale(7)}
              fontWeight={600}
              fill="var(--map-label)"
              stroke="var(--surface)"
              strokeWidth={scale(1.6)}
              paintOrder="stroke"
              opacity={0.95}
            >
              {place.name}
            </text>
          </g>
        </Marker>
      ))}
    </>
  );
}

/**
 * Sits outside ZoomableGroup so it never pans, and derives its length from the
 * projection rather than a hard-coded constant, so it stays honest at any zoom.
 */
export function ScaleBar({ zoom, x, y }: { zoom: number; x: number; y: number }) {
  const { projection } = useMapContext();

  const from = projection.invert?.([x, y]);
  const to = projection.invert?.([x + 100, y]);
  if (!from || !to) return null;

  const milesPerHundredBasePx = geoDistance(from, to) * EARTH_RADIUS_MILES;
  if (!Number.isFinite(milesPerHundredBasePx) || milesPerHundredBasePx <= 0) return null;

  const milesPerPx = milesPerHundredBasePx / 100 / zoom;
  const pxFor = (miles: number): number => miles / milesPerPx;

  const fitting = SCALE_STEPS_MILES.filter((step) => pxFor(step) <= SCALE_MAX_PX);
  const miles = fitting.length > 0 ? fitting[fitting.length - 1] : SCALE_STEPS_MILES[0];
  const barPx = pxFor(miles);
  if (!Number.isFinite(barPx) || barPx <= 0) return null;

  const tick = 4;
  return (
    <g transform={`translate(${x} ${y})`} style={{ pointerEvents: "none" }}>
      <line
        x1={0}
        y1={0}
        x2={barPx}
        y2={0}
        stroke="var(--text-secondary)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={0}
        y1={-tick}
        x2={0}
        y2={tick}
        stroke="var(--text-secondary)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={barPx}
        y1={-tick}
        x2={barPx}
        y2={tick}
        stroke="var(--text-secondary)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={barPx / 2}
        y={-tick - 3}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill="var(--text-secondary)"
      >
        {miles} mi
      </text>
    </g>
  );
}

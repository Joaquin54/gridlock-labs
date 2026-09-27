import type { ProjectType } from '../db/schema'

/** A located point as project_geo.shape stores it: [lon, lat]. */
export type Coordinate = [number, number]

export type Geometry =
  | { type: 'Point'; coordinates: Coordinate }
  | { type: 'LineString'; coordinates: Coordinate[] }
  | { type: 'MultiPoint'; coordinates: Coordinate[] }

/**
 * GeoJSON geometry for a project, from its located points in `seq` order.
 * `shape` is already filtered to located points by the project_geo view, so an
 * empty array means nothing has been located yet and the Feature carries no
 * geometry.
 *
 * A `station` project has one point by design; if bad data gives it more, the
 * first one wins rather than inventing a route. An unknown project_type with
 * several points becomes a MultiPoint for the same reason — a LineString would
 * claim a path through them that nothing supports.
 */
export function buildGeometry(projectType: ProjectType | null, shape: Coordinate[]): Geometry | null {
  if (projectType === 'non_geographic') return null
  if (shape.length === 0) return null
  if (projectType === 'station') return { type: 'Point', coordinates: shape[0] as Coordinate }
  if (shape.length === 1) return { type: 'Point', coordinates: shape[0] as Coordinate }
  if (projectType === 'line') return { type: 'LineString', coordinates: shape }
  return { type: 'MultiPoint', coordinates: shape }
}

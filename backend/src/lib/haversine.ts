/** Earth radius in miles, matching the value used in the overlap SQL. */
export const EARTH_RADIUS_MI = 3958.8

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Great-circle distance in miles between two lat/lon pairs. */
export function haversineMi(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const h =
    Math.sin(radians(bLat - aLat) / 2) ** 2 +
    Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(radians(bLon - aLon) / 2) ** 2
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h))
}

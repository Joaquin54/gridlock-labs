const MS_PER_DAY = 86_400_000

/** A project's schedule. `inService` is never null in the schema; `start` can be. */
export type ScheduleWindow = {
  start: string | null
  inService: string
}

/** Whole days from `b` to `a`, both 'YYYY-MM-DD'. */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(a) - Date.parse(b)) / MS_PER_DAY)
}

export function inServiceGapDays(a: string, b: string): number {
  return Math.abs(daysBetween(a, b))
}

/**
 * Days the two start -> in-service windows share. Null when either start date is
 * unknown. At most one of overlap/gap is non-zero for the same pair.
 */
export function windowOverlapDays(a: ScheduleWindow, b: ScheduleWindow): number | null {
  if (a.start === null || b.start === null) return null
  const latestStart = a.start > b.start ? a.start : b.start
  const earliestEnd = a.inService < b.inService ? a.inService : b.inService
  return Math.max(0, daysBetween(earliestEnd, latestStart))
}

/** Days between the windows when they do not touch. Null when a start is unknown. */
export function windowGapDays(a: ScheduleWindow, b: ScheduleWindow): number | null {
  if (a.start === null || b.start === null) return null
  const latestStart = a.start > b.start ? a.start : b.start
  const earliestEnd = a.inService < b.inService ? a.inService : b.inService
  return Math.max(0, daysBetween(latestStart, earliestEnd))
}

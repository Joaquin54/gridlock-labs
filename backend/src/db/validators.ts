import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import {
  CONFIDENCES,
  MILES_SOURCES,
  OWNERS,
  POINT_METHODS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  START_DATE_SOURCES,
  UTILITIES,
  WORK_TYPES,
  projectGeo,
  projectPoints,
  projects,
} from './schema'

// --- projects ----------------------------------------------------------------

export const selectProjectSchema = createSelectSchema(projects, {
  utility: () => z.enum(UTILITIES),
  owner: () => z.enum(OWNERS),
  projectType: () => z.enum(PROJECT_TYPES),
  workType: () => z.enum(WORK_TYPES),
  status: () => z.enum(PROJECT_STATUSES),
  startDateSource: () => z.enum(START_DATE_SOURCES),
  milesSource: () => z.enum(MILES_SOURCES),
})

export const insertProjectSchema = createInsertSchema(projects, {
  utility: () => z.enum(UTILITIES),
  owner: () => z.enum(OWNERS),
  projectType: () => z.enum(PROJECT_TYPES),
  workType: () => z.enum(WORK_TYPES),
  status: () => z.enum(PROJECT_STATUSES),
  startDateSource: () => z.enum(START_DATE_SOURCES),
  milesSource: () => z.enum(MILES_SOURCES),
})

// --- project_points ------------------------------------------------------------

export const selectProjectPointSchema = createSelectSchema(projectPoints, {
  seq: (schema) => schema.min(1).max(3),
  lat: (schema) => schema.min(-90).max(90),
  lon: (schema) => schema.min(-180).max(180),
  method: () => z.enum(POINT_METHODS),
  confidence: () => z.enum(CONFIDENCES),
})

export const insertProjectPointSchema = createInsertSchema(projectPoints, {
  seq: (schema) => schema.min(1).max(3),
  lat: (schema) => schema.min(-90).max(90),
  lon: (schema) => schema.min(-180).max(180),
  method: () => z.enum(POINT_METHODS),
  confidence: () => z.enum(CONFIDENCES),
})

// --- project_geo (view) ---------------------------------------------------------

export const selectProjectGeoSchema = createSelectSchema(projectGeo, {
  locationConfidence: () => z.enum(CONFIDENCES),
})

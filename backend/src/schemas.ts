import { zValidator } from '@hono/zod-validator'
import type { Context } from 'hono'
import { z } from 'zod'
import { UTILITIES } from './db/schema'
import { WIRE_CONFIDENCES } from './lib/confidence'

/** `?flag=true|false` as a real boolean. */
const booleanParam = z.enum(['true', 'false']).transform((value) => value === 'true')

/** `?confidence=high,medium` as a list. */
const confidenceListParam = z
  .string()
  .transform((value) => value.split(',').map((part) => part.trim()))
  .pipe(z.array(z.enum(WIRE_CONFIDENCES)).min(1))

/** `?bbox=w,s,e,n` as four numbers, west < east and south < north. */
const bboxParam = z.string().transform((value, ctx) => {
  const parts = value.split(',').map((part) => Number(part.trim()))
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    ctx.addIssue({ code: 'custom', message: 'bbox must be four numbers: w,s,e,n' })
    return z.NEVER
  }
  const [west, south, east, north] = parts as [number, number, number, number]
  if (west >= east) {
    ctx.addIssue({ code: 'custom', message: 'bbox west must be less than east' })
    return z.NEVER
  }
  if (south >= north) {
    ctx.addIssue({ code: 'custom', message: 'bbox south must be less than north' })
    return z.NEVER
  }
  return [west, south, east, north] as [number, number, number, number]
})

export const projectQuerySchema = z.object({
  utility: z.enum(UTILITIES).optional(),
  confidence: confidenceListParam.optional(),
  located: booleanParam.optional(),
  inScope: booleanParam.optional(),
  bbox: bboxParam.optional(),
})

export const overlapQuerySchema = z.object({
  maxMiles: z.coerce.number().positive().default(25),
  maxGapDays: z.coerce.number().int().min(0).optional(),
  minConfidence: z.enum(WIRE_CONFIDENCES).optional(),
  inScope: booleanParam.default(true),
  sort: z.enum(['distance', 'gap']).default('distance'),
})

export function validateQuery<T extends z.ZodType>(schema: T) {
  return zValidator('query', schema, (result, c: Context) => {
    if (!result.success) {
      return c.json({ error: 'invalid query parameters', issues: result.error.issues }, 400)
    }
  })
}

export function validateBody<T extends z.ZodType>(schema: T) {
  return zValidator('json', schema, (result, c: Context) => {
    if (!result.success) {
      return c.json({ error: 'invalid request body', issues: result.error.issues }, 400)
    }
  })
}

export const pointParamsSchema = z.object({
  seq: z.coerce.number().int().min(1).max(3),
})

export const pointLocationBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  source_url: z.url(),
})

export function validateParam<T extends z.ZodType>(schema: T) {
  return zValidator('param', schema, (result, c: Context) => {
    if (!result.success) {
      return c.json({ error: 'invalid path parameters', issues: result.error.issues }, 400)
    }
  })
}

/**
 * The process-wide database. Importing this module connects (or builds the
 * in-memory dev database), so anything that only needs the query helpers should
 * import from './client' instead and stay side-effect free.
 */
import { createDb, findMissingRelations } from './client'

export * from './client'

export const { db, mode } = await createDb()


let missing = await findMissingRelations(db)

if (missing.length > 0) {
  console.log('schema not pushed: run bunx drizzle-kit push')
}

/**
 * Missing relations, re-checked on every call until nothing is missing, so a
 * `drizzle-kit push` against a running server heals it without a restart.
 */
export async function missingRelations(): Promise<string[]> {
  if (missing.length > 0) missing = await findMissingRelations(db)
  return missing
}

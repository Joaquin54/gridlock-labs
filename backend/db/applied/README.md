# Applied DDL

Every statement set that has been applied to the Tiger database, in the order it was
applied. **These are applied manually via reviewed transactions; they are not drizzle
migrations.** Nothing reads this directory at runtime — `src/db/schema.ts` remains the
single source of truth for the schema, and these files are the record of what is
actually in Tiger.

**Do not run `drizzle-kit push` against Tiger.** It sees Timescale's `pg_*` views and
prompts to rename or drop them — see `docs/load_gap_report.md` §6 for what happens and
what to do instead.

| File | What it did | How it was applied |
|---|---|---|
| `001_tables.sql` | `projects`, `project_points`, their constraints and indexes, and the `project_geo` view | `drizzle-kit export --sql`, reviewed, then one `BEGIN … COMMIT` |
| `002_points_join_pre.sql` | `points` table, `project_points.point_id`, its FK and index, and the `point_usage` view | one transaction that also carried the `--replace` reload |
| `003_points_join_post.sql` | the `point_id` CHECK | same transaction as 002, but **after** the rows loaded |
| `004_deliverable_views.sql` | `overlap_table` and `project_table` | one `BEGIN … COMMIT` |

## Why 002 and 003 are separate

`project_points_point_id_ck` asserts `(point_id IS NULL) = (lat IS NULL)`. Adding it
before the reload fails, because the rows already in the table have `point_id` NULL
while `lat` is set — which is exactly what happened on the first attempt, and the
transaction rolled back. Applied after the rows land, the same constraint instead
validates all 445 freshly loaded rows. On an empty database the split does not matter,
which is why it passed on PGlite first.

## Regenerating a file

`001` and `002` came from `bunx drizzle-kit export --sql` on `schema.ts` (which builds
from an empty state and so never reads the database), with the incremental
`ALTER … ADD` statements written by hand because `export` emits them inline inside
`CREATE TABLE`. `004` is `backend/scripts/deliverable-views.sql`, the same file the
export script reads, copied here once it was applied.

Adding a new change: update `schema.ts`, export, review the statements, apply them in
one transaction with the checks inside it, then add the file here with the next number.

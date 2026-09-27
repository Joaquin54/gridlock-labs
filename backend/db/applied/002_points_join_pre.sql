-- PART 1 of 2 (with 003), applied BEFORE the reload. The point_id CHECK is not here: the rows
-- still have point_id NULL at this stage, so it would fail against existing data. It
-- is in 003_points_join_post.sql, applied after the reload inside the same transaction.
-- Incremental DDL for the shared points table. Every statement below is copied from
-- `bunx drizzle-kit export --sql` on the updated schema.ts, except the two ALTER ...
-- ADD statements, which export emits inline in CREATE TABLE because export only ever
-- builds from empty. Additive only: no DROP, no RENAME, no pg_* or Timescale object.

CREATE TABLE "points" (
	"id" text PRIMARY KEY NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] NOT NULL,
	"confidence" text NOT NULL,
	"method" text,
	"match_name" text,
	"osm_url" text,
	"source_url" text,
	"verified_by" text,
	"note" text,
	CONSTRAINT "points_confidence_ck" CHECK ("points"."confidence" IN ('verified', 'high', 'medium', 'low')),
	CONSTRAINT "points_method_ck" CHECK ("points"."method" IS NULL OR "points"."method" IN ('osm', 'nominatim', 'manual', 'hifld', 'eia860')),
	CONSTRAINT "points_lat_ck" CHECK ("points"."lat" BETWEEN -90 AND 90),
	CONSTRAINT "points_lon_ck" CHECK ("points"."lon" BETWEEN -180 AND 180)
);

ALTER TABLE "project_points" ADD COLUMN "point_id" text;

ALTER TABLE "project_points" ADD CONSTRAINT "project_points_point_id_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."points"("id") ON DELETE restrict ON UPDATE no action;

CREATE INDEX "project_points_point_id_idx" ON "project_points" USING btree ("point_id");

CREATE VIEW "public"."point_usage" AS (
  select
    pt.id as point_id,
    pt.name,
    pt.aliases,
    pt.lat,
    pt.lon,
    pt.confidence,
    count(distinct pp.project_id)::int as n_projects,
    array_agg(distinct p.utility) as utilities,
    array_agg(distinct pp.project_id) as project_ids
  from points pt
  join project_points pp on pp.point_id = pt.id
  join projects p on p.id = pp.project_id
  group by pt.id, pt.name, pt.aliases, pt.lat, pt.lon, pt.confidence
);

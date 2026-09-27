CREATE TABLE "project_points" (
	"project_id" text NOT NULL,
	"seq" smallint NOT NULL,
	"name" text NOT NULL,
	"lat" double precision,
	"lon" double precision,
	"method" text,
	"match_name" text,
	"osm_url" text,
	"match_score" numeric,
	"source_url" text,
	"confidence" text,
	"verified_by" text,
	"verified_at" timestamp with time zone,
	"verification_note" text,
	"note" text,
	CONSTRAINT "project_points_project_id_seq_pk" PRIMARY KEY("project_id","seq"),
	CONSTRAINT "project_points_seq_ck" CHECK ("project_points"."seq" BETWEEN 1 AND 3),
	CONSTRAINT "project_points_lat_ck" CHECK ("project_points"."lat" IS NULL OR ("project_points"."lat" BETWEEN -90 AND 90)),
	CONSTRAINT "project_points_lon_ck" CHECK ("project_points"."lon" IS NULL OR ("project_points"."lon" BETWEEN -180 AND 180)),
	CONSTRAINT "project_points_lat_lon_pair_ck" CHECK (("project_points"."lat" IS NULL) = ("project_points"."lon" IS NULL)),
	CONSTRAINT "project_points_confidence_floor_ck" CHECK ("project_points"."lat" IS NOT NULL OR "project_points"."confidence" = 'low'),
	CONSTRAINT "project_points_verification_note_ck" CHECK ("project_points"."verification_note" IS NULL OR "project_points"."verification_note" = 'confirmed' OR "project_points"."verification_note" LIKE 'moved: %'),
	CONSTRAINT "project_points_method_ck" CHECK ("project_points"."method" IS NULL OR "project_points"."method" IN ('osm', 'nominatim', 'manual', 'hifld', 'eia860')),
	CONSTRAINT "project_points_confidence_ck" CHECK ("project_points"."confidence" IS NULL OR "project_points"."confidence" IN ('verified', 'high', 'medium', 'low'))
);

CREATE TABLE "projects" (
	"id" text PRIMARY KEY GENERATED ALWAYS AS (utility || ':' || project_key) STORED NOT NULL,
	"utility" text NOT NULL,
	"project_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner" text NOT NULL,
	"owner_in_scope" boolean GENERATED ALWAYS AS (owner IN ('DESC','GPC','SAV')) STORED NOT NULL,
	"project_type" text,
	"work_type" text,
	"voltage_kv" integer,
	"zone" text,
	"status" text,
	"start_date" date,
	"start_date_source" text,
	"in_service_date" date NOT NULL,
	"in_service_raw" text,
	"line_miles" numeric(8, 2),
	"miles_source" text,
	"cost_usd" numeric(14, 2),
	"cost_low" numeric(14, 2),
	"cost_high" numeric(14, 2),
	"confidence" text NOT NULL,
	"is_border" boolean NOT NULL,
	"evidence" text,
	"source_doc" text NOT NULL,
	"source_page" integer,
	CONSTRAINT "projects_utility_ck" CHECK ("projects"."utility" IN ('DESC', 'GPC')),
	CONSTRAINT "projects_owner_ck" CHECK ("projects"."owner" IN ('GPC', 'SAV', 'GTC', 'MEAG', 'DU', 'DESC')),
	CONSTRAINT "projects_confidence_ck" CHECK ("projects"."confidence" IN ('verified', 'high', 'medium', 'low')),
	CONSTRAINT "projects_project_type_ck" CHECK ("projects"."project_type" IS NULL OR "projects"."project_type" IN ('line', 'station', 'multi_station', 'non_geographic')),
	CONSTRAINT "projects_work_type_ck" CHECK ("projects"."work_type" IS NULL OR "projects"."work_type" IN ('rebuild', 'new_build', 'station_equipment')),
	CONSTRAINT "projects_status_ck" CHECK ("projects"."status" IS NULL OR "projects"."status" IN ('In Progress', 'Planned')),
	CONSTRAINT "projects_start_date_source_ck" CHECK ("projects"."start_date_source" IS NULL OR "projects"."start_date_source" IN ('published', 'from_spend_year', 'estimated')),
	CONSTRAINT "projects_miles_source_ck" CHECK ("projects"."miles_source" IS NULL OR "projects"."miles_source" IN ('stated', 'estimated_from_endpoints', 'not_applicable')),
	CONSTRAINT "projects_cost_range_ck" CHECK ("projects"."cost_low" IS NULL OR "projects"."cost_high" IS NULL OR "projects"."cost_low" <= "projects"."cost_high"),
	CONSTRAINT "projects_line_miles_ck" CHECK ("projects"."line_miles" IS NULL OR "projects"."line_miles" >= 0),
	CONSTRAINT "projects_voltage_kv_ck" CHECK ("projects"."voltage_kv" IS NULL OR "projects"."voltage_kv" > 0),
	CONSTRAINT "projects_source_page_ck" CHECK ("projects"."source_page" IS NULL OR "projects"."source_page" > 0)
);

ALTER TABLE "project_points" ADD CONSTRAINT "project_points_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "projects_utility_idx" ON "projects" USING btree ("utility");
CREATE INDEX "projects_in_service_date_idx" ON "projects" USING btree ("in_service_date");
CREATE VIEW "public"."project_geo" AS (
  select
    p.id as project_id,
    case
      when count(pt.lat) = 0 then null
      when p.project_type = 'multi_station' then avg(pt.lat)
      else (
        (array_agg(pt.lat order by pt.seq) filter (where pt.lat is not null))[1]
        + (array_agg(pt.lat order by pt.seq desc) filter (where pt.lat is not null))[1]
      ) / 2.0
    end as center_lat,
    case
      when count(pt.lat) = 0 then null
      when p.project_type = 'multi_station' then avg(pt.lon)
      else (
        (array_agg(pt.lon order by pt.seq) filter (where pt.lat is not null))[1]
        + (array_agg(pt.lon order by pt.seq desc) filter (where pt.lat is not null))[1]
      ) / 2.0
    end as center_lon,
    coalesce(
      jsonb_agg(jsonb_build_array(pt.lon, pt.lat) order by pt.seq) filter (where pt.lat is not null),
      '[]'::jsonb
    ) as shape,
    count(pt.lat)::int as points_located,
    count(pt.project_id)::int as points_total,
    case min(
      case coalesce(pt.confidence, 'low')
        when 'verified' then 4
        when 'high' then 3
        when 'medium' then 2
        when 'low' then 1
      end
    )
      when 4 then 'verified'
      when 3 then 'high'
      when 2 then 'medium'
      when 1 then 'low'
      else 'low'
    end as location_confidence,
    coalesce(bool_and(coalesce(pt.confidence, 'low') = 'verified'), false) as confirmed
  from projects p
  left join project_points pt on pt.project_id = p.id
  group by p.id, p.project_type
);

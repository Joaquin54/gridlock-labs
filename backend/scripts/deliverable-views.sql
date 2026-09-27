CREATE OR REPLACE VIEW "overlap_table" AS
with located as (
  select
    p.id, p.utility, p.project_key, p.name, p.owner_in_scope, p.confidence,
    p.in_service_date, g.center_lat, g.center_lon
  from projects p
  join project_geo g on g.project_id = p.id
  where g.center_lat is not null and g.center_lon is not null
),
pairs as (
  select
    'DESC_' || a.project_key as project_id_a,
    a.name as project_name_a,
    a.confidence as confidence_a,
    a.in_service_date as in_service_a,
    'GPC_' || b.project_key as project_id_b,
    b.name as project_name_b,
    b.confidence as confidence_b,
    b.in_service_date as in_service_b,
    -- Same sphere and radius as src/queries/overlaps.ts. Unrounded here; the
    -- rounding happens once, on the way out.
    2 * 3958.8 * asin(sqrt(
      power(sin(radians(b.center_lat - a.center_lat) / 2), 2) +
      cos(radians(a.center_lat)) * cos(radians(b.center_lat)) *
      power(sin(radians(b.center_lon - a.center_lon) / 2), 2)
    )) as distance_exact
  from located a
  cross join located b
  where a.utility = 'DESC' and b.utility = 'GPC' and b.owner_in_scope
)
select
  'OVL_' || row_number() over (
    order by distance_exact, project_id_a, project_id_b
  ) as overlap_id,
  round(distance_exact::numeric, 2) as distance_mi,
  abs(in_service_b - in_service_a) as "time_gap (day)",
  'Dominion Energy South Carolina' as utility_a,
  project_id_a,
  project_name_a,
  'Georgia Power' as utility_b,
  project_id_b,
  project_name_b,
  confidence_a,
  confidence_b
from pairs
where distance_exact < 25
order by distance_exact, project_id_a, project_id_b;

CREATE OR REPLACE VIEW "project_table" AS
with located as (
  select
    p.id, p.utility, p.project_key, p.owner_in_scope, p.in_service_date,
    g.center_lat, g.center_lon
  from projects p
  join project_geo g on g.project_id = p.id
  where g.center_lat is not null and g.center_lon is not null
),
pairs as (
  select
    a.id as id_a,
    'DESC_' || a.project_key as project_id_a,
    b.id as id_b,
    'GPC_' || b.project_key as project_id_b,
    2 * 3958.8 * asin(sqrt(
      power(sin(radians(b.center_lat - a.center_lat) / 2), 2) +
      cos(radians(a.center_lat)) * cos(radians(b.center_lat)) *
      power(sin(radians(b.center_lon - a.center_lon) / 2), 2)
    )) as distance_exact
  from located a
  cross join located b
  where a.utility = 'DESC' and b.utility = 'GPC' and b.owner_in_scope
),
in_range as (
  select * from pairs where distance_exact < 25
),
partners as (
  select id_a as project_id, project_id_b as partner, distance_exact from in_range
  union all
  select id_b as project_id, project_id_a as partner, distance_exact from in_range
),
partner_agg as (
  select
    project_id,
    count(*)::int as overlap_count,
    array_agg(partner order by distance_exact, partner) as partners
  from partners
  group by project_id
),
ends as (
  select
    pp.project_id,
    (array_agg(pp.name order by pp.seq))[1] as name_a,
    (array_agg(pp.lat order by pp.seq))[1] as lat_a,
    (array_agg(pp.lon order by pp.seq))[1] as lon_a,
    case when count(*) > 1 then (array_agg(pp.name order by pp.seq desc))[1] end as name_b,
    case when count(*) > 1 then (array_agg(pp.lat order by pp.seq desc))[1] end as lat_b,
    case when count(*) > 1 then (array_agg(pp.lon order by pp.seq desc))[1] end as lon_b
  from project_points pp
  group by pp.project_id
)
select
  p.utility || '_' || p.project_key as project_id,
  case p.utility when 'DESC' then 'Dominion Energy South Carolina' else 'Georgia Power' end as utility,
  case p.utility when 'DESC' then 'SC' else 'GA' end as state,
  p.name as project_name,
  e.name_a, e.lat_a, e.lon_a,
  e.name_b, e.lat_b, e.lon_b,
  g.center_lat as lat_center,
  g.center_lon as lon_center,
  -- M/D/YYYY without zero padding, for this view only; the table keeps ISO.
  to_char(p.in_service_date, 'FMMM/FMDD/YYYY') as in_service_date,
  coalesce(a.overlap_count, 0) as overlap_count,
  a.partners[1] as overlap_1,
  a.partners[2] as overlap_2,
  a.partners[3] as overlap_3,
  a.partners[4] as overlap_4,
  a.partners[5] as overlap_5,
  a.partners[6] as overlap_6,
  a.partners[7] as overlap_7,
  a.partners[8] as overlap_8,
  a.partners[9] as overlap_9,
  a.partners[10] as overlap_10,
  a.partners[11] as overlap_11,
  a.partners[12] as overlap_12,
  a.partners[13] as overlap_13,
  a.partners[14] as overlap_14,
  a.partners[15] as overlap_15,
  a.partners[16] as overlap_16,
  p.confidence
from projects p
join project_geo g on g.project_id = p.id
left join ends e on e.project_id = p.id
left join partner_agg a on a.project_id = p.id
order by case p.utility when 'DESC' then 0 else 1 end, p.id;

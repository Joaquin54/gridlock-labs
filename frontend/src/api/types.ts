export type ApiUtility = "DESC" | "GPC";

export type ApiWireConfidence = "high" | "medium" | "low";

export type ApiGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "MultiPoint"; coordinates: [number, number][] };

export type ApiProjectPoint = {
  seq: number;
  name: string;
  lat: number | null;
  lon: number | null;
  method: string | null;
  confidence: ApiWireConfidence;
  match_name: string | null;
  match_score: number | null;
  source_url: string | null;
};

export type ApiProjectProperties = {
  id: string;
  utility: ApiUtility;
  project_key: string;
  name: string;
  description: string | null;
  owner: string;
  owner_in_scope: boolean;
  project_type: string | null;
  work_type: string | null;
  voltage_kv: number | null;
  zone: string | null;
  is_border: boolean;
  status: string | null;
  start_date: string | null;
  start_date_source: string | null;
  in_service_date: string;
  in_service_raw: string | null;
  line_miles: number | null;
  miles_source: string | null;
  cost_usd: number | null;
  cost_low: number | null;
  cost_high: number | null;
  source_doc: string;
  source_page: number;
  center: [number, number] | null;
  located: boolean;
  location_confidence: ApiWireConfidence | null;
  points_located: number;
  points_total: number;
  points: ApiProjectPoint[];
};

export type ApiProjectFeature = {
  type: "Feature";
  id: string;
  geometry: ApiGeometry | null;
  properties: ApiProjectProperties;
};

export type ApiProjectCollection = {
  type: "FeatureCollection";
  features: ApiProjectFeature[];
};

export type ApiOverlap = {
  desc_id: string;
  desc_name: string;
  gpc_id: string;
  gpc_name: string;
  gpc_owner: string;
  distance_mi: number;
  desc_start: string | null;
  desc_in_service: string;
  gpc_start: string | null;
  gpc_in_service: string;
  in_service_gap_days: number;
  window_overlap_days: number | null;
  window_gap_days: number | null;
  desc_start_source: string | null;
  gpc_start_source: string | null;
  pair_confidence: ApiWireConfidence;
  borderline: boolean;
  shared_assets: string[];
};

export type ApiStats = {
  projects: Record<ApiUtility, number>;
  located: Record<ApiUtility, number>;
  unlocated: Record<ApiUtility, number>;
  confidence: Record<ApiWireConfidence, number>;
  overlaps: Record<ApiWireConfidence, number> & { total: number };
};

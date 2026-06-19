import { authHeaders } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type StandardRef = {
  code: string;
  title: string;
  clause: string;
  description: string;
};

export type CalculatorMeta = {
  slug: string;
  discipline: string;
  name: string;
  description: string;
  order: number;
  standard_ref: string;
  standards?: StandardRef[];
};

export type CalculateResponse = {
  result: Record<string, unknown>;
  warnings: string[];
  recommendations: Record<string, unknown[]>;
  chart?: {
    type: string;
    title?: string;
    x_label?: string;
    y_label?: string;
    limit_y?: number;
    series?: Array<{ name: string; data?: unknown[]; value?: number }>;
  } | null;
  system?: SystemResult;
};

export type SystemEdgeResult = {
  id?: string;
  from_id?: string;
  to_id?: string;
  from: string;
  to: string;
  length_m: number;
  cable: string;
  cable_id?: number;
  section_mm2: number;
  i_a: number;
  delta_u_percent: number;
  ik_a: number;
  ik_ka: number;
  breaker_ok: boolean;
  breaker: string | null;
  breaker_id?: number | null;
  manual_cable?: boolean;
  manual_breaker?: boolean;
  auto_cable?: boolean;
  auto_breaker?: boolean;
  ok?: boolean;
  violations?: string[];
  phase?: string;
  u_nom_v?: number;
};

export type SystemGraphUpdate = {
  id?: string;
  source: string;
  target: string;
  cable_id?: number | null;
  breaker_id?: number | null;
  section_mm2?: number;
  manual_cable?: boolean;
  manual_breaker?: boolean;
  phase?: string;
  u_nom_v?: number;
};

export type SystemResult = {
  nodes: Record<string, {
    label: string;
    node_type: string;
    p_kw: number;
    i_a: number;
    z_source_mohm?: number;
    s_kva?: number;
  }>;
  edges: SystemEdgeResult[];
  warnings: string[];
  graph_updates?: SystemGraphUpdate[];
  summary: Record<string, unknown>;
};

export async function fetchCalculators(discipline?: string): Promise<CalculatorMeta[]> {
  const url = discipline
    ? `${API_URL}/api/v1/calculators/?discipline=${discipline}`
    : `${API_URL}/api/v1/calculators/`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error("Failed to fetch calculators");
  return res.json();
}

export async function fetchStandards(slug: string): Promise<{ standard_ref: string; standards: StandardRef[] }> {
  const res = await fetch(`${API_URL}/api/v1/calculators/${slug}/standards/`, { cache: "no-store" });
  if (!res.ok) return { standard_ref: "", standards: [] };
  return res.json();
}

export async function fetchSchema(slug: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_URL}/api/v1/calculators/${slug}/schema/`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch schema");
  return res.json();
}

export async function calculate(
  slug: string,
  data: Record<string, unknown>,
  projectId?: number
): Promise<CalculateResponse> {
  const res = await fetch(`${API_URL}/api/v1/calculators/${slug}/calculate/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, project_id: projectId ?? null }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Calculation failed");
  }
  return res.json();
}

export async function fetchSystemTemplate(): Promise<{
  nodes: unknown[];
  edges: unknown[];
  defaults?: SystemDefaults;
}> {
  const res = await fetch(`${API_URL}/api/v1/electrical/system/template/`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch template");
  return res.json();
}

export type SystemDefaults = {
  transformer: {
    s_kva: number;
    uk_percent: number;
    u_primary_kv: number;
    u_secondary_v: number;
    transformer_id: number;
  };
  z_source_mohm: number;
  u_nom_v: number;
  edge: { length_m: number; cable_id: number; breaker_id: number };
  node_defaults: Record<string, Record<string, unknown>>;
};

export async function fetchSystemDefaults(): Promise<SystemDefaults> {
  const res = await fetch(`${API_URL}/api/v1/electrical/system/defaults/`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch defaults");
  return res.json();
}

export async function fetchTransformers() {
  const res = await fetch(`${API_URL}/api/v1/catalog/transformers/`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  return res.json();
}

export async function calculateSystem(
  graphData: { nodes: unknown[]; edges: unknown[] },
  uNomV = 400,
  zSourceMohm = 10
): Promise<SystemResult> {
  const res = await fetch(`${API_URL}/api/v1/electrical/system/calculate/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      graph_data: graphData,
      u_nom_v: uNomV,
      z_source_mohm: zSourceMohm,
    }),
  });
  if (!res.ok) throw new Error("System calculation failed");
  return res.json();
}

export type SavedSystemMeta = {
  id: number;
  name: string;
  u_nom_v: number;
  z_source_mohm?: number;
  updated_at: string;
  last_result?: SystemResult;
  graph_data?: { nodes: unknown[]; edges: unknown[] };
};

export async function fetchSystems(): Promise<SavedSystemMeta[]> {
  const res = await fetch(`${API_URL}/api/v1/electrical/systems/`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchSystem(id: number): Promise<SavedSystemMeta> {
  const res = await fetch(`${API_URL}/api/v1/electrical/systems/${id}/`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load system");
  return res.json();
}

export async function createSystem(payload: {
  name: string;
  graph_data: { nodes: unknown[]; edges: unknown[] };
  u_nom_v: number;
  z_source_mohm: number;
}): Promise<SavedSystemMeta & { result: SystemResult }> {
  const res = await fetch(`${API_URL}/api/v1/electrical/systems/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save system");
  return res.json();
}

export async function updateSystem(
  id: number,
  payload: {
    name?: string;
    graph_data?: { nodes: unknown[]; edges: unknown[] };
    u_nom_v?: number;
    z_source_mohm?: number;
  }
): Promise<SavedSystemMeta & { result: SystemResult }> {
  const res = await fetch(`${API_URL}/api/v1/electrical/systems/${id}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update system");
  return res.json();
}

export async function deleteSystem(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/electrical/systems/${id}/`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete system");
}

export async function fetchCables(params?: Record<string, string | number>) {
  const qs = params
    ? "?" + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
    : "";
  const res = await fetch(`${API_URL}/api/v1/catalog/cables/${qs}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json() as Promise<CableItem[]>;
}

export async function fetchCableBrands() {
  const res = await fetch(`${API_URL}/api/v1/catalog/cables/brands/`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  return res.json() as Promise<Array<{ id: number; name: string; description: string }>>;
}

export async function fetchBreakers(params?: Record<string, string | number>) {
  const qs = params ? "?" + new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString() : "";
  const res = await fetch(`${API_URL}/api/v1/catalog/breakers/${qs}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json() as Promise<BreakerItem[]>;
}

export async function fetchBreakersMeta() {
  const res = await fetch(`${API_URL}/api/v1/catalog/breakers/meta/`, { next: { revalidate: 300 } });
  if (!res.ok) return { manufacturers: [], series: [] };
  return res.json() as Promise<{ manufacturers: string[]; series: string[] }>;
}

export type CableItem = {
  id: number;
  name: string;
  brand: string;
  construction: string;
  section_mm2: number;
  cores: number;
  material: string;
  u_max_v: number;
  i_long_a: number;
  r_mohm_per_m: number;
  r_20_mohm_per_m: number | null;
  temp_coeff: number;
  x_mohm_per_m: number;
  outer_diameter_mm: number;
  min_bend_radius_mm: number | null;
  n_core_section_mm2: number | null;
  pe_core_section_mm2: number | null;
  mass_kg_per_m: number | null;
  gost_ref: string;
};

export type BreakerItem = {
  id: number;
  manufacturer: string;
  series: string;
  model_name: string;
  category: string;
  breaker_type: string;
  in_a: number;
  icu_ka: number;
  ics_ka: number | null;
  u_e_v: number;
  u_imp_kv: number;
  curve: string;
  poles: number;
  has_rcd: boolean;
  rcd_type: string;
  rcd_in_ma: number | null;
  gost_ref: string;
};

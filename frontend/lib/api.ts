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

export type SystemResult = {
  nodes: Record<string, {
    label: string;
    node_type: string;
    p_kw: number;
    i_a: number;
    z_source_mohm?: number;
    s_kva?: number;
  }>;
  edges: Array<{
    from: string;
    to: string;
    length_m: number;
    cable: string;
    section_mm2: number;
    outer_diameter_mm: number;
    i_a: number;
    delta_u_percent: number;
    ik_a: number;
    ik_ka: number;
    breaker_ok: boolean;
    breaker: string | null;
  }>;
  warnings: string[];
  summary: Record<string, unknown>;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      graph_data: graphData,
      u_nom_v: uNomV,
      z_source_mohm: zSourceMohm,
    }),
  });
  if (!res.ok) throw new Error("System calculation failed");
  return res.json();
}

export async function fetchCables() {
  const res = await fetch(`${API_URL}/api/v1/catalog/cables/`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchBreakers() {
  const res = await fetch(`${API_URL}/api/v1/catalog/breakers/`, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  return res.json();
}

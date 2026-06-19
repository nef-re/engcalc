import type { TransformerItem } from "@/lib/api";
import { DEFAULT_TP_VOLTAGE, TP_VOLTAGE_OPTIONS } from "@/lib/cables";

export type TpElectrical = {
  s_kva: number;
  uk_percent: number;
  u_secondary_v: number;
  transformer_count: number;
  z_mohm: number;
};

export const DEFAULT_TRANSFORMER_NAME = "ТМГ-630/10";
export const TP_PRIMARY_KV_OPTIONS = [6, 10] as const;

export function calcTransformerZMohm(
  sKva: number,
  ukPercent: number,
  uSecondaryV: number
): number {
  if (sKva <= 0) return 10;
  const sVa = sKva * 1000;
  const zOhm = (ukPercent / 100) * (uSecondaryV ** 2) / sVa;
  return Math.round(zOhm * 1000 * 1000) / 1000;
}

export function findDefaultTransformer(
  catalog: TransformerItem[]
): TransformerItem | undefined {
  return catalog.find((t) => t.name === DEFAULT_TRANSFORMER_NAME);
}

export function catalogTransformerNodeData(
  tr: TransformerItem,
  base: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...base,
    node_type: "transformer_substation",
    transformer_id: tr.id,
    s_kva: tr.s_kva,
    uk_percent: tr.uk_percent,
    u_secondary_v: tr.u_secondary_v,
    u_primary_kv: tr.u_primary_kv,
    transformer_count: Number(base.transformer_count ?? 1) >= 2 ? 2 : 1,
    label: base.label ?? "ТП",
    z_source_mohm: undefined,
  };
}

export function applyDefaultTpCatalogToNodes<T extends { data: Record<string, unknown> }>(
  nodes: T[],
  catalog: TransformerItem[],
  onlyIfMissing = true
): T[] {
  const tr = findDefaultTransformer(catalog);
  if (!tr) return nodes;
  return nodes.map((n) => {
    const data = n.data;
    if (data.node_type !== "transformer_substation") return n;
    const tid = data.transformer_id;
    if (onlyIfMissing && tid != null && tid !== "" && Number(tid) > 0) return n;
    return { ...n, data: catalogTransformerNodeData(tr, data) };
  });
}

export function filterTransformers(
  list: TransformerItem[],
  uPrimaryKv: number,
  sKvaMax?: number
): TransformerItem[] {
  return list.filter((t) => {
    if (t.u_primary_kv !== uPrimaryKv) return false;
    if (sKvaMax != null && t.s_kva > sKvaMax) return false;
    return true;
  });
}

export function resolveTpElectrical(
  data: Record<string, unknown>,
  catalog: TransformerItem[]
): TpElectrical {
  const count = Number(data.transformer_count ?? 1) >= 2 ? 2 : 1;
  let s_kva = Number(data.s_kva ?? 630);
  let uk_percent = Number(data.uk_percent ?? 6);
  let u_secondary_v = Number(data.u_secondary_v ?? DEFAULT_TP_VOLTAGE);

  const tid = data.transformer_id;
  if (tid != null && tid !== "" && Number(tid) > 0) {
    const tr = catalog.find((t) => t.id === Number(tid));
    if (tr) {
      s_kva = tr.s_kva;
      uk_percent = tr.uk_percent;
      u_secondary_v = tr.u_secondary_v;
    }
  }

  const z_mohm =
    data.z_source_mohm != null && data.z_source_mohm !== ""
      ? Number(data.z_source_mohm)
      : calcTransformerZMohm(s_kva, uk_percent, u_secondary_v);

  return { s_kva, uk_percent, u_secondary_v, transformer_count: count, z_mohm };
}

export function isTpManualMode(data: Record<string, unknown>): boolean {
  const tid = data.transformer_id;
  return tid == null || tid === "" || Number(tid) <= 0;
}

export { DEFAULT_TP_VOLTAGE, TP_VOLTAGE_OPTIONS };

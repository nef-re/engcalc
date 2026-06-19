/** Нормализация маркировки: «3x×16» / «3x16» → «3×16». */

export function formatCableMarking(name: string): string {

  if (!name) return name;

  return name

    .replace(/(\d+)x×/gi, "$1×")

    .replace(/(\d+)x(\d+\.?\d*)/g, "$1×$2");

}



/** Форматирование значений результата, если это маркировка кабеля. */

export function formatCableResultValue(key: string, value: unknown): string {

  const str = value === null || value === undefined ? "—" : String(value);

  if (key === "selected_cable" || key === "cable") return formatCableMarking(str);

  return str;

}



export function formatConstructionLabel(construction: string): string {

  if (construction === "3+1") return "3+1";

  if (construction.endsWith("x")) return `${construction.slice(0, -1)}×`;

  return construction;

}



export const TP_VOLTAGE_OPTIONS = [380, 400] as const;
export const DEFAULT_TP_VOLTAGE = 400;

/** Линейное напряжение ТП: 380 или 400 В */
export function normalizeTpLineVoltage(u: number): number {
  return u >= 390 ? 400 : 380;
}

/** U для расчёта нагрузки: 3Ф = Uлинии ТП, 1Ф = 230 (400/√3) или 220 (380/√3) */
export function loadVoltageFromTp(tpLineV: number, phase: string): number {
  const line = normalizeTpLineVoltage(tpLineV);
  if (phase === "3") return line;
  return line >= 390 ? 230 : 220;
}

/** @deprecated используйте loadVoltageFromTp */
export function defaultVoltageForPhase(phase: string, tpLineV = DEFAULT_TP_VOLTAGE): number {
  return loadVoltageFromTp(tpLineV, phase);
}



export type CableFilterOptions = {

  section?: number | "";

  cores?: number | "";

  constructions?: string[];

};



export function filterCablesForEdge<T extends { construction: string; section_mm2: number; cores: number }>(

  cables: T[],

  filters?: CableFilterOptions

): T[] {

  const allowed = filters?.constructions;

  return cables.filter((c) => {

    if (allowed?.length && !allowed.includes(c.construction)) return false;

    if (filters?.section !== undefined && filters.section !== "" && c.section_mm2 !== filters.section) {

      return false;

    }

    if (filters?.cores !== undefined && filters.cores !== "" && c.cores !== filters.cores) {

      return false;

    }

    return true;

  });

}



export function allowedConstructionsForSegment(

  srcNodeType: string,

  has3ph: boolean,

  has1ph: boolean,

  armored: boolean,

  manual: boolean

): string[] {

  if (armored) return manual ? ["4x", "5x"] : ["4x"];

  if (has3ph) return manual ? ["4x", "5x"] : ["5x"];

  if (has1ph && !has3ph) return manual ? ["2x", "3x"] : ["3x"];

  return manual ? ["4x", "5x"] : ["5x"];

}



export function subtreeLoadNodes(

  startId: string,

  nodes: { id: string; data?: Record<string, unknown> }[],

  edges: { source: string; target: string }[]

): Record<string, unknown>[] {

  const nodeMap = new Map(nodes.map((n) => [n.id, n.data ?? {}]));

  const children = new Map<string, string[]>();

  for (const e of edges) {

    const list = children.get(e.source) ?? [];

    list.push(e.target);

    children.set(e.source, list);

  }



  const result: Record<string, unknown>[] = [];

  const stack = [startId];

  const seen = new Set<string>();

  while (stack.length) {

    const nid = stack.pop()!;

    if (seen.has(nid)) continue;

    seen.add(nid);

    const data = nodeMap.get(nid) ?? {};

    if (data.node_type === "load") result.push(data);

    for (const cid of children.get(nid) ?? []) stack.push(cid);

  }

  return result;

}



export function uniqueCableSections<T extends { section_mm2: number }>(cables: T[]): number[] {

  return Array.from(new Set(cables.map((c) => c.section_mm2))).sort((a, b) => a - b);

}



export function uniqueCableCores<T extends { cores: number }>(cables: T[]): number[] {

  return Array.from(new Set(cables.map((c) => c.cores))).sort((a, b) => a - b);

}



/** Компактная строка списка каталога */

export const compactListItemCls =

  "w-full border-b border-slate-800/60 px-2 py-1 text-left text-xs leading-tight transition hover:bg-slate-800/50";



export const compactListItemActiveCls =

  "bg-sky-950/40 border-l-2 border-l-sky-500";


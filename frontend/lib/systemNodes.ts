export type NodeType =
  | "transformer_substation"
  | "vru"
  | "distribution_board"
  | "group_board"
  | "load";

export const NODE_LABELS: Record<NodeType, string> = {
  transformer_substation: "ТП",
  vru: "ВРУ",
  distribution_board: "РЩ",
  group_board: "ГЩ",
  load: "Нагрузка",
};

export const ADD_BUTTONS: { type: NodeType; label: string; color: string }[] = [
  { type: "transformer_substation", label: "+ ТП", color: "border-rose-500/50 text-rose-300 hover:bg-rose-950/50" },
  { type: "vru", label: "+ ВРУ", color: "border-amber-500/50 text-amber-300 hover:bg-amber-950/50" },
  { type: "distribution_board", label: "+ РЩ", color: "border-sky-500/50 text-sky-300 hover:bg-sky-950/50" },
  { type: "group_board", label: "+ ГЩ", color: "border-violet-500/50 text-violet-300 hover:bg-violet-950/50" },
  { type: "load", label: "+ Нагрузка", color: "border-emerald-500/50 text-emerald-300 hover:bg-emerald-950/50" },
];

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
  node_defaults: Record<NodeType, Record<string, unknown>>;
};

let _counter = 0;
export function nextNodeId(type: NodeType): string {
  _counter += 1;
  return `${type}-${Date.now()}-${_counter}`;
}

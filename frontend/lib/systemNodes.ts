export type NodeType =

  | "transformer_substation"

  | "vru"

  | "distribution_board"

  | "group_board"

  | "load";



export const NODE_LABELS: Record<NodeType, string> = {

  transformer_substation: "ТП",

  vru: "ВРУ",

  distribution_board: "ЩС",

  group_board: "ГЩ",

  load: "Нагрузка",

};



/** Стили узлов на схеме — общие для блоков и кнопок добавления */
export const NODE_BLOCK_CLASSES: Record<NodeType, string> = {

  transformer_substation: "border-rose-500/60 bg-rose-950/40",

  vru: "border-amber-500/60 bg-amber-950/40",

  distribution_board: "border-sky-500/60 bg-sky-950/40",

  group_board: "border-violet-500/60 bg-violet-950/40",

  load: "border-emerald-500/60 bg-emerald-950/40",

};



export const ADD_BUTTONS: { type: NodeType; label: string; color: string }[] = [

  {
    type: "transformer_substation",
    label: "+ ТП",
    color: `${NODE_BLOCK_CLASSES.transformer_substation} hover:border-rose-400/70 hover:bg-rose-950/55`,
  },

  {
    type: "vru",
    label: "+ ВРУ",
    color: `${NODE_BLOCK_CLASSES.vru} hover:border-amber-400/70 hover:bg-amber-950/55`,
  },

  {
    type: "distribution_board",
    label: "+ ЩС",
    color: `${NODE_BLOCK_CLASSES.distribution_board} hover:border-sky-400/70 hover:bg-sky-950/55`,
  },

  {
    type: "load",
    label: "+ Нагрузка",
    color: `${NODE_BLOCK_CLASSES.load} hover:border-emerald-400/70 hover:bg-emerald-950/55`,
  },

];



export type SystemDefaults = {

  transformer: {

    s_kva: number;

    uk_percent: number;

    u_primary_kv: number;

    u_secondary_v: number;

    transformer_id: number | null;

    transformer_count: number;

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


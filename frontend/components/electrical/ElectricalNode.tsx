"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

const COLORS: Record<string, string> = {
  transformer_substation: "border-rose-500/60 bg-rose-950/40",
  vru: "border-amber-500/60 bg-amber-950/40",
  distribution_board: "border-sky-500/60 bg-sky-950/40",
  group_board: "border-violet-500/60 bg-violet-950/40",
  load: "border-emerald-500/60 bg-emerald-950/40",
};

const LABELS: Record<string, string> = {
  transformer_substation: "ТП",
  vru: "ВРУ/ГРЩ",
  distribution_board: "ЩС",
  group_board: "ГЩ",
  load: "Нагрузка",
};

export type ElectricalNodeData = {
  label: string;
  node_type: string;
  p_kw?: number;
  cos_phi?: number;
  kc?: number;
  phase?: string;
  i_a?: number;
  s_kva?: number;
  uk_percent?: number;
  u_secondary_v?: number;
  z_source_mohm?: number;
  has_violation?: boolean;
};

const HANDLE_CLASS =
  "!h-3.5 !w-3.5 !min-h-[14px] !min-w-[14px] !border-2 !border-sky-100 !bg-sky-400 !shadow-[0_0_8px_rgba(56,189,248,0.7)]";

const HANDLE_TARGETS = [
  { id: "in", position: Position.Left },
  { id: "in-top", position: Position.Top },
  { id: "in-bottom", position: Position.Bottom },
] as const;

const HANDLE_SOURCES = [
  { id: "out", position: Position.Right },
  { id: "out-top", position: Position.Top },
  { id: "out-bottom", position: Position.Bottom },
] as const;

function ElectricalNode({ data, selected }: NodeProps) {
  const d = data as ElectricalNodeData;
  const ntype = d.node_type || "load";
  const color = COLORS[ntype] || COLORS.load;
  const isSource = ntype === "transformer_substation";

  return (
    <div
      className={`min-w-[140px] rounded-xl border-2 px-3 py-2 shadow-lg ${color} ${
        d.has_violation ? "ring-2 ring-red-400/80" : selected ? "ring-2 ring-white/30" : ""
      }`}
    >
      {!isSource &&
        HANDLE_TARGETS.map((h) => (
          <Handle key={h.id} type="target" position={h.position} id={h.id} className={HANDLE_CLASS} />
        ))}
      <p className="text-[10px] uppercase tracking-wide text-slate-500">
        {LABELS[ntype] || ntype}
      </p>
      <p className="font-semibold text-slate-100">{d.label}</p>
      {ntype === "transformer_substation" && d.s_kva != null && (
        <p className="text-xs text-slate-400">S = {d.s_kva} кВА</p>
      )}
      {ntype === "load" && d.p_kw != null && (
        <p className="text-xs text-slate-400">P = {d.p_kw} кВт</p>
      )}
      {d.i_a != null && (
        <p className="text-xs text-sky-300">I = {d.i_a} А</p>
      )}
      {d.z_source_mohm != null && (
        <p className="text-xs text-rose-300">Z = {d.z_source_mohm} мОм</p>
      )}
      {HANDLE_SOURCES.map((h) => (
        <Handle key={h.id} type="source" position={h.position} id={h.id} className={HANDLE_CLASS} />
      ))}
    </div>
  );
}

export default memo(ElectricalNode);

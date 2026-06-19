"use client";

import { createContext, memo, useCallback, useContext } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { NodePort } from "@/lib/nodePorts";
import { NODE_BLOCK_CLASSES } from "@/lib/systemNodes";
import {
  vruActiveSections,
  vruDualInputs,
  vruHandleTop,
  vruHasSectionSwitch,
  vruInputLabel,
  vruNodeHeight,
  vruRowCenters,
  vruSectionsMerged,
  vruSwitchLabel,
  type VruScheme,
  type VruSectionBreaker,
  type VruSectionLoad,
} from "@/lib/vru";

const COLORS: Record<string, string> = NODE_BLOCK_CLASSES;

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
  u_primary_kv?: number;
  transformer_id?: number;
  transformer_count?: number;
  z_source_mohm?: number;
  has_violation?: boolean;
  input_ports?: NodePort[];
  output_ports?: NodePort[];
  tap_ports?: NodePort[];
  breaker_id?: number;
  breaker_in_a?: number;
  breaker_label?: string;
  selectivity_ok?: boolean;
  manual_breaker?: boolean;
  vru_scheme?: string;
  vru_section_switch?: string;
  vru_operating_mode?: string;
  vru_tap_in0?: boolean;
  vru_tap_in1?: boolean;
  vru_sections?: VruSectionLoad[];
  vru_section_breakers?: VruSectionBreaker[];
  vru_merged?: boolean;
};

type NodePortActions = {
  addInputPort: (nodeId: string) => void;
  addOutputPort: (nodeId: string) => void;
  removeInputPort: (nodeId: string) => void;
  removeOutputPort: (nodeId: string) => void;
  toggleVruSectionSwitch: (nodeId: string) => void;
};

export const NodePortContext = createContext<NodePortActions | null>(null);

const HANDLE_CLASS = "electrical-node-handle";
const TAP_HANDLE_CLASS = "electrical-node-handle electrical-node-handle-tap";

const HANDLE_SIZE_PX = 14;
const HANDLE_GAP_PX = 14;
const PORT_BLOCK_V_PAD_PX = 12;
const MIN_NODE_HEIGHT_PX = 56;

function nodeHeightForPorts(maxPorts: number): number {
  const n = Math.max(1, maxPorts);
  if (n <= 1) return MIN_NODE_HEIGHT_PX;
  const stackHeight = n * HANDLE_SIZE_PX + (n - 1) * HANDLE_GAP_PX;
  return Math.max(MIN_NODE_HEIGHT_PX, stackHeight + PORT_BLOCK_V_PAD_PX * 2);
}

function portCenterYs(total: number, nodeHeight: number): number[] {
  if (total <= 0) return [];
  if (total === 1) return [nodeHeight / 2];
  const stackHeight = total * HANDLE_SIZE_PX + (total - 1) * HANDLE_GAP_PX;
  const firstCenter = (nodeHeight - stackHeight) / 2 + HANDLE_SIZE_PX / 2;
  return Array.from(
    { length: total },
    (_, i) => firstCenter + i * (HANDLE_SIZE_PX + HANDLE_GAP_PX)
  );
}

function handleTopStyle(index: number, total: number, nodeHeight: number): { top: number } {
  const centers = portCenterYs(total, nodeHeight);
  return { top: centers[index] ?? nodeHeight / 2 };
}

function VruSchematic({
  scheme,
  sectionSwitch,
  operatingMode,
  merged,
  onToggleSwitch,
}: {
  scheme: VruScheme;
  sectionSwitch: string;
  operatingMode: string;
  merged: boolean;
  onToggleSwitch: () => void;
}) {
  const active = vruActiveSections(operatingMode as "normal" | "section1" | "section2");
  const dualIn = vruDualInputs(scheme);
  const showSv = vruHasSectionSwitch(scheme);
  const isClosed = sectionSwitch === "closed";

  const sectionBox = (idx: 0 | 1) =>
    `flex h-9 w-10 items-center justify-center rounded border-2 text-[9px] font-bold transition ${
      active.has(idx)
        ? "border-amber-300/90 bg-amber-900/55 text-amber-100"
        : "border-slate-600/50 bg-slate-900/40 text-slate-500 opacity-45"
    } ${merged && active.has(idx) ? "ring-1 ring-sky-400/45" : ""}`;

  return (
    <div className="relative mx-auto grid w-full max-w-[148px] grid-cols-[1fr_auto_1fr] grid-rows-2 gap-x-0.5 gap-y-0 px-0.5">
      {/* Вертикальные шины С1 — СВ — С2 */}
      <div className="pointer-events-none absolute left-[calc(50%-1px)] top-[14%] h-[72%] w-0.5 bg-amber-400/35" />

      <div className="col-start-1 row-start-1 flex items-center justify-end pr-0.5">
        <div className={sectionBox(0)}>С1</div>
      </div>
      <div className="col-start-1 row-start-2 flex items-center justify-end pr-0.5">
        <div className={sectionBox(1)}>С2</div>
      </div>

      <div className="col-start-2 row-span-2 flex flex-col items-center justify-center">
        {showSv ? (
          <button
            type="button"
            title={
              isClosed
                ? "Секционный выключатель замкнут"
                : "Секционный выключатель разомкнут"
            }
            onClick={(e) => {
              e.stopPropagation();
              onToggleSwitch();
            }}
            className={`z-10 flex h-7 w-7 flex-col items-center justify-center rounded border transition ${
              isClosed
                ? "border-sky-400/90 bg-sky-950/70 hover:bg-sky-900/80"
                : "border-slate-500/80 bg-slate-900/70 hover:border-sky-400/70"
            }`}
          >
            <span
              className={`block h-0.5 w-4 rounded ${isClosed ? "bg-sky-300" : "bg-slate-400"}`}
            />
            <span className="mt-0.5 text-[6px] font-semibold uppercase tracking-wide text-slate-300">
              СВ
            </span>
          </button>
        ) : (
          <div className="flex h-7 w-4 items-center justify-center text-[10px] text-slate-600">
            ‖
          </div>
        )}
      </div>

      <div className="col-start-3 row-start-1 flex items-center justify-start pl-0.5 opacity-0">
        <span className="text-[8px]">→</span>
      </div>
      <div className="col-start-3 row-start-2 flex items-center justify-start pl-0.5 opacity-0">
        <span className="text-[8px]">→</span>
      </div>

      {!dualIn && (
        <div className="pointer-events-none col-span-3 row-span-2 flex items-center justify-start pl-1">
          <span className="text-[8px] font-medium text-amber-200/70">Ввод</span>
        </div>
      )}
    </div>
  );
}

function VruInputLabels({
  scheme,
  nodeHeight,
}: {
  scheme: VruScheme;
  nodeHeight: number;
}) {
  const dualIn = vruDualInputs(scheme);
  const [r0, r1] = vruRowCenters(nodeHeight);

  if (!dualIn) {
    return (
      <div
        className="pointer-events-none absolute left-7 text-[8px] font-medium text-amber-200/85"
        style={{ top: nodeHeight / 2 - 6 }}
      >
        {vruInputLabel(scheme, 0)}
      </div>
    );
  }

  return (
    <>
      <div
        className="pointer-events-none absolute left-7 text-[8px] font-medium text-amber-200/85"
        style={{ top: r0 - 6 }}
      >
        {vruInputLabel(scheme, 0)}
      </div>
      <div
        className="pointer-events-none absolute left-7 text-[8px] font-medium text-amber-200/85"
        style={{ top: r1 - 6 }}
      >
        {vruInputLabel(scheme, 1)}
      </div>
    </>
  );
}

function PortControls({
  side,
  label,
  canAdd,
  canRemove,
  onAdd,
  onRemove,
}: {
  side: "left" | "right";
  label: string;
  canAdd: boolean;
  canRemove: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`flex w-9 shrink-0 flex-col items-center justify-center gap-1 self-stretch py-2 ${
        side === "left" ? "border-r border-slate-600/50" : "border-l border-slate-600/50"
      }`}
    >
      <span className="text-[8px] uppercase tracking-wide text-slate-500">{label}</span>
      <div className="flex flex-col items-center justify-center gap-1">
        {canRemove && (
          <button
            type="button"
            title={`Убрать ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="port-control-btn rounded border border-slate-500/60 text-slate-300 hover:border-red-400/70 hover:bg-red-950/40 hover:text-red-200"
          >
            <span aria-hidden>−</span>
          </button>
        )}
        {canAdd && (
          <button
            type="button"
            title={`Добавить ${label}`}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="port-control-btn rounded border border-slate-500/60 text-slate-300 hover:border-sky-400 hover:bg-sky-950/50 hover:text-sky-200"
          >
            <span aria-hidden>+</span>
          </button>
        )}
      </div>
    </div>
  );
}

function ElectricalNode({ id, data, selected }: NodeProps) {
  const d = data as ElectricalNodeData;
  const actions = useContext(NodePortContext);
  const ntype = d.node_type || "load";
  const color = COLORS[ntype] || COLORS.load;
  const isSource = ntype === "transformer_substation";
  const isVru = ntype === "vru";
  const isLoad = ntype === "load";
  const hasBoardBreaker = ["vru", "distribution_board", "transformer_substation"].includes(ntype);

  const inputPorts = d.input_ports?.length ? d.input_ports : isSource ? [] : [{ id: "in-0" }];
  const outputPorts = d.output_ports?.length ? d.output_ports : isLoad ? [] : [{ id: "out-0" }];
  const tapPorts = (d.tap_ports as NodePort[] | undefined) ?? [];

  const onAddInput = useCallback(() => actions?.addInputPort(id), [actions, id]);
  const onAddOutput = useCallback(() => actions?.addOutputPort(id), [actions, id]);
  const onRemoveInput = useCallback(() => actions?.removeInputPort(id), [actions, id]);
  const onRemoveOutput = useCallback(() => actions?.removeOutputPort(id), [actions, id]);
  const onToggleVruSwitch = useCallback(
    () => actions?.toggleVruSectionSwitch(id),
    [actions, id]
  );

  const displayLabel = (d.label || "").replace("ВРУ/ГРЩ", "ВРУ");
  const vruScheme = (d.vru_scheme ?? "1in_2out") as VruScheme;
  const vruSwitch = d.vru_section_switch ?? "open";
  const vruMode = d.vru_operating_mode ?? "normal";
  const vruMerged = d.vru_merged ?? vruSectionsMerged(vruScheme, vruSwitch);

  const hasTap = tapPorts.length > 0;
  const nodeHeight = isVru ? vruNodeHeight(hasTap) : nodeHeightForPorts(Math.max(inputPorts.length, outputPorts.length));

  const sectionBreakers = d.vru_section_breakers ?? [];
  const sectionLoads = d.vru_sections ?? [];

  return (
    <div
      className={`relative flex min-w-[160px] items-stretch overflow-visible rounded-xl border-2 shadow-lg ${color} ${
        isVru ? "min-w-[200px]" : ""
      } ${d.has_violation ? "ring-2 ring-red-400/80" : selected ? "ring-2 ring-white/30" : ""}`}
      style={{ minHeight: nodeHeight }}
    >
      {isVru ? (
        <>
          {inputPorts.map((port) => (
            <Handle
              key={port.id}
              type="target"
              position={Position.Left}
              id={port.id}
              className={HANDLE_CLASS}
              style={{ top: vruHandleTop(port.id, vruScheme, nodeHeight) }}
            />
          ))}
          {tapPorts.map((port) => (
            <Handle
              key={port.id}
              type="source"
              position={Position.Left}
              id={port.id}
              className={TAP_HANDLE_CLASS}
              style={{ top: vruHandleTop(port.id, vruScheme, nodeHeight) }}
              title="Отпайка с ввода"
            />
          ))}
          {outputPorts.map((port) => (
            <Handle
              key={port.id}
              type="source"
              position={Position.Right}
              id={port.id}
              className={HANDLE_CLASS}
              style={{ top: vruHandleTop(port.id, vruScheme, nodeHeight) }}
            />
          ))}
          <VruInputLabels scheme={vruScheme} nodeHeight={nodeHeight} />
        </>
      ) : (
        <>
          {inputPorts.map((port, i) => (
            <Handle
              key={port.id}
              type="target"
              position={Position.Left}
              id={port.id}
              className={HANDLE_CLASS}
              style={handleTopStyle(i, inputPorts.length, nodeHeight)}
            />
          ))}
          {outputPorts.map((port, i) => (
            <Handle
              key={port.id}
              type="source"
              position={Position.Right}
              id={port.id}
              className={HANDLE_CLASS}
              style={handleTopStyle(i, outputPorts.length, nodeHeight)}
            />
          ))}
        </>
      )}

      {!isSource && !isVru && inputPorts.length > 0 && (
        <PortControls
          side="left"
          label="ввод"
          canAdd={!isLoad}
          canRemove={!isLoad && inputPorts.length > 1}
          onAdd={onAddInput}
          onRemove={onRemoveInput}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-1 py-1.5 text-center">
        <p className="font-semibold text-slate-100">{displayLabel}</p>

        {isVru && (
          <>
            <VruSchematic
              scheme={vruScheme}
              sectionSwitch={vruSwitch}
              operatingMode={vruMode}
              merged={vruMerged}
              onToggleSwitch={onToggleVruSwitch}
            />
            {vruHasSectionSwitch(vruScheme) && (
              <p className="text-[9px] text-slate-500">
                {vruSwitchLabel(vruScheme, vruSwitch)}
                {vruMerged ? " · шины объединены" : ""}
              </p>
            )}
            {hasTap && (
              <p className="text-[8px] text-amber-400/80">отпайка ← оранж. точка</p>
            )}
          </>
        )}

        {ntype === "transformer_substation" && d.s_kva != null && (
          <p className="text-xs text-slate-400">
            {(Number(d.transformer_count ?? 1) >= 2 ? "2×" : "") + d.s_kva} кВА
          </p>
        )}
        {ntype === "load" && d.p_kw != null && (
          <p className="text-xs text-slate-400">P = {d.p_kw} кВт</p>
        )}

        {isVru && sectionLoads.length > 0
          ? sectionLoads.map((sec) =>
              sec.active === false ? null : (
                <p key={sec.section} className="text-[10px] text-sky-300/90">
                  {sec.label}: {sec.i_a != null ? `${sec.i_a} А` : "—"}
                  {sec.tap_i_a != null && sec.tap_i_a > 0 ? ` (отп. ${sec.tap_i_a} А)` : ""}
                </p>
              )
            )
          : d.i_a != null &&
            !isVru && <p className="text-xs text-sky-300">I = {d.i_a} А</p>}

        {d.z_source_mohm != null && (
          <p className="text-xs text-rose-300">Z = {d.z_source_mohm} мОм</p>
        )}

        {isVru && sectionBreakers.length > 0
          ? sectionBreakers.map((sb) => (
              <p key={sb.section} className="text-[10px] text-amber-200">
                {sb.label} QF {sb.breaker_in_a ?? "—"} А
              </p>
            ))
          : hasBoardBreaker &&
            d.breaker_in_a != null &&
            !isVru && <p className="text-xs text-amber-200">QF {d.breaker_in_a} А</p>}

        {isVru && d.breaker_in_a != null && sectionBreakers.length === 0 && (
          <p className="text-xs text-amber-200">QF {d.breaker_in_a} А</p>
        )}

        {hasBoardBreaker && d.selectivity_ok === false && (
          <p className="text-[10px] font-medium text-amber-400">см. селективность</p>
        )}
      </div>

      {!isLoad && outputPorts.length > 0 && !isSource && !isVru && (
        <PortControls
          side="right"
          label="отх."
          canAdd
          canRemove={outputPorts.length > 1}
          onAdd={onAddOutput}
          onRemove={onRemoveOutput}
        />
      )}
    </div>
  );
}

export default memo(ElectricalNode);

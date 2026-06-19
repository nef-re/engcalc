import type { NodeType } from "@/lib/systemNodes";
import {
  applyVruSchemeData,
  isVruTapHandle,
  syncVruPortData,
  type VruScheme,
} from "@/lib/vru";

export type NodePort = { id: string };

export type NodePorts = {
  input_ports: NodePort[];
  output_ports: NodePort[];
};

let _portCounter = 0;

function nextPortId(prefix: "in" | "out"): string {
  _portCounter += 1;
  return `${prefix}-${Date.now()}-${_portCounter}`;
}

export function defaultPortsForNodeType(
  nodeType: NodeType | string,
  transformerCount = 1
): NodePorts {
  if (nodeType === "transformer_substation") {
    const n = Number(transformerCount) >= 2 ? 2 : 1;
    return {
      input_ports: [],
      output_ports: Array.from({ length: n }, (_, i) => ({ id: `out-${i}` })),
    };
  }
  if (nodeType === "vru") {
    const d = syncVruPortData({ node_type: "vru", vru_scheme: "1in_2out" });
    return {
      input_ports: d.input_ports as NodePort[],
      output_ports: d.output_ports as NodePort[],
    };
  }
  if (nodeType === "load") {
    return { input_ports: [{ id: "in-0" }], output_ports: [] };
  }
  return { input_ports: [{ id: "in-0" }], output_ports: [{ id: "out-0" }] };
}

export function ensureNodePorts(
  data: Record<string, unknown>
): NodePorts & Record<string, unknown> {
  const nodeType = String(data.node_type ?? "load");
  const count =
    nodeType === "transformer_substation" ? Number(data.transformer_count ?? 1) : 1;
  if (nodeType === "transformer_substation") {
    const defaults = defaultPortsForNodeType(nodeType, count);
    return {
      ...data,
      input_ports: defaults.input_ports,
      output_ports: defaults.output_ports,
    };
  }
  if (nodeType === "vru") {
    return syncVruPortData({
      ...data,
      vru_scheme: (data.vru_scheme as VruScheme) ?? "1in_2out",
    });
  }
  const defaults = defaultPortsForNodeType(nodeType, count);
  const inputRaw = data.input_ports as NodePort[] | undefined;
  const outputRaw = data.output_ports as NodePort[] | undefined;
  return {
    ...data,
    input_ports:
      Array.isArray(inputRaw) && inputRaw.length > 0 ? inputRaw : defaults.input_ports,
    output_ports:
      Array.isArray(outputRaw) && outputRaw.length > 0 ? outputRaw : defaults.output_ports,
  };
}

export function addInputPortToData(data: Record<string, unknown>): Record<string, unknown> {
  if (String(data.node_type) === "transformer_substation") return data;
  if (String(data.node_type) === "vru") return data;
  const ports = [...((data.input_ports as NodePort[]) ?? []), { id: nextPortId("in") }];
  return { ...data, input_ports: ports };
}

export function addOutputPortToData(data: Record<string, unknown>): Record<string, unknown> {
  if (String(data.node_type) === "transformer_substation") return data;
  if (String(data.node_type) === "vru") return data;
  const ports = [...((data.output_ports as NodePort[]) ?? []), { id: nextPortId("out") }];
  return { ...data, output_ports: ports };
}

export function removeInputPortFromData(data: Record<string, unknown>): Record<string, unknown> | null {
  const ports = (data.input_ports as NodePort[]) ?? [];
  if (ports.length <= 1) return null;
  return { ...data, input_ports: ports.slice(0, -1) };
}

export function removeOutputPortFromData(data: Record<string, unknown>): Record<string, unknown> | null {
  if (String(data.node_type) === "transformer_substation") return null;
  if (String(data.node_type) === "vru") return null;
  const ports = (data.output_ports as NodePort[]) ?? [];
  if (ports.length <= 1) return null;
  return { ...data, output_ports: ports.slice(0, -1) };
}

export function tpOutputPorts(count: number): NodePort[] {
  const n = Number(count) >= 2 ? 2 : 1;
  return Array.from({ length: n }, (_, i) => ({ id: `out-${i}` }));
}

export function applyTpTransformerCount(
  data: Record<string, unknown>,
  count: 1 | 2
): Record<string, unknown> {
  return {
    ...data,
    transformer_count: count,
    output_ports: tpOutputPorts(count),
    z_source_mohm: undefined,
  };
}

export function applyVruScheme(
  data: Record<string, unknown>,
  scheme: VruScheme
): Record<string, unknown> {
  return syncVruPortData(applyVruSchemeData(data, scheme));
}

export function lastRemovedPortId(ports: NodePort[]): string | null {
  return ports.length > 0 ? ports[ports.length - 1].id : null;
}

export const NODE_TYPE_RANK: Record<string, number> = {
  transformer_substation: 0,
  vru: 1,
  distribution_board: 2,
  group_board: 3,
  load: 4,
};

export function isValidConnection(
  sourceType: string,
  targetType: string,
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined
): boolean {
  const srcRank = NODE_TYPE_RANK[sourceType] ?? 50;
  const dstRank = NODE_TYPE_RANK[targetType] ?? 50;
  const sh = sourceHandle || "out-0";
  const th = targetHandle || "in-0";

  if (isVruTapHandle(sh)) {
    if (sourceType !== "vru") return false;
    if (!th.startsWith("in")) return false;
    return targetType === "vru" || targetType === "distribution_board";
  }

  if (srcRank >= dstRank) return false;
  if (!sh.startsWith("out")) return false;
  if (!th.startsWith("in")) return false;
  return true;
}

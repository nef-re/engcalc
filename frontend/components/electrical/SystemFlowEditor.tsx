"use client";

import "@xyflow/react/dist/style.css";
import "./flow-diagram.css";

import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ElectricalNode, { NodePortContext } from "@/components/electrical/ElectricalNode";
import { StandardsPanel } from "@/components/StandardsPanel";
import {
  ADD_BUTTONS,
  NODE_LABELS,
  nextNodeId,
  type NodeType,
  type SystemDefaults,
} from "@/lib/systemNodes";
import {
  addInputPortToData,
  addOutputPortToData,
  applyTpTransformerCount,
  applyVruScheme,
  defaultPortsForNodeType,
  ensureNodePorts,
  isValidConnection,
  lastRemovedPortId,
  removeInputPortFromData,
  removeOutputPortFromData,
  type NodePort,
} from "@/lib/nodePorts";
import {
  allowedConstructionsForSegment,
  filterCablesForEdge,
  formatCableMarking,
  subtreeLoadNodes,
  uniqueCableCores,
  uniqueCableSections,
} from "@/lib/cables";
import {
  applyDefaultTpCatalogToNodes,
  calcTransformerZMohm,
  catalogTransformerNodeData,
  DEFAULT_TP_VOLTAGE,
  filterTransformers,
  findDefaultTransformer,
  isTpManualMode,
  resolveTpElectrical,
  TP_PRIMARY_KV_OPTIONS,
  TP_VOLTAGE_OPTIONS,
} from "@/lib/transformers";
import {
  VRU_MODE_OPTIONS,
  VRU_SCHEME_OPTIONS,
  toggleVruSectionSwitch,
  vruDualInputs,
  vruHasSectionSwitch,
  vruSwitchLabel,
  syncVruPortData,
  type VruOperatingMode,
  type VruScheme,
} from "@/lib/vru";
import { formButtonCls, formFieldCls, formLabelCls } from "@/lib/forms";
import {
  calculateSystem,
  createSystem,
  deleteSystem,
  fetchBreakers,
  fetchCables,
  fetchStandards,
  fetchSystem,
  fetchSystems,
  fetchSystemDefaults,
  fetchSystemTemplate,
  fetchTransformers,
  updateSystem,
  type CableItem,
  type SavedSystemMeta,
  type StandardRef,
  type SystemResult,
  type TransformerItem,
} from "@/lib/api";

const nodeTypes = { custom: ElectricalNode };

const EDGE_STYLE = { stroke: "#0ea5e9", strokeWidth: 3.5 };
const EDGE_STYLE_SELECTED = { stroke: "#7dd3fc", strokeWidth: 5 };
const EDGE_STYLE_ERROR = { stroke: "#f87171", strokeWidth: 4.5 };

function getSourceParamsFromNodes(
  nodes: Node[],
  catalog: TransformerItem[] = []
): { u_nom_v: number; z_source_mohm: number } {
  const tp = nodes.find((n) => (n.data as NodeData).node_type === "transformer_substation");
  if (tp) {
    const tpParams = resolveTpElectrical(tp.data as NodeData, catalog);
    return { u_nom_v: tpParams.u_secondary_v, z_source_mohm: tpParams.z_mohm };
  }
  return { u_nom_v: DEFAULT_TP_VOLTAGE, z_source_mohm: 10 };
}

function mapNodeWithPorts(n: Node): Node {
  return { ...n, data: ensureNodePorts(n.data as Record<string, unknown>) };
}

function mapNodesWithPorts(list: Node[]): Node[] {
  return list.map(mapNodeWithPorts);
}

function withEdgeStyle(edge: Edge, selectedId?: string, hasViolation?: boolean): Edge {
  const isSelected = selectedId === edge.id;
  const style = isSelected
    ? EDGE_STYLE_SELECTED
    : hasViolation
      ? EDGE_STYLE_ERROR
      : EDGE_STYLE;
  return {
    ...edge,
    type: edge.type ?? "smoothstep",
    style,
  };
}

type Breaker = { id: number; manufacturer: string; model_name: string; in_a: number };

type NodeData = Record<string, unknown>;

type EdgeData = {
  length_m?: number;
  cable_id?: number;
  breaker_id?: number;
  section_mm2?: number;
  manual_cable?: boolean;
  manual_breaker?: boolean;
  cable_filter_section?: number | "";
  cable_filter_cores?: number | "";
};

export function SystemFlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selected, setSelected] = useState<{ type: "node" | "edge"; id: string } | null>(null);
  const [result, setResult] = useState<SystemResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cables, setCables] = useState<CableItem[]>([]);
  const [breakers, setBreakers] = useState<Breaker[]>([]);
  const [transformers, setTransformers] = useState<TransformerItem[]>([]);
  const [standards, setStandards] = useState<StandardRef[]>([]);
  const [standardRef, setStandardRef] = useState("");
  const [defaults, setDefaults] = useState<SystemDefaults | null>(null);
  const [savedSystems, setSavedSystems] = useState<SavedSystemMeta[]>([]);
  const [currentSystemId, setCurrentSystemId] = useState<number | null>(null);
  const [systemName, setSystemName] = useState("МКД — типовая схема");
  const [saveLoading, setSaveLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const addOffset = useRef(0);

  const refreshSystemsList = useCallback(async () => {
    const list = await fetchSystems();
    setSavedSystems(list);
  }, []);

  const applyCalculationResult = useCallback(
    (res: SystemResult) => {
      setResult(res);

      const edgeResultMap = new Map(
        res.edges
          .filter((e) => e.id || (e.from_id && e.to_id))
          .map((e) => [e.id ?? `${e.from_id}:${e.to_id}`, e])
      );

      setNodes((nds) =>
        nds.map((n) => {
          const nr = res.nodes[n.id];
          const nodeUpd = res.node_graph_updates?.find((u) => u.id === n.id);
          const hasViolation = res.edges.some((e) => e.to_id === n.id && e.ok === false);
          const extra: NodeData = {
            has_violation: hasViolation,
          };
          if (nr) {
            extra.i_a = nr.i_a;
            extra.p_kw = nr.p_kw;
            if ("z_source_mohm" in nr) extra.z_source_mohm = nr.z_source_mohm;
            if (nr.breaker_in_a != null) extra.breaker_in_a = nr.breaker_in_a;
            if (nr.breaker) extra.breaker_label = nr.breaker;
            if (nr.selectivity_ok != null) extra.selectivity_ok = nr.selectivity_ok;
            if (Array.isArray(nr.vru_sections)) extra.vru_sections = nr.vru_sections;
            if (Array.isArray(nr.vru_section_breakers))
              extra.vru_section_breakers = nr.vru_section_breakers;
            if (nr.vru_merged != null) extra.vru_merged = nr.vru_merged;
          }
          if (nodeUpd && !(n.data as NodeData).manual_breaker) {
            if (nodeUpd.breaker_id) extra.breaker_id = nodeUpd.breaker_id;
            if (nodeUpd.breaker_in_a != null) extra.breaker_in_a = nodeUpd.breaker_in_a;
            if (nodeUpd.selectivity_ok != null) extra.selectivity_ok = nodeUpd.selectivity_ok;
            if (Array.isArray(nodeUpd.vru_sections)) extra.vru_sections = nodeUpd.vru_sections;
            if (Array.isArray(nodeUpd.vru_section_breakers))
              extra.vru_section_breakers = nodeUpd.vru_section_breakers;
          }
          return { ...n, data: { ...n.data, ...extra } };
        })
      );

      setEdges((eds) =>
        eds.map((e) => {
          const edgeRes = edgeResultMap.get(e.id) ?? edgeResultMap.get(`${e.source}:${e.target}`);
          const upd = res.graph_updates?.find(
            (g) => (g.id && g.id === e.id) || (g.source === e.source && g.target === e.target)
          );
          const data = { ...(e.data || {}) } as NodeData;
          if (upd) {
            if (!data.manual_cable && upd.cable_id) {
              data.cable_id = upd.cable_id;
              data.section_mm2 = upd.section_mm2;
            }
            if (!data.manual_breaker && upd.breaker_id) {
              data.breaker_id = upd.breaker_id;
            }
          }
          return withEdgeStyle(
            { ...e, data },
            undefined,
            edgeRes?.ok === false
          );
        })
      );
    },
    [setNodes, setEdges]
  );

  const applyResultToNodes = applyCalculationResult;

  const loadTemplate = useCallback(async () => {
    const [tpl, tr] = await Promise.all([fetchSystemTemplate(), fetchTransformers()]);
    setNodes(
      mapNodesWithPorts(applyDefaultTpCatalogToNodes(tpl.nodes as Node[], tr))
    );
    setEdges((tpl.edges as Edge[]).map((e) => withEdgeStyle(e)));
    setCurrentSystemId(null);
    setSystemName("МКД — типовая схема");
    setResult(null);
    setSelected(null);
  }, [setNodes, setEdges]);

  const loadSystemById = useCallback(
    async (id: number) => {
      setProjectError(null);
      try {
        const s = await fetchSystem(id);
        const graph = s.graph_data as { nodes: Node[]; edges: Edge[] } | undefined;
        if (graph?.nodes) setNodes(mapNodesWithPorts(graph.nodes));
        if (graph?.edges) setEdges(graph.edges.map((e) => withEdgeStyle(e as Edge)));
        setCurrentSystemId(s.id);
        setSystemName(s.name);
        if (s.z_source_mohm != null && graph?.nodes) {
          setNodes(
            graph.nodes.map((n) => {
              const data = n.data as NodeData;
              if (data.node_type === "transformer_substation" && data.z_source_mohm == null) {
                return { ...n, data: { ...data, z_source_mohm: s.z_source_mohm } };
              }
              return n;
            })
          );
        }
        setSelected(null);
        if (s.last_result) applyResultToNodes(s.last_result);
        else setResult(null);
      } catch {
        setProjectError("Не удалось загрузить проект");
      }
    },
    [applyResultToNodes, setNodes, setEdges]
  );

  useEffect(() => {
    Promise.all([
      fetchSystemTemplate(),
      fetchSystemDefaults(),
      fetchCables(),
      fetchBreakers(),
      fetchTransformers(),
      fetchStandards("electrical.system"),
    ])
      .then(([tpl, defs, c, b, tr, std]) => {
        setNodes(
          mapNodesWithPorts(applyDefaultTpCatalogToNodes(tpl.nodes as Node[], tr))
        );
        setEdges((tpl.edges as Edge[]).map((e) => withEdgeStyle(e)));
        setDefaults(defs);
        setCables(c);
        setBreakers(b);
        setTransformers(tr);
        setStandards(std.standards);
        setStandardRef(std.standard_ref);
      })
      .catch(() => {
        setProjectError("Не удалось загрузить данные с API. Запустите backend: python manage.py runserver");
      });
    refreshSystemsList();
  }, [setNodes, setEdges, refreshSystemsList]);

  const selectedNode = useMemo(
    () => (selected?.type === "node" ? nodes.find((n) => n.id === selected.id) : null),
    [selected, nodes]
  );

  const selectedEdge = useMemo(
    () => (selected?.type === "edge" ? edges.find((e) => e.id === selected.id) : null),
    [selected, edges]
  );

  const nodeData = (selectedNode?.data ?? {}) as NodeData;
  const edgeData = (selectedEdge?.data ?? {}) as EdgeData;

  const loadPhase = String(nodeData.phase ?? "1");

  const edgeTargetIsLoad = useMemo(() => {
    if (!selectedEdge) return false;
    return (nodes.find((n) => n.id === selectedEdge.target)?.data as NodeData)?.node_type === "load";
  }, [selectedEdge, nodes]);

  const edgeAllowedConstructions = useMemo(() => {
    if (!selectedEdge) return [] as string[];
    const srcNode = nodes.find((n) => n.id === selectedEdge.source);
    const srcType = String((srcNode?.data as NodeData)?.node_type ?? "");
    const subtree = subtreeLoadNodes(selectedEdge.target, nodes, edges);
    const has3ph = subtree.some((n) => n.phase === "3");
    const has1ph = subtree.some((n) => n.phase === "1");
    const armored =
      srcType === "transformer_substation" &&
      String((nodes.find((n) => n.id === selectedEdge.target)?.data as NodeData)?.node_type) === "vru";
    return allowedConstructionsForSegment(srcType, has3ph, has1ph, armored, true);
  }, [selectedEdge, nodes, edges]);

  const edgeBaseCables = useMemo(() => {
    if (!edgeAllowedConstructions.length) return cables;
    return filterCablesForEdge(cables, { constructions: edgeAllowedConstructions });
  }, [cables, edgeAllowedConstructions]);

  const edgeFilteredCables = useMemo(() => {
    if (!selectedEdge) return cables;
    const filtered = filterCablesForEdge(edgeBaseCables, {
      section: (edgeData.cable_filter_section as number | "") ?? "",
      cores: (edgeData.cable_filter_cores as number | "") ?? "",
    });
    const currentId = Number(edgeData.cable_id);
    if (currentId && !filtered.some((c) => c.id === currentId)) {
      const current = cables.find((c) => c.id === currentId);
      if (current) return [current, ...filtered];
    }
    return filtered;
  }, [cables, selectedEdge, edgeBaseCables, edgeData.cable_filter_section, edgeData.cable_filter_cores, edgeData.cable_id]);

  const edgeSectionOptions = useMemo(
    () => uniqueCableSections(edgeBaseCables),
    [edgeBaseCables]
  );
  const edgeCoresOptions = useMemo(
    () => uniqueCableCores(edgeBaseCables),
    [edgeBaseCables]
  );

  const updateNodeData = useCallback(
    (key: string, value: unknown) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id ? { ...n, data: { ...n.data, [key]: value } } : n
        )
      );
    },
    [selectedNode, setNodes]
  );

  const updateEdgeData = useCallback(
    (key: string, value: unknown) => {
      if (!selectedEdge) return;
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== selectedEdge.id) return e;
          const data = { ...(e.data || {}), [key]: value } as NodeData;
          if (key === "cable_id") data.manual_cable = true;
          if (key === "breaker_id") data.manual_breaker = true;
          return { ...e, data };
        })
      );
    },
    [selectedEdge, setEdges]
  );

  const updateLoadPhase = useCallback(
    (phase: "1" | "3") => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  phase,
                },
              }
            : n
        )
      );
    },
    [selectedNode, setNodes]
  );

  const resetEdgeAutoSelection = useCallback(
    (field: "cable" | "breaker" | "both") => {
      if (!selectedEdge) return;
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== selectedEdge.id) return e;
          const data = { ...(e.data || {}) } as NodeData;
          if (field === "cable" || field === "both") data.manual_cable = false;
          if (field === "breaker" || field === "both") data.manual_breaker = false;
          return { ...e, data };
        })
      );
    },
    [selectedEdge, setEdges]
  );

  const addNode = useCallback(
    (nodeType: NodeType) => {
      const preset = defaults?.node_defaults?.[nodeType] ?? { label: nodeType, node_type: nodeType };
      addOffset.current += 1;
      const id = nextNodeId(nodeType);
      const count = nodes.filter((n) => (n.data as NodeData).node_type === nodeType).length + 1;

      let label = NODE_LABELS[nodeType] ?? String(preset.label ?? nodeType);
      if (count > 1) label = `${label}-${count}`;

      const ports = defaultPortsForNodeType(nodeType);
      const defaultTr = nodeType === "transformer_substation" ? findDefaultTransformer(transformers) : undefined;
      let nodeData: Record<string, unknown>;
      if (defaultTr) {
        nodeData = ensureNodePorts(
          catalogTransformerNodeData(defaultTr, { ...preset, label, node_type: nodeType })
        );
      } else if (nodeType === "vru") {
        nodeData = ensureNodePorts({ ...preset, label, node_type: nodeType });
      } else {
        nodeData = {
          ...preset,
          label,
          node_type: nodeType,
          input_ports: ports.input_ports,
          output_ports: ports.output_ports,
        };
      }
      const newNode: Node = {
        id,
        type: "custom",
        position: { x: 100 + addOffset.current * 30, y: 80 + addOffset.current * 40 },
        data: nodeData,
      };
      setNodes((nds) => [...nds, newNode]);
      setSelected({ type: "node", id });
    },
    [defaults, nodes, setNodes, transformers]
  );

  const deleteSelected = useCallback(() => {
    if (!selected) return;
    if (selected.type === "node") {
      setNodes((nds) => nds.filter((n) => n.id !== selected.id));
      setEdges((eds) => eds.filter((e) => e.source !== selected.id && e.target !== selected.id));
    } else {
      setEdges((eds) => eds.filter((e) => e.id !== selected.id));
    }
    setSelected(null);
  }, [selected, setNodes, setEdges]);

  const portActions = useMemo(
    () => ({
      addInputPort: (nodeId: string) => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: addInputPortToData(n.data as Record<string, unknown>) }
              : n
          )
        );
      },
      addOutputPort: (nodeId: string) => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: addOutputPortToData(n.data as Record<string, unknown>) }
              : n
          )
        );
      },
      removeInputPort: (nodeId: string) => {
        setNodes((nds) => {
          const node = nds.find((n) => n.id === nodeId);
          if (!node) return nds;
          const ports = (node.data as NodeData).input_ports as NodePort[] | undefined;
          const removedId = lastRemovedPortId(ports ?? []);
          const next = removeInputPortFromData(node.data as Record<string, unknown>);
          if (!next || !removedId) return nds;
          setEdges((eds) =>
            eds.filter(
              (e) => !(e.target === nodeId && (e.targetHandle ?? "in-0") === removedId)
            )
          );
          return nds.map((n) => (n.id === nodeId ? { ...n, data: next } : n));
        });
      },
      removeOutputPort: (nodeId: string) => {
        setNodes((nds) => {
          const node = nds.find((n) => n.id === nodeId);
          if (!node) return nds;
          const ports = (node.data as NodeData).output_ports as NodePort[] | undefined;
          const removedId = lastRemovedPortId(ports ?? []);
          const next = removeOutputPortFromData(node.data as Record<string, unknown>);
          if (!next || !removedId) return nds;
          setEdges((eds) =>
            eds.filter(
              (e) => !(e.source === nodeId && (e.sourceHandle ?? "out-0") === removedId)
            )
          );
          return nds.map((n) => (n.id === nodeId ? { ...n, data: next } : n));
        });
      },
      toggleVruSectionSwitch: (nodeId: string) => {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: ensureNodePorts(
                    toggleVruSectionSwitch(n.data as Record<string, unknown>)
                  ),
                }
              : n
          )
        );
      },
    }),
    [setNodes, setEdges]
  );

  const checkConnection = useCallback(
    (connection: Connection | Edge) => {
      const src = nodes.find((n) => n.id === connection.source);
      const dst = nodes.find((n) => n.id === connection.target);
      if (!src || !dst) return false;
      return isValidConnection(
        String((src.data as NodeData).node_type ?? ""),
        String((dst.data as NodeData).node_type ?? ""),
        connection.sourceHandle ?? null,
        connection.targetHandle ?? null
      );
    },
    [nodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const normalized: Connection = {
        ...connection,
        sourceHandle: connection.sourceHandle ?? "out-0",
        targetHandle: connection.targetHandle ?? "in-0",
      };
      if (!checkConnection(normalized)) return;
      const edgeDefaults = defaults?.edge ?? { length_m: 15, cable_id: cables[0]?.id, breaker_id: breakers[0]?.id };
      setEdges((eds) =>
        addEdge(
          {
            ...normalized,
            id: `e-${normalized.source}-${normalized.target}-${Date.now()}`,
            type: "smoothstep",
            style: EDGE_STYLE,
            data: { ...edgeDefaults },
          },
          eds
        )
      );
    },
    [defaults, cables, breakers, setEdges, checkConnection]
  );

  const applyTransformerSelection = useCallback(
    (transformerId: number | "") => {
      if (!selectedNode) return;
      if (!transformerId) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === selectedNode.id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    transformer_id: undefined,
                    z_source_mohm: undefined,
                  },
                }
              : n
          )
        );
        return;
      }
      const tr = transformers.find((t) => t.id === transformerId);
      if (!tr) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  transformer_id: tr.id,
                  s_kva: tr.s_kva,
                  uk_percent: tr.uk_percent,
                  u_secondary_v: tr.u_secondary_v,
                  u_primary_kv: tr.u_primary_kv,
                  label: "ТП",
                  z_source_mohm: undefined,
                },
              }
            : n
        )
      );
    },
    [transformers, selectedNode, setNodes]
  );

  const applyTpCount = useCallback(
    (count: 1 | 2) => {
      if (!selectedNode) return;
      const nodeId = selectedNode.id;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: applyTpTransformerCount(n.data as Record<string, unknown>, count) }
            : n
        )
      );
      if (count === 1) {
        setEdges((eds) =>
          eds.filter((e) => !(e.source === nodeId && e.sourceHandle === "out-1"))
        );
      }
    },
    [selectedNode, setNodes, setEdges]
  );

  const updateTpPrimaryKv = useCallback(
    (uPrimary: number) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== selectedNode.id) return n;
          const data = n.data as NodeData;
          const tid = data.transformer_id;
          let next = { ...data, u_primary_kv: uPrimary, z_source_mohm: undefined };
          if (tid) {
            const tr = transformers.find((t) => t.id === Number(tid));
            if (!tr || tr.u_primary_kv !== uPrimary) {
              next = { ...next, transformer_id: undefined };
            }
          }
          return { ...n, data: next };
        })
      );
    },
    [selectedNode, setNodes, transformers]
  );

  const updateTpManualField = useCallback(
    (key: "s_kva" | "uk_percent" | "u_secondary_v" | "z_source_mohm", value: number | undefined) => {
      if (!selectedNode) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  transformer_id: undefined,
                  [key]: value,
                  ...(key !== "z_source_mohm" ? { z_source_mohm: undefined } : {}),
                },
              }
            : n
        )
      );
    },
    [selectedNode, setNodes]
  );

  const applyVruSchemeChange = useCallback(
    (scheme: VruScheme) => {
      if (!selectedNode) return;
      const nodeId = selectedNode.id;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: ensureNodePorts(applyVruScheme(n.data as Record<string, unknown>, scheme)) }
            : n
        )
      );
      if (scheme === "1in_2out") {
        setEdges((eds) =>
          eds.filter((e) => !(e.target === nodeId && e.targetHandle === "in-1"))
        );
      }
      if (!vruDualInputs(scheme)) {
        setEdges((eds) =>
          eds.filter(
            (e) =>
              !(
                e.source === nodeId &&
                (e.sourceHandle === "tap-1" || e.sourceHandle === "in-1")
              ) && !(e.target === nodeId && e.targetHandle === "in-1")
          )
        );
      }
    },
    [selectedNode, setNodes, setEdges]
  );

  const applyVruMode = useCallback(
    (mode: VruOperatingMode) => {
      if (!selectedNode) return;
      updateNodeData("vru_operating_mode", mode);
    },
    [selectedNode, updateNodeData]
  );

  const updateVruTap = useCallback(
    (key: "vru_tap_in0" | "vru_tap_in1", enabled: boolean) => {
      if (!selectedNode) return;
      const nodeId = selectedNode.id;
      const tapHandle = key === "vru_tap_in0" ? "tap-0" : "tap-1";
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: ensureNodePorts(
                  syncVruPortData({ ...(n.data as Record<string, unknown>), [key]: enabled })
                ),
              }
            : n
        )
      );
      if (!enabled) {
        setEdges((eds) =>
          eds.filter((e) => !(e.source === nodeId && e.sourceHandle === tapHandle))
        );
      }
    },
    [selectedNode, setNodes, setEdges]
  );

  const runCalculation = useCallback(async () => {
    setLoading(true);
    try {
      const { u_nom_v, z_source_mohm } = getSourceParamsFromNodes(nodes, transformers);
      const res = await calculateSystem(
        { nodes: nodes as unknown[], edges: edges as unknown[] },
        u_nom_v,
        z_source_mohm
      );
      applyResultToNodes(res);
    } finally {
      setLoading(false);
    }
  }, [nodes, edges, applyResultToNodes, transformers]);

  const handleSaveProject = useCallback(async () => {
    setSaveLoading(true);
    setProjectError(null);
    const name = systemName.trim() || "Без названия";
    const graph_data = { nodes: nodes as unknown[], edges: edges as unknown[] };
    const { u_nom_v, z_source_mohm } = getSourceParamsFromNodes(nodes, transformers);
    try {
      if (currentSystemId) {
        const res = await updateSystem(currentSystemId, {
          name,
          graph_data,
          u_nom_v,
          z_source_mohm,
        });
        applyResultToNodes(res.result);
        setSystemName(res.name);
      } else {
        const res = await createSystem({
          name,
          graph_data,
          u_nom_v,
          z_source_mohm,
        });
        setCurrentSystemId(res.id);
        setSystemName(res.name);
        applyResultToNodes(res.result);
      }
      await refreshSystemsList();
    } catch {
      setProjectError("Не удалось сохранить проект");
    } finally {
      setSaveLoading(false);
    }
  }, [
    systemName,
    nodes,
    edges,
    currentSystemId,
    applyResultToNodes,
    refreshSystemsList,
    transformers,
  ]);

  const handleDeleteProject = useCallback(async () => {
    if (!currentSystemId) return;
    if (!window.confirm(`Удалить проект «${systemName}»?`)) return;
    setSaveLoading(true);
    setProjectError(null);
    try {
      await deleteSystem(currentSystemId);
      await refreshSystemsList();
      await loadTemplate();
    } catch {
      setProjectError("Не удалось удалить проект");
    } finally {
      setSaveLoading(false);
    }
  }, [currentSystemId, systemName, refreshSystemsList, loadTemplate]);

  const handleNewProject = useCallback(async () => {
    if (
      currentSystemId &&
      !window.confirm("Создать новую схему? Несохранённые изменения будут потеряны.")
    ) {
      return;
    }
    await loadTemplate();
  }, [currentSystemId, loadTemplate]);

  const nodeType = nodeData.node_type as string | undefined;

  const tpPrimaryKv = Number(nodeData.u_primary_kv ?? 10);
  const tpCount = Number(nodeData.transformer_count ?? 1) >= 2 ? 2 : 1;
  const tpManual = nodeType === "transformer_substation" && isTpManualMode(nodeData);
  const tpElectrical = useMemo(
    () =>
      nodeType === "transformer_substation"
        ? resolveTpElectrical(nodeData, transformers)
        : null,
    [nodeType, nodeData, transformers]
  );
  const filteredTransformers = useMemo(
    () => filterTransformers(transformers, tpPrimaryKv),
    [transformers, tpPrimaryKv]
  );

  const styledEdges = useMemo(() => {
    const edgeResultMap = new Map(
      (result?.edges ?? [])
        .filter((e) => e.from_id && e.to_id)
        .map((e) => [`${e.from_id}:${e.to_id}`, e])
    );
    return edges.map((e) => {
      const edgeRes = edgeResultMap.get(`${e.source}:${e.target}`);
      return withEdgeStyle(
        e,
        selected?.type === "edge" ? selected.id : undefined,
        edgeRes?.ok === false
      );
    });
  }, [edges, selected, result]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {ADD_BUTTONS.map((btn) => (
            <button
              key={btn.type}
              type="button"
              onClick={() => addNode(btn.type)}
              className={`rounded-xl border-2 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-lg transition ${btn.color}`}
            >
              {btn.label}
            </button>
          ))}
          {selected && (
            <button
              type="button"
              onClick={deleteSelected}
              className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/50"
            >
              Удалить выбранное
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={currentSystemId ?? ""}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null;
              if (id) loadSystemById(id);
            }}
            className={`${formFieldCls} w-auto min-w-[160px]`}
          >
            <option value="">— новая схема —</option>
            {savedSystems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={systemName}
            onChange={(e) => setSystemName(e.target.value)}
            placeholder="Название проекта"
            className={`${formFieldCls} w-44`}
          />
          <button
            type="button"
            onClick={handleSaveProject}
            disabled={saveLoading}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {saveLoading ? "…" : currentSystemId ? "Сохранить" : "Сохранить как"}
          </button>
          <button
            type="button"
            onClick={handleDeleteProject}
            disabled={!currentSystemId || saveLoading}
            className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/50 disabled:opacity-40"
          >
            Удалить
          </button>
          <button
            type="button"
            onClick={handleNewProject}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            + Новый
          </button>
        </div>
      </div>

      {projectError && <p className="text-xs text-red-400">{projectError}</p>}

      <div className="flex h-[min(72vh,780px)] min-h-[560px] gap-4">
        <div
          className={`system-flow min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-700/60${
            connecting ? " is-connecting" : ""
          }`}
        >
          <NodePortContext.Provider value={portActions}>
            <ReactFlow
              className="h-full w-full"
              nodes={nodes}
              edges={styledEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectStart={() => setConnecting(true)}
              onConnectEnd={() => setConnecting(false)}
              isValidConnection={checkConnection}
              connectionRadius={32}
              nodeTypes={nodeTypes}
              onNodeClick={(_, n) => setSelected({ type: "node", id: n.id })}
              onEdgeClick={(_, e) => setSelected({ type: "edge", id: e.id })}
              onPaneClick={() => setSelected(null)}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              colorMode="dark"
              deleteKeyCode={null}
              defaultEdgeOptions={{ type: "smoothstep", style: EDGE_STYLE }}
              connectionLineStyle={EDGE_STYLE}
            >
              <Background gap={16} color="#334155" />
              <Controls />
              <MiniMap nodeColor="#0ea5e9" maskColor="rgb(15 23 42 / 0.8)" />
            </ReactFlow>
          </NodePortContext.Provider>
        </div>

        <aside className="flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40">
          <div className="shrink-0 border-b border-slate-700/60 p-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Параметры
            </h3>
            <button
              type="button"
              onClick={runCalculation}
              disabled={loading}
              className={`${formButtonCls} mt-2`}
            >
              {loading ? "Расчёт…" : "Рассчитать систему"}
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {selectedNode && (
              <div>
                <p className="mb-2 text-xs font-medium text-sky-400">
                  Узел: {String(nodeData.label ?? "")}
                </p>
                <div className="space-y-2">
                  <label className="block">
                    <span className={formLabelCls}>Название</span>
                    <input
                      type="text"
                      value={String(nodeData.label ?? "")}
                      onChange={(e) => updateNodeData("label", e.target.value)}
                      className={formFieldCls}
                    />
                  </label>

                  {nodeType === "transformer_substation" && tpElectrical && (
                    <>
                      <label className="block">
                        <span className={formLabelCls}>Напряжение ВН, кВ</span>
                        <select
                          value={tpPrimaryKv}
                          onChange={(e) => updateTpPrimaryKv(Number(e.target.value))}
                          className={formFieldCls}
                        >
                          {TP_PRIMARY_KV_OPTIONS.map((u) => (
                            <option key={u} value={u}>
                              {u}/0,4
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className={formLabelCls}>Количество трансформаторов</span>
                        <select
                          value={tpCount}
                          onChange={(e) => applyTpCount(Number(e.target.value) as 1 | 2)}
                          className={formFieldCls}
                        >
                          <option value={1}>1 (1 отх.)</option>
                          <option value={2}>2 (2 отх.)</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className={formLabelCls}>Трансформатор</span>
                        <select
                          value={Number(nodeData.transformer_id ?? "") || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            applyTransformerSelection(v ? Number(v) : "");
                          }}
                          className={formFieldCls}
                        >
                          <option value="">— вручную —</option>
                          {filteredTransformers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} — {t.s_kva} кВА, Uk {t.uk_percent}%
                            </option>
                          ))}
                        </select>
                      </label>

                      {!tpManual && (
                        <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
                          <p>S = {tpElectrical.s_kva} кВА × {tpCount}</p>
                          <p>Uk = {tpElectrical.uk_percent}%</p>
                          <p>U2 = {tpElectrical.u_secondary_v} В</p>
                          <p className="text-sky-300">Zт = {tpElectrical.z_mohm} мОм</p>
                        </div>
                      )}

                      {tpManual && (
                        <>
                          {filteredTransformers.length === 0 && (
                            <p className="text-xs text-amber-400">
                              В каталоге нет ТП {tpPrimaryKv}/0,4 — задайте параметры вручную.
                            </p>
                          )}
                          <label className="block">
                            <span className={formLabelCls}>S, кВА (на 1 Т)</span>
                            <input
                              type="number"
                              value={Number(nodeData.s_kva ?? 630)}
                              onChange={(e) =>
                                updateTpManualField("s_kva", Number(e.target.value))
                              }
                              className={formFieldCls}
                            />
                          </label>
                          <label className="block">
                            <span className={formLabelCls}>Uk, %</span>
                            <input
                              type="number"
                              step="0.1"
                              value={Number(nodeData.uk_percent ?? 6)}
                              onChange={(e) =>
                                updateTpManualField("uk_percent", Number(e.target.value))
                              }
                              className={formFieldCls}
                            />
                          </label>
                          <label className="block">
                            <span className={formLabelCls}>U2, В (линейное)</span>
                            <select
                              value={Number(nodeData.u_secondary_v ?? DEFAULT_TP_VOLTAGE)}
                              onChange={(e) =>
                                updateTpManualField("u_secondary_v", Number(e.target.value))
                              }
                              className={formFieldCls}
                            >
                              {TP_VOLTAGE_OPTIONS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block">
                            <span className={formLabelCls}>Zт, мОм</span>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                step="0.001"
                                value={Number(
                                  nodeData.z_source_mohm ??
                                    calcTransformerZMohm(
                                      Number(nodeData.s_kva ?? 630),
                                      Number(nodeData.uk_percent ?? 6),
                                      Number(nodeData.u_secondary_v ?? DEFAULT_TP_VOLTAGE)
                                    )
                                )}
                                onChange={(e) =>
                                  updateTpManualField("z_source_mohm", Number(e.target.value))
                                }
                                className={formFieldCls}
                              />
                              {nodeData.z_source_mohm != null && (
                                <button
                                  type="button"
                                  className={`${formButtonCls} shrink-0 px-2 text-xs`}
                                  onClick={() => updateTpManualField("z_source_mohm", undefined)}
                                >
                                  авто
                                </button>
                              )}
                            </div>
                          </label>
                          <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
                            <p>
                              Zт (авто):{" "}
                              {calcTransformerZMohm(
                                Number(nodeData.s_kva ?? 630),
                                Number(nodeData.uk_percent ?? 6),
                                Number(nodeData.u_secondary_v ?? DEFAULT_TP_VOLTAGE)
                              )}{" "}
                              мОм
                            </p>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {nodeType === "load" && (
                    <>
                      <label className="block">
                        <span className={formLabelCls}>Фазность</span>
                        <select
                          value={loadPhase}
                          onChange={(e) => updateLoadPhase(e.target.value as "1" | "3")}
                          className={formFieldCls}
                        >
                          <option value="3">3Ф</option>
                          <option value="1">1Ф</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className={formLabelCls}>P, кВт</span>
                        <input
                          type="number"
                          value={Number(nodeData.p_kw ?? 0)}
                          onChange={(e) => updateNodeData("p_kw", Number(e.target.value))}
                          className={formFieldCls}
                        />
                      </label>
                      <label className="block">
                        <span className={formLabelCls}>cos φ</span>
                        <input
                          type="number"
                          step="0.01"
                          value={Number(nodeData.cos_phi ?? 0.95)}
                          onChange={(e) => updateNodeData("cos_phi", Number(e.target.value))}
                          className={formFieldCls}
                        />
                      </label>
                    </>
                  )}

                  {nodeType === "vru" && (
                    <>
                      <label className="block">
                        <span className={formLabelCls}>Схема ВРУ</span>
                        <select
                          value={String(nodeData.vru_scheme ?? "1in_2out")}
                          onChange={(e) => applyVruSchemeChange(e.target.value as VruScheme)}
                          className={formFieldCls}
                        >
                          {VRU_SCHEME_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className={formLabelCls}>Режим работы</span>
                        <select
                          value={String(nodeData.vru_operating_mode ?? "normal")}
                          onChange={(e) => applyVruMode(e.target.value as VruOperatingMode)}
                          className={formFieldCls}
                        >
                          {VRU_MODE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {vruHasSectionSwitch(String(nodeData.vru_scheme)) && (
                        <p className="text-[11px] text-slate-500">
                          Секционный выключатель:{" "}
                          {vruSwitchLabel(
                            String(nodeData.vru_scheme),
                            String(nodeData.vru_section_switch ?? "open")
                          )}
                          . Переключите СВ на блоке на схеме.
                        </p>
                      )}
                      <div className="space-y-1 rounded-lg border border-slate-700/60 bg-slate-950/30 p-2">
                        <p className="text-[10px] font-medium text-slate-400">Отпайки с ввода</p>
                        <label className="flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={Boolean(nodeData.vru_tap_in0)}
                            onChange={(e) => updateVruTap("vru_tap_in0", e.target.checked)}
                          />
                          {vruDualInputs(String(nodeData.vru_scheme)) ? "Ввод 1 → ВРУ / ЩС" : "Ввод → ВРУ / ЩС"}
                        </label>
                        {vruDualInputs(String(nodeData.vru_scheme)) && (
                          <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={Boolean(nodeData.vru_tap_in1)}
                              onChange={(e) => updateVruTap("vru_tap_in1", e.target.checked)}
                            />
                            Ввод 2 → ВРУ / ЩС
                          </label>
                        )}
                        <p className="text-[10px] text-slate-500">
                          Оранжевая точка слева — отход на другое ВРУ или ЩС.
                        </p>
                      </div>
                      <label className="block">
                        <span className={formLabelCls}>Kc</span>
                        <input
                          type="number"
                          step="0.05"
                          value={Number(nodeData.kc ?? 1)}
                          onChange={(e) => updateNodeData("kc", Number(e.target.value))}
                          className={formFieldCls}
                        />
                      </label>
                      {Array.isArray(nodeData.vru_sections) &&
                        (nodeData.vru_sections as { label: string; i_a?: number; active?: boolean }[]).map(
                          (sec) =>
                            sec.active !== false ? (
                              <div
                                key={sec.label}
                                className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-2 text-xs"
                              >
                                <p className="text-slate-400">{sec.label}</p>
                                <p className="text-sky-300">I = {sec.i_a ?? "—"} А</p>
                              </div>
                            ) : null
                        )}
                      {Array.isArray(nodeData.vru_section_breakers) &&
                        (
                          nodeData.vru_section_breakers as {
                            label: string;
                            breaker_in_a?: number;
                            selectivity_ok?: boolean;
                          }[]
                        ).map((sb) => (
                          <div
                            key={sb.label}
                            className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-2 text-xs"
                          >
                            <p className="text-slate-400">{sb.label} — вводной QF</p>
                            <p className="text-amber-200">QF {sb.breaker_in_a ?? "—"} А</p>
                            {sb.selectivity_ok === false && (
                              <p className="mt-1 text-amber-400">см. селективность</p>
                            )}
                          </div>
                        ))}
                      {nodeData.breaker_in_a != null &&
                        !Array.isArray(nodeData.vru_section_breakers) && (
                          <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-2 text-xs">
                            <p className="text-slate-400">Общий вводной автомат</p>
                            <p className="text-amber-200">QF {String(nodeData.breaker_in_a)} А</p>
                          </div>
                        )}
                    </>
                  )}

                  {(nodeType === "distribution_board" || nodeType === "group_board") && (
                    <>
                      <label className="block">
                        <span className={formLabelCls}>Kc</span>
                        <input
                          type="number"
                          step="0.05"
                          value={Number(nodeData.kc ?? 0.9)}
                          onChange={(e) => updateNodeData("kc", Number(e.target.value))}
                          className={formFieldCls}
                        />
                      </label>
                      {nodeData.breaker_in_a != null && (
                        <div className="rounded-lg border border-slate-700/60 bg-slate-950/40 p-2 text-xs">
                          <p className="text-slate-400">Вводной автомат</p>
                          <p className="text-amber-200">
                            QF {String(nodeData.breaker_in_a)} А
                            {nodeData.breaker_label ? ` · ${String(nodeData.breaker_label)}` : ""}
                          </p>
                          {nodeData.selectivity_ok === false && (
                            <p className="mt-1 text-amber-400">см. селективность</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {selectedEdge && !selectedNode && (
              <div>
                <p className="mb-2 text-xs font-medium text-amber-400">Кабельная линия</p>
                <p className="mb-2 text-[11px] text-slate-500">
                  Фазность и напряжение задаются на нагрузке. Кабель подбирается на каждом участке;
                  автомат на отходе к нагрузке и вводной — на узлах ЩС/ВРУ/ТП.
                </p>
                <div className="space-y-2">
                  <label className="block">
                    <span className={formLabelCls}>Длина, м</span>
                    <input
                      type="number"
                      value={Number(edgeData.length_m ?? 10)}
                      onChange={(e) => updateEdgeData("length_m", Number(e.target.value))}
                      className={formFieldCls}
                    />
                  </label>
                  {edgeAllowedConstructions.length > 0 && (
                    <p className="text-[11px] text-slate-500">
                      Допустимые жилы: {edgeAllowedConstructions.map((c) => c.replace("x", "×")).join(", ")}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className={formLabelCls}>Сечение, мм²</span>
                      <select
                        value={String(edgeData.cable_filter_section ?? "")}
                        onChange={(e) =>
                          updateEdgeData(
                            "cable_filter_section",
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        className={formFieldCls}
                      >
                        <option value="">Все</option>
                        {edgeSectionOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={formLabelCls}>Жил, шт.</span>
                      <select
                        value={String(edgeData.cable_filter_cores ?? "")}
                        onChange={(e) =>
                          updateEdgeData(
                            "cable_filter_cores",
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        className={formFieldCls}
                      >
                        <option value="">Все</option>
                        {edgeCoresOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className={formLabelCls}>
                      Кабель
                      {edgeData.manual_cable ? (
                        <span className="ml-1 text-amber-400">(вручную)</span>
                      ) : (
                        <span className="ml-1 text-emerald-400">(авто)</span>
                      )}
                    </span>
                    <select
                      value={Number(edgeData.cable_id ?? "")}
                      onChange={(e) => updateEdgeData("cable_id", Number(e.target.value))}
                      className={formFieldCls}
                    >
                      {edgeFilteredCables.map((c) => (
                        <option key={c.id} value={c.id}>
                          {formatCableMarking(c.name)}
                        </option>
                      ))}
                    </select>
                    {edgeData.manual_cable && (
                      <button
                        type="button"
                        onClick={() => resetEdgeAutoSelection("cable")}
                        className="mt-1 text-[11px] text-sky-400 hover:underline"
                      >
                        Вернуть автоподбор кабеля
                      </button>
                    )}
                  </label>
                  {edgeTargetIsLoad && (
                  <label className="block">
                    <span className={formLabelCls}>
                      Автомат (отход к нагрузке)
                      {edgeData.manual_breaker ? (
                        <span className="ml-1 text-amber-400">(вручную)</span>
                      ) : (
                        <span className="ml-1 text-emerald-400">(авто)</span>
                      )}
                    </span>
                    <select
                      value={Number(edgeData.breaker_id ?? "")}
                      onChange={(e) => updateEdgeData("breaker_id", Number(e.target.value))}
                      className={formFieldCls}
                    >
                      {breakers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.manufacturer} {b.model_name} {b.in_a}A
                        </option>
                      ))}
                    </select>
                    {edgeData.manual_breaker && (
                      <button
                        type="button"
                        onClick={() => resetEdgeAutoSelection("breaker")}
                        className="mt-1 text-[11px] text-sky-400 hover:underline"
                      >
                        Вернуть автоподбор автомата
                      </button>
                    )}
                  </label>
                  )}
                </div>
              </div>
            )}

            {!selectedNode && !selectedEdge && (
              <p className="text-xs text-slate-500">
                Выберите узел или линию на схеме для редактирования параметров.
              </p>
            )}
          </div>
        </aside>
      </div>

      {result && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          <h3 className="mb-3 text-sm font-medium text-slate-300">Результаты по участкам</h3>
          {result.warnings.length > 0 && (
            <ul className="mb-3 list-inside list-disc text-sm text-amber-300">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {((result.breakers?.length ?? 0) > 0 ||
            Object.values(result.nodes).some((n) => n.breaker_in_a != null)) && (
            <div className="mb-4 overflow-x-auto">
              <h4 className="mb-2 text-xs font-medium text-slate-400">Автоматы защиты</h4>
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-2 py-1">Место</th>
                    <th className="px-2 py-1">Тип</th>
                    <th className="px-2 py-1">I, А</th>
                    <th className="px-2 py-1">Автомат</th>
                    <th className="px-2 py-1">In, А</th>
                    <th className="px-2 py-1">Примечание</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.breakers ??
                    Object.entries(result.nodes)
                      .filter(([, n]) => n.breaker_in_a != null)
                      .map(([id, n]) => ({
                        id: `node-${id}`,
                        placement: "input" as const,
                        location: n.label,
                        breaker: n.breaker ?? "—",
                        breaker_in_a: n.breaker_in_a ?? 0,
                        i_a: n.i_a,
                        selectivity_ok: n.selectivity_ok,
                      }))).map((b) => (
                    <tr key={b.id} className="border-t border-slate-800 text-slate-300">
                      <td className="px-2 py-1">{b.location}</td>
                      <td className="px-2 py-1">
                        {b.placement === "input" ? "ввод" : "отход"}
                      </td>
                      <td className="px-2 py-1">{b.i_a}</td>
                      <td className="px-2 py-1">{b.breaker}</td>
                      <td className="px-2 py-1">{b.breaker_in_a}</td>
                      <td className="px-2 py-1 text-amber-400">
                        {b.selectivity_ok === false ? "см. селективность" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-2 py-1">Участок</th>
                  <th className="px-2 py-1">Кабель</th>
                  <th className="px-2 py-1">I, А</th>
                  <th className="px-2 py-1">ΔU, %</th>
                  <th className="px-2 py-1">Ik, кА</th>
                  <th className="px-2 py-1">Автомат</th>
                  <th className="px-2 py-1">Статус</th>
                </tr>
              </thead>
              <tbody>
                {result.edges.map((e) => (
                  <tr
                    key={`${e.from_id ?? e.from}-${e.to_id ?? e.to}`}
                    className={`border-t border-slate-800 text-slate-300 ${
                      e.ok === false ? "bg-red-950/30" : ""
                    }`}
                  >
                    <td className="px-2 py-1">
                      {e.from} → {e.to}
                    </td>
                    <td className="px-2 py-1">
                      {formatCableMarking(e.cable)}
                      {e.manual_cable && (
                        <span className="ml-1 text-[10px] text-amber-400">ручн.</span>
                      )}
                    </td>
                    <td className="px-2 py-1">{e.i_a}</td>
                    <td className={`px-2 py-1 ${e.delta_u_percent > 5 ? "text-amber-400" : ""}`}>
                      {e.delta_u_percent}
                    </td>
                    <td className="px-2 py-1">{e.ik_ka}</td>
                    <td className="px-2 py-1">
                      {e.breaker || "—"}
                      {e.manual_breaker && (
                        <span className="ml-1 text-[10px] text-amber-400">ручн.</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {e.ok !== false ? (
                        <span className="text-emerald-400">OK</span>
                      ) : (
                        <ul className="list-inside list-disc text-red-300">
                          {(e.violations ?? []).map((v) => (
                            <li key={v}>{v}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <StandardsPanel standardRef={standardRef} standards={standards} />
    </div>
  );
}

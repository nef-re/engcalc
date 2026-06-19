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

import ElectricalNode from "@/components/electrical/ElectricalNode";
import { StandardsPanel } from "@/components/StandardsPanel";
import {
  ADD_BUTTONS,
  NODE_LABELS,
  nextNodeId,
  type NodeType,
  type SystemDefaults,
} from "@/lib/systemNodes";
import {
  allowedConstructionsForSegment,
  defaultVoltageForPhase,
  filterCablesForEdge,
  formatCableMarking,
  subtreeLoadNodes,
  uniqueCableCores,
  uniqueCableSections,
  voltageOptionsForPhase,
} from "@/lib/cables";
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
} from "@/lib/api";

const nodeTypes = { custom: ElectricalNode };

const EDGE_STYLE = { stroke: "#0ea5e9", strokeWidth: 3.5 };
const EDGE_STYLE_SELECTED = { stroke: "#7dd3fc", strokeWidth: 5 };
const EDGE_STYLE_ERROR = { stroke: "#f87171", strokeWidth: 4.5 };

function calcTransformerZMohm(sKva: number, ukPercent: number, uSecondaryV: number): number {
  if (sKva <= 0) return 10;
  const sVa = sKva * 1000;
  const zOhm = (ukPercent / 100) * (uSecondaryV ** 2) / sVa;
  return Math.round(zOhm * 1000 * 1000) / 1000;
}

function getSourceParamsFromNodes(nodes: Node[]): { u_nom_v: number; z_source_mohm: number } {
  const tp = nodes.find((n) => (n.data as NodeData).node_type === "transformer_substation");
  if (tp) {
    const d = tp.data as NodeData;
    const u = Number(d.u_secondary_v ?? 400);
    const z =
      d.z_source_mohm != null
        ? Number(d.z_source_mohm)
        : calcTransformerZMohm(Number(d.s_kva ?? 630), Number(d.uk_percent ?? 6), u);
    return { u_nom_v: u, z_source_mohm: z };
  }
  return { u_nom_v: 400, z_source_mohm: 10 };
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
type Transformer = { id: number; name: string; s_kva: number; uk_percent: number; u_secondary_v: number };

type NodeData = Record<string, unknown>;

export function SystemFlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selected, setSelected] = useState<{ type: "node" | "edge"; id: string } | null>(null);
  const [result, setResult] = useState<SystemResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cables, setCables] = useState<CableItem[]>([]);
  const [breakers, setBreakers] = useState<Breaker[]>([]);
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [standards, setStandards] = useState<StandardRef[]>([]);
  const [standardRef, setStandardRef] = useState("");
  const [defaults, setDefaults] = useState<SystemDefaults | null>(null);
  const [savedSystems, setSavedSystems] = useState<SavedSystemMeta[]>([]);
  const [currentSystemId, setCurrentSystemId] = useState<number | null>(null);
  const [systemName, setSystemName] = useState("МКД — типовая схема");
  const [saveLoading, setSaveLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
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
          const hasViolation = res.edges.some((e) => e.to_id === n.id && e.ok === false);
          const extra: NodeData = {
            has_violation: hasViolation,
          };
          if (nr) {
            extra.i_a = nr.i_a;
            extra.p_kw = nr.p_kw;
            if ("z_source_mohm" in nr) extra.z_source_mohm = nr.z_source_mohm;
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
    const tpl = await fetchSystemTemplate();
    const d = tpl.defaults ?? defaults;
    setNodes(
      (tpl.nodes as Node[]).map((n) => {
        const data = n.data as NodeData;
        if (data.node_type === "transformer_substation" && d?.z_source_mohm != null) {
          return { ...n, data: { ...data, z_source_mohm: d.z_source_mohm } };
        }
        return n;
      })
    );
    setEdges((tpl.edges as Edge[]).map((e) => withEdgeStyle(e)));
    setCurrentSystemId(null);
    setSystemName("МКД — типовая схема");
    setResult(null);
    setSelected(null);
  }, [defaults, setNodes, setEdges]);

  const loadSystemById = useCallback(
    async (id: number) => {
      setProjectError(null);
      try {
        const s = await fetchSystem(id);
        const graph = s.graph_data as { nodes: Node[]; edges: Edge[] } | undefined;
        if (graph?.nodes) setNodes(graph.nodes);
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
    ]).then(([tpl, defs, c, b, tr, std]) => {
      const d = tpl.defaults ?? defs;
      setNodes(
        (tpl.nodes as Node[]).map((n) => {
          const data = n.data as NodeData;
          if (data.node_type === "transformer_substation" && d?.z_source_mohm != null) {
            return { ...n, data: { ...data, z_source_mohm: d.z_source_mohm } };
          }
          return n;
        })
      );
      setEdges((tpl.edges as Edge[]).map((e) => withEdgeStyle(e)));
      setDefaults(defs);
      setCables(c);
      setBreakers(b);
      setTransformers(tr);
      setStandards(std.standards);
      setStandardRef(std.standard_ref);
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
  const edgeData = (selectedEdge?.data ?? {}) as NodeData;

  const loadPhase = String(nodeData.phase ?? "1");
  const loadVoltageOptions = voltageOptionsForPhase(loadPhase);

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
                  u_nom_v: defaultVoltageForPhase(phase),
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

      const newNode: Node = {
        id,
        type: "custom",
        position: { x: 100 + addOffset.current * 30, y: 80 + addOffset.current * 40 },
        data: { ...preset, label, node_type: nodeType },
      };
      setNodes((nds) => [...nds, newNode]);
      setSelected({ type: "node", id });
    },
    [defaults, nodes, setNodes]
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

  const onConnect = useCallback(
    (connection: Connection) => {
      const edgeDefaults = defaults?.edge ?? { length_m: 15, cable_id: cables[0]?.id, breaker_id: breakers[0]?.id };
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: `e-${connection.source}-${connection.target}-${Date.now()}`,
            type: "smoothstep",
            style: EDGE_STYLE,
            data: { ...edgeDefaults },
          },
          eds
        )
      );
    },
    [defaults, cables, breakers, setEdges]
  );

  const applyTransformerFromCatalog = useCallback(
    (transformerId: number) => {
      const tr = transformers.find((t) => t.id === transformerId);
      if (!tr || !selectedNode) return;
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
                  label: "ТП",
                },
              }
            : n
        )
      );
    },
    [transformers, selectedNode, setNodes]
  );

  const runCalculation = useCallback(async () => {
    setLoading(true);
    try {
      const { u_nom_v, z_source_mohm } = getSourceParamsFromNodes(nodes);
      const res = await calculateSystem(
        { nodes: nodes as unknown[], edges: edges as unknown[] },
        u_nom_v,
        z_source_mohm
      );
      applyResultToNodes(res);
    } finally {
      setLoading(false);
    }
  }, [nodes, edges, applyResultToNodes]);

  const handleSaveProject = useCallback(async () => {
    setSaveLoading(true);
    setProjectError(null);
    const name = systemName.trim() || "Без названия";
    const graph_data = { nodes: nodes as unknown[], edges: edges as unknown[] };
    const { u_nom_v, z_source_mohm } = getSourceParamsFromNodes(nodes);
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
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${btn.color}`}
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
        <div className="system-flow min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-700/60">
          <ReactFlow
            className="h-full w-full"
            nodes={nodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
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

                  {nodeType === "transformer_substation" && (
                    <>
                      <label className="block">
                        <span className={formLabelCls}>Из каталога</span>
                        <select
                          value={Number(nodeData.transformer_id ?? "")}
                          onChange={(e) => applyTransformerFromCatalog(Number(e.target.value))}
                          className={formFieldCls}
                        >
                          <option value="">— вручную —</option>
                          {transformers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className={formLabelCls}>S, кВА</span>
                        <input
                          type="number"
                          value={Number(nodeData.s_kva ?? 630)}
                          onChange={(e) => updateNodeData("s_kva", Number(e.target.value))}
                          className={formFieldCls}
                        />
                      </label>
                      <label className="block">
                        <span className={formLabelCls}>Uk, %</span>
                        <input
                          type="number"
                          step="0.1"
                          value={Number(nodeData.uk_percent ?? 6)}
                          onChange={(e) => updateNodeData("uk_percent", Number(e.target.value))}
                          className={formFieldCls}
                        />
                      </label>
                      <label className="block">
                        <span className={formLabelCls}>U2, В</span>
                        <input
                          type="number"
                          value={Number(nodeData.u_secondary_v ?? 400)}
                          onChange={(e) => updateNodeData("u_secondary_v", Number(e.target.value))}
                          className={formFieldCls}
                        />
                      </label>
                      <label className="block">
                        <span className={formLabelCls}>Z источника, мОм</span>
                        <input
                          type="number"
                          step="0.001"
                          value={Number(
                            nodeData.z_source_mohm ??
                              calcTransformerZMohm(
                                Number(nodeData.s_kva ?? 630),
                                Number(nodeData.uk_percent ?? 6),
                                Number(nodeData.u_secondary_v ?? 400)
                              )
                          )}
                          onChange={(e) => updateNodeData("z_source_mohm", Number(e.target.value))}
                          className={formFieldCls}
                        />
                      </label>
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
                        <span className={formLabelCls}>Uном, В</span>
                        <select
                          value={Number(nodeData.u_nom_v ?? defaultVoltageForPhase(loadPhase))}
                          onChange={(e) => updateNodeData("u_nom_v", Number(e.target.value))}
                          className={formFieldCls}
                        >
                          {loadVoltageOptions.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
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

                  {(nodeType === "distribution_board" ||
                    nodeType === "group_board" ||
                    nodeType === "vru") && (
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
                  )}
                </div>
              </div>
            )}

            {selectedEdge && !selectedNode && (
              <div>
                <p className="mb-2 text-xs font-medium text-amber-400">Кабельная линия</p>
                <p className="mb-2 text-[11px] text-slate-500">
                  Фазность и напряжение задаются на нагрузке. Кабель и автомат подбираются
                  автоматически по цепочке. Ручной выбор помечается и проверяется.
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
                  <label className="block">
                    <span className={formLabelCls}>
                      Автомат
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

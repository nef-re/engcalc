"use client";

import "@xyflow/react/dist/style.css";

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
  nextNodeId,
  type NodeType,
  type SystemDefaults,
} from "@/lib/systemNodes";
import {
  calculateSystem,
  fetchBreakers,
  fetchCables,
  fetchStandards,
  fetchSystemDefaults,
  fetchSystemTemplate,
  fetchTransformers,
  type StandardRef,
  type SystemResult,
} from "@/lib/api";

const nodeTypes = { custom: ElectricalNode };

type Cable = { id: number; name: string; section_mm2: number };
type Breaker = { id: number; manufacturer: string; model_name: string; in_a: number };
type Transformer = { id: number; name: string; s_kva: number; uk_percent: number; u_secondary_v: number };

type NodeData = Record<string, unknown>;

export function SystemFlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selected, setSelected] = useState<{ type: "node" | "edge"; id: string } | null>(null);
  const [result, setResult] = useState<SystemResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cables, setCables] = useState<Cable[]>([]);
  const [breakers, setBreakers] = useState<Breaker[]>([]);
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [standards, setStandards] = useState<StandardRef[]>([]);
  const [standardRef, setStandardRef] = useState("");
  const [defaults, setDefaults] = useState<SystemDefaults | null>(null);
  const [uNom, setUNom] = useState(400);
  const [zSource, setZSource] = useState(10);
  const addOffset = useRef(0);

  useEffect(() => {
    Promise.all([
      fetchSystemTemplate(),
      fetchSystemDefaults(),
      fetchCables(),
      fetchBreakers(),
      fetchTransformers(),
      fetchStandards("electrical.system"),
    ]).then(([tpl, defs, c, b, tr, std]) => {
      setNodes(tpl.nodes as Node[]);
      setEdges(tpl.edges as Edge[]);
      setDefaults(defs);
      setCables(c);
      setBreakers(b);
      setTransformers(tr);
      setStandards(std.standards);
      setStandardRef(std.standard_ref);
      const d = tpl.defaults ?? defs;
      setUNom(d.u_nom_v);
      setZSource(d.z_source_mohm);
    });
  }, [setNodes, setEdges]);

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
        eds.map((e) =>
          e.id === selectedEdge.id ? { ...e, data: { ...(e.data || {}), [key]: value } } : e
        )
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

      let label = String(preset.label ?? nodeType);
      if (nodeType === "distribution_board") label = `РЩ-${count}`;
      if (nodeType === "group_board") label = `ГЩ-${count}`;
      if (nodeType === "load") label = `Нагрузка ${count}`;
      if (nodeType === "transformer_substation" && count > 1) label = `ТП-${count}`;

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
                  label: tr.name,
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
      const res = await calculateSystem(
        { nodes: nodes as unknown[], edges: edges as unknown[] },
        uNom,
        zSource
      );
      setResult(res);

      if (res.summary?.z_source_mohm) {
        setZSource(Number(res.summary.z_source_mohm));
      }
      if (res.summary?.u_nom_v) {
        setUNom(Number(res.summary.u_nom_v));
      }

      setNodes((nds) =>
        nds.map((n) => {
          const nr = res.nodes[n.id];
          if (!nr) return n;
          const extra: NodeData = { i_a: nr.i_a, p_kw: nr.p_kw };
          if ("z_source_mohm" in nr) extra.z_source_mohm = nr.z_source_mohm;
          return { ...n, data: { ...n.data, ...extra } };
        })
      );
    } finally {
      setLoading(false);
    }
  }, [nodes, edges, uNom, zSource, setNodes]);

  const nodeType = nodeData.node_type as string | undefined;

  return (
    <div className="space-y-4">
      <StandardsPanel standardRef={standardRef} standards={standards} />

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
        <span className="self-center text-xs text-slate-500">
          Соединяйте элементы: тяните от правой точки к левой
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-[520px] rounded-xl border border-slate-700/60 lg:col-span-2">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => setSelected({ type: "node", id: n.id })}
            onEdgeClick={(_, e) => setSelected({ type: "edge", id: e.id })}
            onPaneClick={() => setSelected(null)}
            fitView
            colorMode="dark"
            deleteKeyCode={null}
          >
            <Background gap={16} color="#334155" />
            <Controls />
            <MiniMap nodeColor="#0ea5e9" maskColor="rgb(15 23 42 / 0.8)" />
          </ReactFlow>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          <h3 className="text-sm font-medium text-slate-300">Параметры</h3>

          <label className="block text-xs text-slate-500">
            Uном, В
            <input
              type="number"
              value={uNom}
              onChange={(e) => setUNom(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
            />
          </label>
          <label className="block text-xs text-slate-500">
            Z источника, мОм
            <span className="ml-1 text-slate-600">(авто из ТП)</span>
            <input
              type="number"
              value={zSource}
              onChange={(e) => setZSource(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
            />
          </label>

          {selectedNode && (
            <div className="border-t border-slate-700 pt-3">
              <p className="mb-2 text-xs font-medium text-sky-400">
                Узел: {String(nodeData.label ?? "")}
              </p>
              <label className="block text-xs text-slate-500">
                Название
                <input
                  type="text"
                  value={String(nodeData.label ?? "")}
                  onChange={(e) => updateNodeData("label", e.target.value)}
                  className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
                />
              </label>

              {nodeType === "transformer_substation" && (
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] uppercase text-slate-600">Нормативные данные по умолчанию</p>
                  <label className="block text-xs text-slate-500">
                    Из каталога
                    <select
                      value={Number(nodeData.transformer_id ?? "")}
                      onChange={(e) => applyTransformerFromCatalog(Number(e.target.value))}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
                    >
                      <option value="">— вручную —</option>
                      {transformers.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-slate-500">
                    S, кВА
                    <input
                      type="number"
                      value={Number(nodeData.s_kva ?? 630)}
                      onChange={(e) => updateNodeData("s_kva", Number(e.target.value))}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
                    />
                  </label>
                  <label className="block text-xs text-slate-500">
                    Uk, %
                    <input
                      type="number"
                      step="0.1"
                      value={Number(nodeData.uk_percent ?? 6)}
                      onChange={(e) => updateNodeData("uk_percent", Number(e.target.value))}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
                    />
                  </label>
                  <label className="block text-xs text-slate-500">
                    U2, В
                    <input
                      type="number"
                      value={Number(nodeData.u_secondary_v ?? 400)}
                      onChange={(e) => updateNodeData("u_secondary_v", Number(e.target.value))}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
                    />
                  </label>
                </div>
              )}

              {nodeType === "load" && (
                <>
                  <label className="mt-2 block text-xs text-slate-500">
                    P, кВт
                    <input
                      type="number"
                      value={Number(nodeData.p_kw ?? 0)}
                      onChange={(e) => updateNodeData("p_kw", Number(e.target.value))}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
                    />
                  </label>
                  <label className="mt-2 block text-xs text-slate-500">
                    cos φ
                    <input
                      type="number"
                      step="0.01"
                      value={Number(nodeData.cos_phi ?? 0.95)}
                      onChange={(e) => updateNodeData("cos_phi", Number(e.target.value))}
                      className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
                    />
                  </label>
                </>
              )}

              {(nodeType === "distribution_board" || nodeType === "group_board" || nodeType === "vru") && (
                <label className="mt-2 block text-xs text-slate-500">
                  Kc
                  <input
                    type="number"
                    step="0.05"
                    value={Number(nodeData.kc ?? 0.9)}
                    onChange={(e) => updateNodeData("kc", Number(e.target.value))}
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
                  />
                </label>
              )}
            </div>
          )}

          {selectedEdge && (
            <div className="border-t border-slate-700 pt-3">
              <p className="mb-2 text-xs font-medium text-amber-400">Кабельная линия</p>
              <label className="block text-xs text-slate-500">
                Длина, м
                <input
                  type="number"
                  value={Number(edgeData.length_m ?? 10)}
                  onChange={(e) => updateEdgeData("length_m", Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
                />
              </label>
              <label className="mt-2 block text-xs text-slate-500">
                Кабель
                <select
                  value={Number(edgeData.cable_id ?? "")}
                  onChange={(e) => updateEdgeData("cable_id", Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
                >
                  {cables.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.section_mm2} мм²)
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-2 block text-xs text-slate-500">
                Автомат
                <select
                  value={Number(edgeData.breaker_id ?? "")}
                  onChange={(e) => updateEdgeData("breaker_id", Number(e.target.value))}
                  className="mt-1 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1"
                >
                  {breakers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.manufacturer} {b.model_name} {b.in_a}A
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={runCalculation}
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {loading ? "Расчёт…" : "Рассчитать систему"}
          </button>
        </div>
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
                  <th className="px-2 py-1">Ø, мм</th>
                  <th className="px-2 py-1">I, А</th>
                  <th className="px-2 py-1">ΔU, %</th>
                  <th className="px-2 py-1">Ik, кА</th>
                  <th className="px-2 py-1">Автомат</th>
                </tr>
              </thead>
              <tbody>
                {result.edges.map((e) => (
                  <tr key={`${e.from}-${e.to}`} className="border-t border-slate-800 text-slate-300">
                    <td className="px-2 py-1">{e.from} → {e.to}</td>
                    <td className="px-2 py-1">{e.cable}</td>
                    <td className="px-2 py-1">{e.outer_diameter_mm}</td>
                    <td className="px-2 py-1">{e.i_a}</td>
                    <td className={`px-2 py-1 ${e.delta_u_percent > 5 ? "text-amber-400" : ""}`}>
                      {e.delta_u_percent}
                    </td>
                    <td className="px-2 py-1">{e.ik_ka}</td>
                    <td className="px-2 py-1">{e.breaker || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

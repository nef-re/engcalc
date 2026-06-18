"""Расчёт распределительной сети: ВРУ → РЩ → ГЩ → нагрузки."""

from __future__ import annotations

import math
from typing import Any

from catalog.models import Cable, CircuitBreaker, Transformer
from electrical.defaults import calc_transformer_z_mohm, get_system_defaults
from electrical.engine import calc_load, calc_short_circuit, calc_voltage_drop

DELTA_U_LIMIT = 5.0


def _node_map(nodes: list[dict]) -> dict[str, dict]:
    return {n["id"]: n for n in nodes}


def _children_map(edges: list[dict]) -> dict[str, list[str]]:
    children: dict[str, list[str]] = {}
    for e in edges:
        children.setdefault(e["from"], []).append(e["to"])
    return children


def _parent_map(edges: list[dict]) -> dict[str, str]:
    return {e["to"]: e["from"] for e in edges}


def _edge_map(edges: list[dict]) -> dict[tuple[str, str], dict]:
    return {(e["from"], e["to"]): e for e in edges}


def _get_cable(cable_id: int | None, section_mm2: float | None) -> Cable | None:
    if cable_id:
        try:
            return Cable.objects.select_related("brand").get(pk=cable_id)
        except Cable.DoesNotExist:
            pass
    if section_mm2:
        return (
            Cable.objects.filter(section_mm2=section_mm2, material="Cu")
            .select_related("brand")
            .first()
        )
    return None


def _aggregate_loads(nodes: list[dict], edges: list[dict]) -> dict[str, dict]:
    """Снизу вверх: суммирование нагрузок по узлам."""
    nm = _node_map(nodes)
    children = _children_map(edges)
    loads: dict[str, dict] = {}

    def visit(nid: str) -> dict:
        if nid in loads:
            return loads[nid]
        node = nm[nid]
        ntype = node.get("node_type", "load")

        if ntype == "load":
            p = float(node.get("p_kw", 0))
            cos_phi = float(node.get("cos_phi", 0.95))
            kc = float(node.get("kc", 1.0))
            phase = node.get("phase", "1")
            res = calc_load(p, cos_phi, kc, phase)
            loads[nid] = {
                "p_kw": res.p_kw,
                "i_a": res.i_a,
                "cos_phi": cos_phi,
                "phase": phase,
            }
            return loads[nid]

        child_ids = children.get(nid, [])
        if not child_ids:
            loads[nid] = {"p_kw": 0, "i_a": 0, "cos_phi": 0.95, "phase": "3"}
            return loads[nid]

        total_p = 0.0
        max_i = 0.0
        cos_phi = float(node.get("cos_phi", 0.95))
        phase = node.get("phase", "3")
        for cid in child_ids:
            cl = visit(cid)
            total_p += cl["p_kw"]
            max_i = max(max_i, cl["i_a"])

        kc = float(node.get("kc", 0.9 if ntype not in ("vru", "transformer_substation") else 1.0))
        if phase == "3" and ntype in ("vru", "distribution_board", "group_board", "transformer_substation"):
            res = calc_load(total_p, cos_phi, kc, "3")
            loads[nid] = {
                "p_kw": res.p_kw,
                "i_a": res.i_a,
                "cos_phi": cos_phi,
                "phase": phase,
            }
        else:
            loads[nid] = {
                "p_kw": total_p * kc,
                "i_a": max_i * kc if ntype == "group_board" else max_i,
                "cos_phi": cos_phi,
                "phase": phase,
            }
        return loads[nid]

    for n in nodes:
        visit(n["id"])
    return loads


def _normalize_graph(graph_data: dict[str, Any]) -> tuple[list[dict], list[dict]]:
    """Привести React Flow формат к внутреннему."""
    raw_nodes = graph_data.get("nodes", [])
    raw_edges = graph_data.get("edges", [])

    nodes = []
    for n in raw_nodes:
        data = n.get("data", {})
        nodes.append({
            "id": n["id"],
            "label": data.get("label", n.get("label", n["id"])),
            "node_type": data.get("node_type", n.get("node_type", "load")),
            "p_kw": data.get("p_kw", n.get("p_kw", 0)),
            "cos_phi": data.get("cos_phi", n.get("cos_phi", 0.95)),
            "kc": data.get("kc", n.get("kc", 1.0)),
            "phase": data.get("phase", n.get("phase", "1")),
            "s_kva": data.get("s_kva", n.get("s_kva")),
            "uk_percent": data.get("uk_percent", n.get("uk_percent")),
            "u_secondary_v": data.get("u_secondary_v", n.get("u_secondary_v")),
            "u_primary_kv": data.get("u_primary_kv", n.get("u_primary_kv")),
            "transformer_id": data.get("transformer_id", n.get("transformer_id")),
        })

    edges = []
    for e in raw_edges:
        data = e.get("data", {})
        edges.append({
            "from": e.get("from", e.get("source")),
            "to": e.get("to", e.get("target")),
            "length_m": data.get("length_m", e.get("length_m", 10)),
            "cable_id": data.get("cable_id", e.get("cable_id")),
            "section_mm2": data.get("section_mm2", e.get("section_mm2")),
            "breaker_id": data.get("breaker_id", e.get("breaker_id")),
        })

    return nodes, edges


def _resolve_source_params(nodes: list[dict], u_nom_v: float, z_source_mohm: float) -> tuple[float, float]:
    """Если на схеме есть ТП — берём U и Z из неё (или из каталога)."""
    for n in nodes:
        if n.get("node_type") != "transformer_substation":
            continue

        s_kva = float(n.get("s_kva") or 630)
        uk = float(n.get("uk_percent") or 6)
        u2 = float(n.get("u_secondary_v") or 400)

        tid = n.get("transformer_id")
        if tid:
            try:
                tr = Transformer.objects.get(pk=tid)
                s_kva = tr.s_kva
                uk = tr.uk_percent
                u2 = tr.u_secondary_v
            except Transformer.DoesNotExist:
                pass

        return u2, calc_transformer_z_mohm(s_kva, uk, u2)

    return u_nom_v, z_source_mohm


def calculate_system(
    graph_data: dict[str, Any],
    u_nom_v: float = 400,
    z_source_mohm: float = 10.0,
) -> dict[str, Any]:
    nodes, edges = _normalize_graph(graph_data)

    if not nodes:
        return {"error": "Схема пуста", "nodes": [], "edges": [], "warnings": []}

    u_nom_v, z_source_mohm = _resolve_source_params(nodes, u_nom_v, z_source_mohm)

    loads = _aggregate_loads(nodes, edges)
    em = _edge_map(edges)
    warnings: list[str] = []
    edge_results: list[dict] = []
    node_results: dict[str, dict] = {}

    for (src, dst), edge in em.items():
        load = loads.get(dst, {})
        current_a = float(load.get("i_a", 0))
        cos_phi = float(load.get("cos_phi", 0.95))
        phase = load.get("phase", "1")
        length_m = float(edge.get("length_m", 10))

        cable = _get_cable(edge.get("cable_id"), edge.get("section_mm2"))
        if not cable:
            warnings.append(f"Участок {src}→{dst}: кабель не задан")
            continue

        du = calc_voltage_drop(
            length_m, current_a, cable.r_mohm_per_m, cable.x_mohm_per_m,
            cos_phi, phase, u_nom_v,
        )
        ik = calc_short_circuit(
            u_nom_v, z_source_mohm, length_m,
            cable.r_mohm_per_m, cable.x_mohm_per_m, phase,
        )

        breaker_ok = True
        breaker = None
        breaker_id = edge.get("breaker_id")
        if breaker_id:
            try:
                breaker = CircuitBreaker.objects.get(pk=breaker_id)
                if breaker.in_a < current_a:
                    warnings.append(
                        f"Участок {src}→{dst}: In={breaker.in_a}А < Iрасч={current_a:.1f}А"
                    )
                    breaker_ok = False
                if breaker.icu_ka < ik.ik_a / 1000:
                    warnings.append(
                        f"Участок {src}→{dst}: Icu={breaker.icu_ka}кА < Ik={ik.ik_a/1000:.2f}кА"
                    )
                    breaker_ok = False
            except CircuitBreaker.DoesNotExist:
                pass

        if cable.i_long_a < current_a:
            warnings.append(
                f"Участок {src}→{dst}: Iд={cable.i_long_a}А < Iрасч={current_a:.1f}А"
            )
        if du.delta_u_percent > DELTA_U_LIMIT:
            warnings.append(
                f"Участок {src}→{dst}: ΔU={du.delta_u_percent:.2f}% > {DELTA_U_LIMIT}%"
            )

        edge_results.append({
            "from": src,
            "to": dst,
            "length_m": length_m,
            "cable": cable.name,
            "cable_id": cable.id,
            "section_mm2": cable.section_mm2,
            "outer_diameter_mm": cable.outer_diameter_mm,
            "i_a": round(current_a, 2),
            "delta_u_percent": round(du.delta_u_percent, 2),
            "ik_a": round(ik.ik_a, 1),
            "ik_ka": round(ik.ik_a / 1000, 3),
            "breaker_ok": breaker_ok,
            "breaker": f"{breaker.manufacturer} {breaker.model_name}" if breaker else None,
        })

    for nid, load in loads.items():
        node = _node_map(nodes)[nid]
        nr = {
            "label": node.get("label", nid),
            "node_type": node.get("node_type"),
            "p_kw": round(load["p_kw"], 2),
            "i_a": round(load["i_a"], 2),
        }
        if node.get("node_type") == "transformer_substation":
            nr["z_source_mohm"] = z_source_mohm
            nr["s_kva"] = node.get("s_kva")
        node_results[nid] = nr

    return {
        "nodes": node_results,
        "edges": edge_results,
        "warnings": warnings,
        "summary": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "warnings_count": len(warnings),
            "u_nom_v": u_nom_v,
            "z_source_mohm": z_source_mohm,
        },
    }


def default_mkd_template() -> dict[str, Any]:
    """Шаблон МКД: ТП → ВРУ → РЩ → ГЩ → нагрузка."""
    defs = get_system_defaults()
    tp = defs["node_defaults"]["transformer_substation"]
    edge_def = defs["edge"]

    return {
        "nodes": [
            {
                "id": "tp1",
                "type": "custom",
                "position": {"x": -120, "y": 200},
                "data": {**tp, "label": "ТП 10/0,4 кВ"},
            },
            {
                "id": "vru",
                "type": "custom",
                "position": {"x": 150, "y": 200},
                "data": {
                    "label": "ВРУ",
                    "node_type": "vru",
                    "kc": 1.0,
                    "cos_phi": 0.95,
                    "phase": "3",
                },
            },
            {
                "id": "rs1",
                "type": "custom",
                "position": {"x": 400, "y": 200},
                "data": {
                    "label": "РЩ-1 (секция)",
                    "node_type": "distribution_board",
                    "kc": 0.9,
                    "cos_phi": 0.95,
                    "phase": "3",
                },
            },
            {
                "id": "gs1",
                "type": "custom",
                "position": {"x": 650, "y": 200},
                "data": {
                    "label": "ГЩ кв. 1",
                    "node_type": "group_board",
                    "kc": 0.8,
                    "cos_phi": 0.95,
                    "phase": "1",
                },
            },
            {
                "id": "load1",
                "type": "custom",
                "position": {"x": 900, "y": 200},
                "data": {
                    "label": "Нагрузка кв. 1",
                    "node_type": "load",
                    "p_kw": 5.0,
                    "cos_phi": 0.92,
                    "kc": 1.0,
                    "phase": "1",
                },
            },
        ],
        "edges": [
            {
                "id": "e-tp-vru",
                "source": "tp1",
                "target": "vru",
                "data": {"length_m": 5, "cable_id": 6, "breaker_id": 2},
            },
            {
                "id": "e-vru-rs1",
                "source": "vru",
                "target": "rs1",
                "data": {"length_m": 15, "cable_id": 5, "breaker_id": 2},
            },
            {
                "id": "e-rs1-gs1",
                "source": "rs1",
                "target": "gs1",
                "data": {"length_m": 25, "cable_id": 3, "breaker_id": 1},
            },
            {
                "id": "e-gs1-load1",
                "source": "gs1",
                "target": "load1",
                "data": {"length_m": 12, "cable_id": 2, "breaker_id": 1},
            },
        ],
        "defaults": defs,
    }

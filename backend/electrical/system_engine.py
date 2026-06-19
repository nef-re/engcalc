"""Расчёт распределительной сети: ТП → ВРУ → ЩС → нагрузки."""

from __future__ import annotations

import math
from typing import Any

from catalog.models import Cable, CircuitBreaker
from catalog.display import cable_display_name
from electrical.defaults import (
    NODE_TYPE_LABELS,
    calc_transformer_z_mohm,
    resolve_tp_electrical,
    tp_output_ports,
    get_system_defaults,
    load_voltage_from_tp,
)
from electrical.selection import (
    allowed_constructions,
    edge_electrical_params,
    edge_processing_order,
    line_z_mohm,
    normalize_edge_directions,
    parallel_edge_groups,
    select_breaker_for_line,
    select_cable_optimal,
    subtree_load_nodes,
    validate_breaker,
    validate_cable,
    NODE_TYPE_RANK,
)
from electrical.vru import (
    handle_section_index,
    is_tap_handle,
    vru_active_sections,
    vru_per_section_inputs,
    vru_ports,
    vru_sections_merged,
)
from electrical.engine import calc_load, calc_short_circuit, calc_voltage_drop

DELTA_U_LIMIT = 5.0

INPUT_BREAKER_NODE_TYPES = (
    "group_board",
    "distribution_board",
    "vru",
    "transformer_substation",
)


def _node_map(nodes: list[dict]) -> dict[str, dict]:
    return {n["id"]: n for n in nodes}


def _node_display_label(nodes: list[dict], node_id: str) -> str:
    node = _node_map(nodes).get(node_id)
    if not node:
        return node_id
    return node.get("label") or NODE_TYPE_LABELS.get(node.get("node_type", ""), node_id)


def _segment_label(nodes: list[dict], src: str, dst: str) -> str:
    return f"{_node_display_label(nodes, src)} → {_node_display_label(nodes, dst)}"


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


def _sum_child_loads(child_data: list[dict], cos_phi: float, kc: float, u_line: float) -> dict:
    if not child_data:
        return {"p_kw": 0, "i_a": 0, "cos_phi": cos_phi, "phase": "3"}
    total_p = sum(c["p_kw"] for c in child_data)
    has_3ph = any(c["phase"] == "3" for c in child_data)
    has_1ph = any(c["phase"] == "1" for c in child_data)
    if has_3ph and not has_1ph:
        res = calc_load(total_p, cos_phi, kc, "3", u_nom_v=u_line)
        return {"p_kw": res.p_kw, "i_a": res.i_a, "cos_phi": cos_phi, "phase": "3"}
    if has_1ph and not has_3ph:
        total_i = sum(c["i_a"] for c in child_data) * kc
        return {"p_kw": total_p * kc, "i_a": total_i, "cos_phi": cos_phi, "phase": "1"}
    res = calc_load(total_p, cos_phi, kc, "3", u_nom_v=u_line)
    return {"p_kw": res.p_kw, "i_a": res.i_a, "cos_phi": cos_phi, "phase": "3"}


def _aggregate_vru_node(
    nid: str,
    node: dict,
    edges: list[dict],
    loads: dict,
    visit,
    u_line: float,
) -> dict:
    cos_phi = float(node.get("cos_phi", 0.95))
    kc = float(node.get("kc", 1.0))
    active = vru_active_sections(node)
    merged = vru_sections_merged(node)
    outgoing = [e for e in edges if e["from"] == nid]

    section_children: dict[int, list[dict]] = {0: [], 1: []}
    tap_children: dict[int, list[dict]] = {0: [], 1: []}
    for e in outgoing:
        sh = e.get("source_handle") or "out-0"
        sec = handle_section_index(sh)
        if sec not in active:
            continue
        if is_tap_handle(sh):
            tap_children.setdefault(sec, []).append(visit(e["to"]))
        else:
            section_children.setdefault(sec, []).append(visit(e["to"]))

    vru_sections: list[dict] = []
    for sec in (0, 1):
        is_active = sec in active
        if not is_active:
            vru_sections.append(
                {"section": sec, "label": f"С-{sec + 1}", "p_kw": 0, "i_a": 0, "active": False}
            )
            continue
        agg = _sum_child_loads(section_children.get(sec, []), cos_phi, kc, u_line)
        tap_agg = _sum_child_loads(tap_children.get(sec, []), cos_phi, kc, u_line)
        sec_i = agg["i_a"] + tap_agg["i_a"]
        sec_p = agg["p_kw"] + tap_agg["p_kw"]
        vru_sections.append(
            {
                "section": sec,
                "label": f"С-{sec + 1}",
                "p_kw": round(sec_p, 2),
                "i_a": round(sec_i, 2),
                "tap_i_a": round(tap_agg["i_a"], 2),
                "active": True,
            }
        )

    active_sections = [s for s in vru_sections if s.get("active")]
    if merged and len(active_sections) > 1:
        all_children = [
            c
            for sec in active
            for c in section_children.get(sec, []) + tap_children.get(sec, [])
        ]
        combined = _sum_child_loads(all_children, cos_phi, kc, u_line)
        total_p, total_i = combined["p_kw"], combined["i_a"]
    else:
        total_p = sum(s["p_kw"] for s in active_sections)
        total_i = sum(s["i_a"] for s in active_sections)

    loads[nid] = {
        "p_kw": round(total_p, 2),
        "i_a": round(total_i, 2),
        "cos_phi": cos_phi,
        "phase": "3",
        "vru_sections": vru_sections,
        "vru_merged": merged,
    }
    return loads[nid]


def _aggregate_loads(nodes: list[dict], edges: list[dict], u_line: float) -> dict[str, dict]:
    """Снизу вверх: суммирование нагрузок по узлам (от нагрузок к ТП)."""
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
            u = load_voltage_from_tp(u_line, phase)
            res = calc_load(p, cos_phi, kc, phase, u_nom_v=u)
            loads[nid] = {
                "p_kw": res.p_kw,
                "i_a": res.i_a,
                "cos_phi": cos_phi,
                "phase": phase,
            }
            return loads[nid]

        if ntype == "vru":
            return _aggregate_vru_node(nid, node, edges, loads, visit, u_line)

        child_ids = children.get(nid, [])
        if not child_ids:
            loads[nid] = {"p_kw": 0, "i_a": 0, "cos_phi": 0.95, "phase": "3"}
            return loads[nid]

        child_data = [visit(cid) for cid in child_ids]
        total_p = sum(c["p_kw"] for c in child_data)
        cos_phi = float(node.get("cos_phi", 0.95))
        kc = float(node.get("kc", 0.9 if ntype not in ("vru", "transformer_substation") else 1.0))

        has_3ph = any(c["phase"] == "3" for c in child_data)
        has_1ph = any(c["phase"] == "1" for c in child_data)

        if has_3ph and not has_1ph:
            res = calc_load(total_p, cos_phi, kc, "3", u_nom_v=u_line)
            loads[nid] = {
                "p_kw": res.p_kw,
                "i_a": res.i_a,
                "cos_phi": cos_phi,
                "phase": "3",
            }
        elif has_1ph and not has_3ph:
            total_i = sum(c["i_a"] for c in child_data) * kc
            loads[nid] = {
                "p_kw": total_p * kc,
                "i_a": total_i,
                "cos_phi": cos_phi,
                "phase": "1",
            }
        else:
            res = calc_load(total_p, cos_phi, kc, "3", u_nom_v=u_line)
            loads[nid] = {
                "p_kw": res.p_kw,
                "i_a": res.i_a,
                "cos_phi": cos_phi,
                "phase": "3",
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
            "u_nom_v": data.get("u_nom_v", n.get("u_nom_v")),
            "s_kva": data.get("s_kva", n.get("s_kva")),
            "uk_percent": data.get("uk_percent", n.get("uk_percent")),
            "u_secondary_v": data.get("u_secondary_v", n.get("u_secondary_v")),
            "u_primary_kv": data.get("u_primary_kv", n.get("u_primary_kv")),
            "transformer_id": data.get("transformer_id", n.get("transformer_id")),
            "transformer_count": data.get("transformer_count", n.get("transformer_count", 1)),
            "z_source_mohm": data.get("z_source_mohm", n.get("z_source_mohm")),
            "input_ports": data.get("input_ports", n.get("input_ports", [])),
            "output_ports": data.get("output_ports", n.get("output_ports", [])),
            "breaker_id": data.get("breaker_id", n.get("breaker_id")),
            "manual_breaker": bool(data.get("manual_breaker", n.get("manual_breaker", False))),
            "vru_scheme": data.get("vru_scheme", n.get("vru_scheme", "1in_2out")),
            "vru_section_switch": data.get("vru_section_switch", n.get("vru_section_switch", "open")),
            "vru_operating_mode": data.get("vru_operating_mode", n.get("vru_operating_mode", "normal")),
            "vru_tap_in0": bool(data.get("vru_tap_in0", n.get("vru_tap_in0", False))),
            "vru_tap_in1": bool(data.get("vru_tap_in1", n.get("vru_tap_in1", False))),
        })

    edges = []
    for e in raw_edges:
        data = e.get("data", {})
        edges.append({
            "id": e.get("id", f"{e.get('source', e.get('from'))}-{e.get('target', e.get('to'))}"),
            "from": e.get("from", e.get("source")),
            "to": e.get("to", e.get("target")),
            "length_m": data.get("length_m", e.get("length_m", 10)),
            "cable_id": data.get("cable_id", e.get("cable_id")),
            "section_mm2": data.get("section_mm2", e.get("section_mm2")),
            "breaker_id": data.get("breaker_id", e.get("breaker_id")),
            "manual_cable": bool(data.get("manual_cable", False)),
            "manual_breaker": bool(data.get("manual_breaker", False)),
            "source_handle": e.get("sourceHandle", e.get("source_handle")),
            "target_handle": e.get("targetHandle", e.get("target_handle")),
        })

    return nodes, edges


def _resolve_source_params(nodes: list[dict], u_nom_v: float, z_source_mohm: float) -> tuple[float, float]:
    """Если на схеме есть ТП — берём U и Z из неё (каталог или ручной ввод)."""
    for n in nodes:
        if n.get("node_type") != "transformer_substation":
            continue
        tp = resolve_tp_electrical(n)
        return float(tp["u_secondary_v"]), float(tp["z_mohm"])

    return u_nom_v, z_source_mohm


def _requires_armored_cable(nodes: list[dict], src: str, dst: str) -> bool:
    nm = _node_map(nodes)
    src_node = nm.get(src, {})
    dst_node = nm.get(dst, {})
    return (
        src_node.get("node_type") == "transformer_substation"
        and dst_node.get("node_type") == "vru"
    )


def calculate_system(
    graph_data: dict[str, Any],
    u_nom_v: float = 400,
    z_source_mohm: float = 10.0,
) -> dict[str, Any]:
    nodes, edges = _normalize_graph(graph_data)

    if not nodes:
        return {"error": "Схема пуста", "nodes": [], "edges": [], "warnings": []}

    edges, orient_warnings = normalize_edge_directions(nodes, edges)
    warnings: list[str] = list(orient_warnings)

    u_nom_v, z_source_mohm = _resolve_source_params(nodes, u_nom_v, z_source_mohm)

    loads = _aggregate_loads(nodes, edges, u_nom_v)
    nm = _node_map(nodes)
    children = _children_map(edges)
    parallel_groups = parallel_edge_groups(edges)
    edge_order = edge_processing_order(nodes, edges)

    edge_results: list[dict] = []
    node_results: dict[str, dict] = {}
    graph_updates: list[dict] = []

    z_at_node: dict[str, float] = {}
    for n in nodes:
        if n.get("node_type") == "transformer_substation":
            z_at_node[n["id"]] = z_source_mohm
    if not z_at_node:
        incoming = {e["to"] for e in edges}
        for n in nodes:
            if n["id"] not in incoming:
                z_at_node[n["id"]] = z_source_mohm

    # --- Проход 1: кабели, ΔU, Ik (от ТП к нагрузкам) ---
    edge_state: dict[str, dict] = {}

    for edge in edge_order:
        src, dst = edge["from"], edge["to"]
        load = loads.get(dst, {})
        src_node = nm.get(src, {})
        total_i = float(load.get("i_a", 0))
        n_parallel = parallel_groups.get((src, dst), 1)
        current_a = total_i / n_parallel if n_parallel > 1 else total_i
        cos_phi = float(load.get("cos_phi", 0.95))
        subtree = subtree_load_nodes(dst, nm, children)
        phase, u_edge = edge_electrical_params(src_node, subtree, u_nom_v)
        length_m = float(edge.get("length_m", 10))
        z_here = z_at_node.get(src, z_source_mohm)
        seg = _segment_label(nodes, src, dst)
        armored = _requires_armored_cable(nodes, src, dst)
        manual_cable = edge.get("manual_cable", False)
        constructions = allowed_constructions(src_node, subtree, armored, manual_cable)

        cable: Cable | None = None
        if manual_cable and edge.get("cable_id"):
            cable = _get_cable(edge.get("cable_id"), edge.get("section_mm2"))
        if not cable:
            cable = select_cable_optimal(
                current_a,
                length_m,
                cos_phi,
                phase,
                u_edge,
                constructions,
                armored=armored,
            )
        if not cable and edge.get("cable_id"):
            cable = _get_cable(edge.get("cable_id"), edge.get("section_mm2"))

        if not cable:
            warnings.append(f"Участок {seg}: кабель не подобран")
            continue

        if not manual_cable:
            edge["cable_id"] = cable.id
            edge["section_mm2"] = cable.section_mm2

        du = calc_voltage_drop(
            length_m, current_a, cable.r_mohm_per_m, cable.x_mohm_per_m,
            cos_phi, phase, u_edge,
        )
        ik = calc_short_circuit(
            u_edge, z_here, length_m,
            cable.r_mohm_per_m, cable.x_mohm_per_m, phase,
        )
        ik_ka = ik.ik_a / 1000

        line_z = line_z_mohm(cable, length_m)
        if n_parallel > 1:
            line_z = line_z / n_parallel
        z_at_node[dst] = max(z_at_node.get(dst, 0), z_here + line_z)

        edge_state[edge["id"]] = {
            "edge": edge,
            "src": src,
            "dst": dst,
            "seg": seg,
            "current_a": current_a,
            "total_i": total_i,
            "cos_phi": cos_phi,
            "phase": phase,
            "u_edge": u_edge,
            "length_m": length_m,
            "cable": cable,
            "constructions": constructions,
            "manual_cable": manual_cable,
            "manual_allowed": allowed_constructions(src_node, subtree, armored, manual=True),
            "armored": armored,
            "src_node": src_node,
            "subtree": subtree,
            "du": du,
            "ik_ka": ik_ka,
            "section_mm2": cable.section_mm2,
            "n_parallel": n_parallel,
            "z_here": z_here,
        }

    # --- Уточнение сечений вверх по цепи (не меньше нижестоящих) ---
    for edge in reversed(edge_order):
        st = edge_state.get(edge["id"])
        if not st or st["manual_cable"]:
            continue
        min_section = max(
            (
                float(edge_state[e["id"]]["section_mm2"])
                for e in edges
                if e["from"] == st["dst"] and e["id"] in edge_state
            ),
            default=0.0,
        )
        if min_section <= 0 or st["cable"].section_mm2 >= min_section:
            continue
        upgraded = select_cable_optimal(
            st["current_a"],
            st["length_m"],
            st["cos_phi"],
            st["phase"],
            st["u_edge"],
            st["constructions"],
            armored=st["armored"],
            min_section_mm2=min_section,
        )
        if upgraded and upgraded.id != st["cable"].id:
            st["cable"] = upgraded
            st["section_mm2"] = upgraded.section_mm2
            st["edge"]["cable_id"] = upgraded.id
            st["edge"]["section_mm2"] = upgraded.section_mm2
            st["du"] = calc_voltage_drop(
                st["length_m"],
                st["current_a"],
                upgraded.r_mohm_per_m,
                upgraded.x_mohm_per_m,
                st["cos_phi"],
                st["phase"],
                st["u_edge"],
            )
            st["ik_ka"] = calc_short_circuit(
                st["u_edge"],
                st["z_here"],
                st["length_m"],
                upgraded.r_mohm_per_m,
                upgraded.x_mohm_per_m,
                st["phase"],
            ).ik_a / 1000

    # --- Проход 2: автоматы на отходах к нагрузкам (защита кабельной линии) ---
    breaker_by_edge: dict[str, CircuitBreaker | None] = {}

    for edge in reversed(edge_order):
        st = edge_state.get(edge["id"])
        if not st:
            continue
        edge = st["edge"]
        dst = st["dst"]
        dst_type = nm.get(dst, {}).get("node_type", "load")
        manual_breaker = edge.get("manual_breaker", False)

        if dst_type != "load":
            breaker_by_edge[edge["id"]] = None
            continue

        breaker: CircuitBreaker | None = None
        if manual_breaker and edge.get("breaker_id"):
            try:
                breaker = CircuitBreaker.objects.get(pk=edge["breaker_id"])
            except CircuitBreaker.DoesNotExist:
                breaker = None
        elif not manual_breaker:
            breaker, _ = select_breaker_for_line(
                st["current_a"],
                st["ik_ka"],
                st["phase"],
                cable_i_long_a=float(st["cable"].i_long_a),
                max_downstream_in=0,
            )

        if breaker and not manual_breaker:
            edge["breaker_id"] = breaker.id

        breaker_by_edge[edge["id"]] = breaker

    # --- Проход 3: вводные автоматы на узлах (ЩС, ВРУ, ТП) по суммарному току ---
    breaker_by_node: dict[str, CircuitBreaker | None] = {}
    selectivity_by_node: dict[str, bool] = {}

    board_nodes = sorted(
        [n for n in nodes if n.get("node_type") in INPUT_BREAKER_NODE_TYPES],
        key=lambda n: NODE_TYPE_RANK.get(n.get("node_type", ""), 50),
        reverse=True,
    )

    vru_section_breakers_by_node: dict[str, list[dict]] = {}

    for node in board_nodes:
        nid = node["id"]
        ntype = node.get("node_type", "")
        load = loads.get(nid, {})
        current_a = float(load.get("i_a", 0))
        phase = load.get("phase", "3")
        manual_breaker = bool(node.get("manual_breaker", False))

        incoming = [e for e in edges if e["to"] == nid]

        def _incoming_ik_cable(inc_list: list[dict]) -> tuple[float, float]:
            inc_states = [edge_state[e["id"]] for e in inc_list if e["id"] in edge_state]
            if inc_states:
                return (
                    max(st["ik_ka"] for st in inc_states),
                    min(float(st["cable"].i_long_a) for st in inc_states),
                )
            ik = calc_short_circuit(
                u_nom_v, z_at_node.get(nid, z_source_mohm), 0, 0, 0, phase
            ).ik_a / 1000
            return ik, 0.0

        def _downstream_in(section: int | None = None) -> float:
            downstream_ins: list[float] = []
            for e in edges:
                if e["from"] != nid:
                    continue
                sh = e.get("source_handle") or "out-0"
                if section is not None and handle_section_index(sh) != section:
                    continue
                eb = breaker_by_edge.get(e["id"])
                if eb:
                    downstream_ins.append(float(eb.in_a))
                child = e["to"]
                nb = breaker_by_node.get(child)
                if nb:
                    downstream_ins.append(float(nb.in_a))
            return max(downstream_ins) if downstream_ins else 0.0

        ik_ka, cable_i_long = _incoming_ik_cable(incoming)
        max_downstream_in = _downstream_in()

        if ntype == "vru" and vru_per_section_inputs(node):
            vru_secs = load.get("vru_sections", [])
            section_breakers: list[dict] = []
            primary_breaker: CircuitBreaker | None = None
            for sec_info in vru_secs:
                if not sec_info.get("active"):
                    continue
                sec_idx = int(sec_info["section"])
                sec_i = float(sec_info["i_a"])
                inc_sec = [
                    e for e in incoming if handle_section_index(e.get("target_handle")) == sec_idx
                ]
                sec_ik, sec_cable = _incoming_ik_cable(inc_sec)
                sec_max_down = _downstream_in(sec_idx)
                sec_breaker: CircuitBreaker | None = None
                sec_sel = True
                if sec_i > 0:
                    sec_breaker, sec_sel = select_breaker_for_line(
                        sec_i,
                        sec_ik,
                        phase,
                        cable_i_long_a=sec_cable,
                        max_downstream_in=sec_max_down,
                    )
                if sec_breaker and primary_breaker is None:
                    primary_breaker = sec_breaker
                section_breakers.append(
                    {
                        "section": sec_idx,
                        "label": sec_info.get("label", f"С-{sec_idx + 1}"),
                        "i_a": round(sec_i, 2),
                        "breaker_id": sec_breaker.id if sec_breaker else None,
                        "breaker_in_a": sec_breaker.in_a if sec_breaker else None,
                        "breaker": (
                            f"{sec_breaker.manufacturer} {sec_breaker.model_name}"
                            if sec_breaker
                            else None
                        ),
                        "selectivity_ok": sec_sel,
                    }
                )
                if sec_breaker and not sec_sel:
                    warnings.append(
                        f"ВРУ {_node_display_label(nodes, nid)}, {sec_info.get('label')}: см. селективность"
                    )
            vru_section_breakers_by_node[nid] = section_breakers
            breaker_by_node[nid] = primary_breaker
            selectivity_by_node[nid] = all(
                sb.get("selectivity_ok", True) for sb in section_breakers
            )
            continue

        breaker: CircuitBreaker | None = None
        selectivity_ok = True
        if manual_breaker and node.get("breaker_id"):
            try:
                breaker = CircuitBreaker.objects.get(pk=node["breaker_id"])
                selectivity_ok = (
                    max_downstream_in <= 0 or float(breaker.in_a) > max_downstream_in
                )
            except CircuitBreaker.DoesNotExist:
                breaker = None
        elif not manual_breaker and current_a > 0:
            breaker, selectivity_ok = select_breaker_for_line(
                current_a,
                ik_ka,
                phase,
                cable_i_long_a=cable_i_long,
                max_downstream_in=max_downstream_in,
            )
            if breaker:
                node["breaker_id"] = breaker.id

        breaker_by_node[nid] = breaker
        selectivity_by_node[nid] = selectivity_ok

        if ntype == "vru":
            vru_secs = load.get("vru_sections", [])
            vru_section_breakers_by_node[nid] = [
                {
                    "section": s["section"],
                    "label": s.get("label", f"С-{s['section'] + 1}"),
                    "i_a": s.get("i_a", 0),
                    "breaker_id": breaker.id if breaker else None,
                    "breaker_in_a": breaker.in_a if breaker else None,
                    "breaker": f"{breaker.manufacturer} {breaker.model_name}" if breaker else None,
                    "selectivity_ok": selectivity_ok,
                }
                for s in vru_secs
                if s.get("active")
            ]

        if breaker and not selectivity_ok:
            label = _node_display_label(nodes, nid)
            warnings.append(f"Узел {label}: см. селективность")

    # --- Сборка результатов ---
    for edge in edge_order:
        st = edge_state.get(edge["id"])
        if not st:
            continue
        edge = st["edge"]
        cable = st["cable"]
        breaker = breaker_by_edge.get(edge["id"])
        dst = st["dst"]
        dst_type = nm.get(dst, {}).get("node_type", "load")

        min_section = max(
            (
                float(edge_state[e["id"]]["section_mm2"])
                for e in edges
                if e["from"] == dst and e["id"] in edge_state
            ),
            default=0.0,
        )

        violations: list[str] = []
        violations.extend(
            validate_cable(
                cable,
                st["current_a"],
                st["length_m"],
                st["cos_phi"],
                st["phase"],
                st["u_edge"],
                st["manual_allowed"] if st["manual_cable"] else st["constructions"],
                min_section_mm2=min_section,
            )
        )
        if dst_type == "load":
            if breaker:
                violations.extend(
                    validate_breaker(
                        breaker,
                        st["current_a"],
                        st["ik_ka"],
                        0,
                        cable_i_long_a=float(cable.i_long_a),
                    )
                )
            else:
                violations.append("Автомат не подобран")

        for issue in violations:
            warnings.append(f"Участок {st['seg']}: {issue}")

        graph_updates.append({
            "id": edge.get("id"),
            "source": st["src"],
            "target": dst,
            "cable_id": cable.id,
            "breaker_id": breaker.id if breaker else None,
            "section_mm2": cable.section_mm2,
            "manual_cable": st["manual_cable"],
            "manual_breaker": edge.get("manual_breaker", False),
            "phase": st["phase"],
            "u_nom_v": st["u_edge"],
            "constructions": st["constructions"],
        })

        display_breaker = breaker if dst_type == "load" else breaker_by_node.get(dst)

        edge_results.append({
            "id": edge.get("id"),
            "from_id": st["src"],
            "to_id": dst,
            "from": _node_display_label(nodes, st["src"]),
            "to": _node_display_label(nodes, dst),
            "length_m": st["length_m"],
            "cable": cable_display_name(cable),
            "cable_id": cable.id,
            "section_mm2": cable.section_mm2,
            "i_a": round(st["total_i"], 2),
            "i_per_line_a": round(st["current_a"], 2),
            "n_parallel": st["n_parallel"],
            "delta_u_percent": round(st["du"].delta_u_percent, 2),
            "ik_a": round(st["ik_ka"] * 1000, 1),
            "ik_ka": round(st["ik_ka"], 3),
            "breaker_ok": len(violations) == 0,
            "breaker": (
                f"{display_breaker.manufacturer} {display_breaker.model_name}"
                if display_breaker
                else None
            ),
            "breaker_in_a": display_breaker.in_a if display_breaker else None,
            "breaker_id": display_breaker.id if display_breaker else None,
            "breaker_placement": (
                "feeder" if dst_type == "load" and breaker else "input" if display_breaker else None
            ),
            "manual_cable": st["manual_cable"],
            "manual_breaker": edge.get("manual_breaker", False),
            "auto_cable": not st["manual_cable"],
            "auto_breaker": not edge.get("manual_breaker", False),
            "ok": len(violations) == 0,
            "violations": violations,
            "phase": st["phase"],
            "u_nom_v": st["u_edge"],
            "constructions": st["constructions"],
        })

    node_graph_updates: list[dict] = []

    for nid, load in loads.items():
        node = _node_map(nodes)[nid]
        nr = {
            "label": node.get("label", nid),
            "node_type": node.get("node_type"),
            "p_kw": round(load["p_kw"], 2),
            "i_a": round(load["i_a"], 2),
        }
        if node.get("node_type") == "transformer_substation":
            tp = resolve_tp_electrical(node)
            nr["z_source_mohm"] = tp["z_mohm"]
            nr["s_kva"] = tp["s_kva"]
            nr["transformer_count"] = tp["transformer_count"]
            count = int(tp["transformer_count"])
            if count > 1:
                nr["s_kva_total"] = round(float(tp["s_kva"]) * count, 1)
        if node.get("node_type") == "vru":
            nr["vru_sections"] = load.get("vru_sections", [])
            nr["vru_merged"] = load.get("vru_merged", False)
            nr["vru_section_breakers"] = vru_section_breakers_by_node.get(nid, [])
        nb = breaker_by_node.get(nid)
        if nb:
            nr["breaker_id"] = nb.id
            nr["breaker_in_a"] = nb.in_a
            nr["breaker"] = f"{nb.manufacturer} {nb.model_name}"
            nr["selectivity_ok"] = selectivity_by_node.get(nid, True)
            graph_upd: dict[str, Any] = {
                "id": nid,
                "breaker_id": nb.id,
                "breaker_in_a": nb.in_a,
                "selectivity_ok": selectivity_by_node.get(nid, True),
            }
            if node.get("node_type") == "vru":
                graph_upd["vru_sections"] = load.get("vru_sections", [])
                graph_upd["vru_section_breakers"] = vru_section_breakers_by_node.get(nid, [])
            node_graph_updates.append(graph_upd)
        elif nid in breaker_by_node:
            nr["selectivity_ok"] = True
        node_results[nid] = nr

    breaker_results: list[dict] = []
    board_nodes_display = sorted(
        [n for n in nodes if n.get("node_type") in INPUT_BREAKER_NODE_TYPES],
        key=lambda n: NODE_TYPE_RANK.get(n.get("node_type", ""), 50),
    )
    for node in board_nodes_display:
        nid = node["id"]
        b = breaker_by_node.get(nid)
        if not b:
            continue
        load = loads.get(nid, {})
        breaker_results.append({
            "id": f"node-{nid}",
            "placement": "input",
            "location": _node_display_label(nodes, nid),
            "node_id": nid,
            "breaker": f"{b.manufacturer} {b.model_name}",
            "breaker_in_a": b.in_a,
            "breaker_id": b.id,
            "i_a": round(float(load.get("i_a", 0)), 2),
            "selectivity_ok": selectivity_by_node.get(nid, True),
        })

    for edge in edge_order:
        st = edge_state.get(edge["id"])
        if not st:
            continue
        if nm.get(st["dst"], {}).get("node_type") != "load":
            continue
        b = breaker_by_edge.get(edge["id"])
        if not b:
            continue
        breaker_results.append({
            "id": f"edge-{edge['id']}",
            "placement": "feeder",
            "location": (
                f"{_node_display_label(nodes, st['src'])} → "
                f"{_node_display_label(nodes, st['dst'])}"
            ),
            "edge_id": edge.get("id"),
            "breaker": f"{b.manufacturer} {b.model_name}",
            "breaker_in_a": b.in_a,
            "breaker_id": b.id,
            "i_a": round(st["total_i"], 2),
            "selectivity_ok": True,
        })

    return {
        "nodes": node_results,
        "edges": edge_results,
        "breakers": breaker_results,
        "warnings": warnings,
        "graph_updates": graph_updates,
        "node_graph_updates": node_graph_updates,
        "summary": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "warnings_count": len(warnings),
            "u_nom_v": u_nom_v,
            "z_source_mohm": z_source_mohm,
        },
    }


def _find_cable_id(section: float, brand: str = "ВВГнг(A)-LS", construction: str = "3x") -> int | None:
    try:
        c = Cable.objects.filter(
            brand__name=brand, section_mm2=section, construction=construction, material="Cu"
        ).first()
        return c.id if c else None
    except Exception:
        return None


def _find_armored_cable_id(section: float, brand: str = "ВБбШв", construction: str = "4x") -> int | None:
    try:
        c = Cable.objects.filter(
            brand__name=brand, section_mm2=section, construction=construction, material="Cu"
        ).first()
        return c.id if c else None
    except Exception:
        return None


def _find_breaker_id(manufacturer: str, in_a: float, poles: int = 1, curve: str = "C") -> int | None:
    try:
        b = CircuitBreaker.objects.filter(
            manufacturer=manufacturer, in_a=in_a, poles=poles, curve=curve, category="household"
        ).first()
        return b.id if b else None
    except Exception:
        return None


def default_mkd_template() -> dict[str, Any]:
    """Шаблон МКД: ТП → ВРУ → ЩС → нагрузка."""
    defs = get_system_defaults()
    tp = defs["node_defaults"]["transformer_substation"]
    vru_def = defs["node_defaults"]["vru"]
    vru_in, vru_out = vru_ports(vru_def.get("vru_scheme", "1in_2out"))

    c16 = _find_armored_cable_id(16, construction="4x")
    c10 = _find_cable_id(10, construction="5x")
    c25 = _find_cable_id(2.5, construction="3x")
    b16 = _find_breaker_id("IEK", 16, 1)

    return {
        "nodes": [
            {
                "id": "tp1",
                "type": "custom",
                "position": {"x": -120, "y": 200},
                "data": {
                    **tp,
                    "label": "ТП",
                    "output_ports": tp_output_ports(tp.get("transformer_count", 1)),
                    "input_ports": [],
                },
            },
            {
                "id": "vru",
                "type": "custom",
                "position": {"x": 150, "y": 200},
                "data": {
                    **vru_def,
                    "label": "ВРУ",
                    "input_ports": vru_in,
                    "output_ports": vru_out,
                },
            },
            {
                "id": "rs1",
                "type": "custom",
                "position": {"x": 450, "y": 200},
                "data": {
                    "label": "ЩС",
                    "node_type": "distribution_board",
                    "kc": 0.9,
                    "cos_phi": 0.95,
                    "phase": "3",
                    "input_ports": [{"id": "in-0"}],
                    "output_ports": [{"id": "out-0"}],
                },
            },
            {
                "id": "load1",
                "type": "custom",
                "position": {"x": 750, "y": 200},
                "data": {
                    "label": "Нагрузка",
                    "node_type": "load",
                    "p_kw": 5.0,
                    "cos_phi": 0.92,
                    "kc": 1.0,
                    "phase": "1",
                    "input_ports": [{"id": "in-0"}],
                    "output_ports": [],
                },
            },
        ],
        "edges": [
            {
                "id": "e-tp-vru",
                "source": "tp1",
                "target": "vru",
                "sourceHandle": "out-0",
                "targetHandle": "in-0",
                "data": {"length_m": 5, "cable_id": c16, "section_mm2": 16},
            },
            {
                "id": "e-vru-rs1",
                "source": "vru",
                "target": "rs1",
                "sourceHandle": "out-0",
                "targetHandle": "in-0",
                "data": {"length_m": 15, "cable_id": c10, "section_mm2": 10},
            },
            {
                "id": "e-rs1-load1",
                "source": "rs1",
                "target": "load1",
                "sourceHandle": "out-0",
                "targetHandle": "in-0",
                "data": {"length_m": 25, "cable_id": c25, "section_mm2": 2.5, "breaker_id": b16},
            },
        ],
        "defaults": defs,
    }

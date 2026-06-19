"""Автоподбор кабеля и аппарата защиты для участков схемы."""

from __future__ import annotations

import math

from catalog.models import Cable, CircuitBreaker
from electrical.engine import calc_voltage_drop

DELTA_U_LIMIT = 5.0
DEFAULT_BRAND = "ВВГнг(A)-LS"
ARMORED_DEFAULT_BRAND = "ВБбШв"
ARMORED_BRANDS = (
    "ВБбШв",
    "АВБбШв",
    "ВБбШвнг(A)-LS",
    "АВБбШвнг(A)-LS",
    "ВБШв",
    "АВБШв",
)
STANDARD_IN = (6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250)

# Порядок от источника к нагрузке: ТП → ВРУ → ЩС → нагрузка
NODE_TYPE_RANK: dict[str, int] = {
    "transformer_substation": 0,
    "vru": 1,
    "distribution_board": 2,
    "group_board": 3,
    "load": 4,
}


def normalize_edge_directions(
    nodes: list[dict],
    edges: list[dict],
) -> tuple[list[dict], list[str]]:
    """Развернуть рёбра, нарисованные от нагрузки к источнику."""
    nm = {n["id"]: n for n in nodes}
    normalized: list[dict] = []
    warnings: list[str] = []

    for edge in edges:
        src, dst = edge["from"], edge["to"]
        src_type = nm.get(src, {}).get("node_type", "load")
        dst_type = nm.get(dst, {}).get("node_type", "load")
        src_rank = NODE_TYPE_RANK.get(src_type, 50)
        dst_rank = NODE_TYPE_RANK.get(dst_type, 50)

        new_edge = dict(edge)
        if src_rank > dst_rank:
            new_edge["from"] = dst
            new_edge["to"] = src
            warnings.append(
                f"Линия {_edge_label(nm, src, dst)} развёрнута: "
                f"направление питания ТП → ВРУ → ЩС → нагрузка"
            )
        normalized.append(new_edge)

    return normalized, warnings


def _edge_label(nm: dict[str, dict], src: str, dst: str) -> str:
    a = nm.get(src, {}).get("label", src)
    b = nm.get(dst, {}).get("label", dst)
    return f"{a} → {b}"


def parallel_edge_groups(edges: list[dict]) -> dict[tuple[str, str], int]:
    """Число параллельных линий между одной парой узлов (спаренные кабели)."""
    groups: dict[tuple[str, str], int] = {}
    for e in edges:
        key = (e["from"], e["to"])
        groups[key] = groups.get(key, 0) + 1
    return groups


def subtree_load_nodes(
    start_id: str,
    node_map: dict[str, dict],
    children: dict[str, list[str]],
) -> list[dict]:
    """Все узлы-нагрузки в поддереве, начиная с start_id."""
    result: list[dict] = []
    stack = [start_id]
    seen: set[str] = set()
    while stack:
        nid = stack.pop()
        if nid in seen:
            continue
        seen.add(nid)
        node = node_map.get(nid, {})
        if node.get("node_type") == "load":
            result.append(node)
        for cid in children.get(nid, []):
            stack.append(cid)
    return result


def edge_electrical_params(
    src_node: dict,
    subtree_loads: list[dict],
    global_u: float,
) -> tuple[str, float]:
    """Фазность и Uном участка по источнику и нагрузкам в поддереве."""
    src_type = src_node.get("node_type", "")
    has_3ph = any(n.get("phase") == "3" for n in subtree_loads)

    if src_type in ("transformer_substation", "vru") or has_3ph:
        voltages = [
            float(n.get("u_nom_v") or 400)
            for n in subtree_loads
            if n.get("phase") == "3"
        ]
        return "3", max(voltages) if voltages else global_u

    voltages = [float(n.get("u_nom_v") or 230) for n in subtree_loads]
    return "1", max(voltages) if voltages else 230.0


def allowed_constructions(
    src_node: dict,
    subtree_loads: list[dict],
    armored: bool,
    manual: bool,
) -> list[str]:
    """
    Допустимые исполнения кабеля для участка (от источника к нагрузке).
    """
    src_type = src_node.get("node_type", "")
    has_3ph = any(n.get("phase") == "3" for n in subtree_loads)
    has_1ph = any(n.get("phase") == "1" for n in subtree_loads)

    if armored:
        return ["4x", "5x"] if manual else ["4x"]

    if src_type == "vru":
        return ["4x", "5x"] if manual else ["5x"]

    if src_type in ("distribution_board", "group_board") and has_1ph and not has_3ph:
        return ["2x", "3x"] if manual else ["3x"]

    if has_1ph and not has_3ph:
        return ["2x", "3x"] if manual else ["3x"]

    if has_3ph:
        return ["4x", "5x"] if manual else ["4x"]

    return ["4x", "5x"] if manual else ["5x"]


def _next_standard_in(current_a: float, factor: float = 1.05) -> float:
    required = current_a * factor
    for rating in STANDARD_IN:
        if rating >= required:
            return float(rating)
    return float(STANDARD_IN[-1])


def _in_for_selectivity(current_a: float, max_downstream_in: float) -> float:
    """In вышестоящего автомата: больше расчётного и строго больше нижестоящих."""
    target = _next_standard_in(current_a)
    if max_downstream_in <= 0:
        return target
    for rating in STANDARD_IN:
        if rating > max_downstream_in and rating >= target:
            return float(rating)
    return float(STANDARD_IN[-1])


def _cable_queryset(
    material: str,
    constructions: list[str],
    armored: bool,
    brand: str | None,
) -> list[Cable]:
    qs = (
        Cable.objects.filter(material=material, construction__in=constructions)
        .select_related("brand")
        .order_by("section_mm2")
    )
    if armored:
        qs = qs.filter(brand__name__in=ARMORED_BRANDS)
    elif brand:
        qs = qs.filter(brand__name=brand)
    else:
        qs = qs.filter(brand__name=DEFAULT_BRAND)

    cables = list(qs)
    if cables:
        return cables

    fallback = (
        Cable.objects.filter(material=material, construction__in=constructions)
        .select_related("brand")
        .order_by("section_mm2")
    )
    if armored:
        fallback = fallback.filter(brand__name__in=ARMORED_BRANDS)
    return list(fallback)


def select_cable_optimal(
    current_a: float,
    length_m: float,
    cos_phi: float,
    phase: str,
    u_nom_v: float,
    constructions: list[str],
    material: str = "Cu",
    brand: str | None = None,
    armored: bool = False,
    min_section_mm2: float = 0,
) -> Cable | None:
    if armored:
        brand = brand or ARMORED_DEFAULT_BRAND
    else:
        brand = brand or DEFAULT_BRAND

    cables = _cable_queryset(material, constructions, armored, brand)

    best_by_current: Cable | None = None
    for c in cables:
        if c.section_mm2 < min_section_mm2:
            continue
        if c.i_long_a < current_a:
            continue
        if best_by_current is None:
            best_by_current = c
        du = calc_voltage_drop(
            length_m, current_a, c.r_mohm_per_m, c.x_mohm_per_m, cos_phi, phase, u_nom_v
        )
        if du.delta_u_percent <= DELTA_U_LIMIT:
            return c

    if best_by_current and best_by_current.section_mm2 >= min_section_mm2:
        return best_by_current

    for c in cables:
        if c.section_mm2 >= min_section_mm2 and c.i_long_a >= current_a:
            return c
    return best_by_current


def select_breaker_optimal(
    current_a: float,
    ik_ka: float,
    phase: str,
    max_downstream_in: float = 0,
    curve: str = "C",
) -> CircuitBreaker | None:
    poles = 3 if phase == "3" else 1
    target_in = _in_for_selectivity(current_a, max_downstream_in)

    breaker = (
        CircuitBreaker.objects.filter(
            poles=poles,
            curve=curve,
            in_a__gte=target_in,
            icu_ka__gte=ik_ka,
            breaker_type="MCB",
        )
        .order_by("in_a", "icu_ka")
        .first()
    )
    if breaker:
        return breaker

    return (
        CircuitBreaker.objects.filter(poles=poles, in_a__gte=target_in, icu_ka__gte=ik_ka)
        .order_by("in_a", "icu_ka")
        .first()
    )


def validate_cable(
    cable: Cable,
    current_a: float,
    length_m: float,
    cos_phi: float,
    phase: str,
    u_nom_v: float,
    allowed_constructions: list[str] | None = None,
    min_section_mm2: float = 0,
) -> list[str]:
    issues: list[str] = []
    if allowed_constructions and cable.construction not in allowed_constructions:
        issues.append(
            f"Исполнение {cable.construction} не подходит для участка "
            f"(допустимо: {', '.join(allowed_constructions)})"
        )
    if cable.section_mm2 < min_section_mm2:
        issues.append(
            f"S={cable.section_mm2:g} мм² < требуемого {min_section_mm2:g} мм² (нижестоящая линия)"
        )
    if cable.i_long_a < current_a:
        issues.append(f"Iд={cable.i_long_a:g}А < Iрасч={current_a:.1f}А")
    du = calc_voltage_drop(
        length_m, current_a, cable.r_mohm_per_m, cable.x_mohm_per_m, cos_phi, phase, u_nom_v
    )
    if du.delta_u_percent > DELTA_U_LIMIT:
        issues.append(f"ΔU={du.delta_u_percent:.2f}% > {DELTA_U_LIMIT}%")
    return issues


def validate_breaker(
    breaker: CircuitBreaker,
    current_a: float,
    ik_ka: float,
    max_downstream_in: float = 0,
) -> list[str]:
    issues: list[str] = []
    if breaker.in_a < current_a:
        issues.append(f"In={breaker.in_a:g}А < Iрасч={current_a:.1f}А")
    if breaker.icu_ka < ik_ka:
        issues.append(f"Icu={breaker.icu_ka:g}кА < Ik={ik_ka:.2f}кА")
    if max_downstream_in > 0 and breaker.in_a <= max_downstream_in:
        issues.append(
            f"Нет селективности: In={breaker.in_a:g}А ≤ In нижестоящего={max_downstream_in:g}А"
        )
    return issues


def line_z_mohm(cable: Cable, length_m: float) -> float:
    r = cable.r_mohm_per_m * length_m
    x = cable.x_mohm_per_m * length_m
    return math.sqrt(r * r + x * x)


def edge_processing_order(nodes: list[dict], edges: list[dict]) -> list[dict]:
    """Порядок обработки рёбер от ТП/источника к нагрузкам."""
    children: dict[str, list[str]] = {}
    for e in edges:
        children.setdefault(e["from"], []).append(e["to"])

    roots = [n["id"] for n in nodes if n.get("node_type") == "transformer_substation"]
    if not roots:
        incoming = {e["to"] for e in edges}
        roots = [n["id"] for n in nodes if n["id"] not in incoming]

    order: list[dict] = []
    queue = list(roots)
    visited: set[str] = set()
    edge_by_from: dict[str, list[dict]] = {}
    for e in edges:
        edge_by_from.setdefault(e["from"], []).append(e)

    while queue:
        nid = queue.pop(0)
        if nid in visited:
            continue
        visited.add(nid)
        for edge in edge_by_from.get(nid, []):
            order.append(edge)
            queue.append(edge["to"])

    seen_ids = {e["id"] for e in order}
    for e in edges:
        if e["id"] not in seen_ids:
            order.append(e)
    return order

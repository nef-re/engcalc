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


from electrical.defaults import load_voltage_from_tp


def edge_electrical_params(
    src_node: dict,
    subtree_loads: list[dict],
    global_u: float,
) -> tuple[str, float]:
    """Фазность и Uном участка: U2 ТП + фазность нагрузок в поддереве."""
    src_type = src_node.get("node_type", "")
    has_3ph = any(n.get("phase") == "3" for n in subtree_loads)

    if src_type in ("transformer_substation", "vru") or has_3ph:
        return "3", global_u

    return "1", load_voltage_from_tp(global_u, "1")


def allowed_constructions(
    src_node: dict,
    subtree_loads: list[dict],
    armored: bool,
    manual: bool,
) -> list[str]:
    """
    Допустимые исполнения кабеля (направление: от ТП к нагрузке).
    3Ф: ТП→ВРУ — 4× (броня); от ВРУ до нагрузки — 5×.
    1Ф (только однофазные нагрузки в ветке): 3×.
    """
    has_3ph = any(n.get("phase") == "3" for n in subtree_loads)
    has_1ph = any(n.get("phase") == "1" for n in subtree_loads)

    if armored:
        return ["4x", "5x"] if manual else ["4x"]

    if has_3ph:
        return ["4x", "5x"] if manual else ["5x"]

    if has_1ph and not has_3ph:
        return ["2x", "3x"] if manual else ["3x"]

    return ["4x", "5x"] if manual else ["5x"]


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
    required_i = current_a

    best_by_current: Cable | None = None
    best_meeting_du: Cable | None = None

    for c in cables:
        if c.section_mm2 < min_section_mm2:
            continue
        if c.i_long_a < required_i:
            continue
        if best_by_current is None or c.section_mm2 < best_by_current.section_mm2:
            best_by_current = c
        du = calc_voltage_drop(
            length_m, current_a, c.r_mohm_per_m, c.x_mohm_per_m, cos_phi, phase, u_nom_v
        )
        if du.delta_u_percent <= DELTA_U_LIMIT:
            if best_meeting_du is None or c.section_mm2 < best_meeting_du.section_mm2:
                best_meeting_du = c

    if best_meeting_du:
        return best_meeting_du

    return best_by_current


def _min_breaker_in(current_a: float) -> float:
    """Минимальный стандартный In ≥ расчётного тока нагрузки."""
    for rating in STANDARD_IN:
        if rating >= current_a:
            return float(rating)
    return float(STANDARD_IN[-1])


def _breaker_in_candidates(
    current_a: float,
    max_downstream_in: float,
    cable_i_long_a: float,
) -> list[float]:
    """Допустимые In: ≥ расчётного тока, ≤ Iд кабеля, селективность к нижестоящим."""
    min_in = _min_breaker_in(current_a)
    max_in = cable_i_long_a if cable_i_long_a > 0 else float(STANDARD_IN[-1])

    candidates: list[float] = []
    for rating in STANDARD_IN:
        if rating < min_in:
            continue
        if rating > max_in:
            break
        if max_downstream_in > 0 and rating <= max_downstream_in:
            continue
        candidates.append(float(rating))
    return candidates


def select_breaker_optimal(
    current_a: float,
    ik_ka: float,
    phase: str,
    max_downstream_in: float = 0,
    cable_i_long_a: float = 0,
    curve: str = "C",
) -> CircuitBreaker | None:
    """
    Подбор автомата после выбора кабеля: In защищает линию (In ≤ Iд),
    не меньше расчётного тока, с селективностью к нижестоящим (In > In↓).
    """
    poles = 3 if phase == "3" else 1
    for target_in in _breaker_in_candidates(current_a, max_downstream_in, cable_i_long_a):
        breaker = (
            CircuitBreaker.objects.filter(
                poles=poles,
                curve=curve,
                in_a=target_in,
                icu_ka__gte=ik_ka,
                breaker_type="MCB",
            )
            .order_by("icu_ka")
            .first()
        )
        if breaker:
            return breaker

    # Запасной вариант без фильтра MCB / Icu
    for target_in in _breaker_in_candidates(current_a, max_downstream_in, cable_i_long_a):
        breaker = (
            CircuitBreaker.objects.filter(poles=poles, in_a=target_in, icu_ka__gte=ik_ka)
            .order_by("icu_ka")
            .first()
        )
        if breaker:
            return breaker

    return None


def select_breaker_for_line(
    current_a: float,
    ik_ka: float,
    phase: str,
    cable_i_long_a: float = 0,
    max_downstream_in: float = 0,
) -> tuple[CircuitBreaker | None, bool]:
    """
    Подбор автомата для защиты линии/ввода.
    Возвращает (автомат, селективность_соблюдена).
    При нарушении селективности автомат всё равно подбирается (In ≤ Iд, In ≥ Iрасч).
    """
    breaker = select_breaker_optimal(
        current_a,
        ik_ka,
        phase,
        max_downstream_in=max_downstream_in,
        cable_i_long_a=cable_i_long_a,
    )
    if breaker:
        selective = max_downstream_in <= 0 or float(breaker.in_a) > max_downstream_in
        return breaker, selective

    breaker = select_breaker_optimal(
        current_a,
        ik_ka,
        phase,
        max_downstream_in=0,
        cable_i_long_a=cable_i_long_a,
    )
    if breaker:
        return breaker, False
    return None, False


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
    cable_i_long_a: float = 0,
) -> list[str]:
    issues: list[str] = []
    if breaker.in_a < current_a:
        issues.append(f"In={breaker.in_a:g}А < Iрасч={current_a:.1f}А")
    if cable_i_long_a > 0 and breaker.in_a > cable_i_long_a:
        issues.append(
            f"In={breaker.in_a:g}А > Iд={cable_i_long_a:g}А кабеля (автомат не защищает линию)"
        )
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

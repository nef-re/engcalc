"""Нормативные значения по умолчанию для узлов схемы."""

from __future__ import annotations

# Типовая ТП 10/0,4 кВ для МКД — из каталога ТМГ-630/10
DEFAULT_TRANSFORMER_NAME = "ТМГ-630/10"

DEFAULT_TRANSFORMER = {
    "s_kva": 630.0,
    "uk_percent": 6.0,
    "u_primary_kv": 10.0,
    "u_secondary_v": 400.0,
    "transformer_id": None,
    "transformer_count": 1,
}

TP_LINE_VOLTAGE_OPTIONS = (380.0, 400.0)
DEFAULT_TP_LINE_VOLTAGE = 400.0


def normalize_tp_line_voltage(u: float) -> float:
    """Линейное напряжение на шинах ТП: 380 или 400 В."""
    return 400.0 if u >= 390 else 380.0


def load_voltage_from_tp(u_secondary_v: float, phase: str) -> float:
    """U для расчёта нагрузки по фазности и U2 ТП."""
    line = normalize_tp_line_voltage(u_secondary_v)
    if phase == "3":
        return line
    return 230.0 if line >= 390 else 220.0

DEFAULT_EDGE = {
    "length_m": 15,
    "cable_id": 3,
    "breaker_id": 1,
}

NODE_TYPE_LABELS: dict[str, str] = {
    "transformer_substation": "ТП",
    "vru": "ВРУ",
    "distribution_board": "ЩС",
    "group_board": "ГЩ",
    "load": "Нагрузка",
}

NODE_DEFAULTS: dict[str, dict] = {
    "transformer_substation": {
        "label": "ТП",
        "node_type": "transformer_substation",
        "kc": 1.0,
        "cos_phi": 0.95,
        "phase": "3",
        **DEFAULT_TRANSFORMER,
    },
    "vru": {
        "label": "ВРУ",
        "node_type": "vru",
        "kc": 1.0,
        "cos_phi": 0.95,
        "phase": "3",
        "vru_scheme": "1in_2out",
        "vru_section_switch": "open",
        "vru_operating_mode": "normal",
        "vru_tap_in0": False,
        "vru_tap_in1": False,
    },
    "distribution_board": {
        "label": "ЩС",
        "node_type": "distribution_board",
        "kc": 0.9,
        "cos_phi": 0.95,
        "phase": "3",
    },
    "group_board": {
        "label": "ГЩ",
        "node_type": "group_board",
        "kc": 0.8,
        "cos_phi": 0.95,
        "phase": "1",
    },
    "load": {
        "label": "Нагрузка",
        "node_type": "load",
        "p_kw": 5.0,
        "cos_phi": 0.92,
        "kc": 1.0,
        "phase": "1",
    },
}


def calc_transformer_z_mohm(s_kva: float, uk_percent: float, u_secondary_v: float = 400) -> float:
    """Zт на стороне НН, мОм (упрощённо по Uk)."""
    if s_kva <= 0:
        return 10.0
    s_va = s_kva * 1000
    z_ohm = (uk_percent / 100) * (u_secondary_v**2) / s_va
    return round(z_ohm * 1000, 3)


def tp_output_ports(count: int) -> list[dict[str, str]]:
    """Порты отходящих линий ТП: по одному на каждый трансформатор."""
    n = 2 if int(count or 1) >= 2 else 1
    return [{"id": f"out-{i}"} for i in range(n)]


def resolve_tp_electrical(node: dict, transformer: object | None = None) -> dict[str, float | int]:
    """Параметры одного трансформатора ТП для расчёта (S, Uk, U2, Z)."""
    s_kva = float(node.get("s_kva") or DEFAULT_TRANSFORMER["s_kva"])
    uk = float(node.get("uk_percent") or DEFAULT_TRANSFORMER["uk_percent"])
    u2 = float(node.get("u_secondary_v") or DEFAULT_TP_LINE_VOLTAGE)
    count = int(node.get("transformer_count") or DEFAULT_TRANSFORMER["transformer_count"])

    tid = node.get("transformer_id")
    if tid and transformer is not None:
        s_kva = float(transformer.s_kva)
        uk = float(transformer.uk_percent)
        u2 = float(transformer.u_secondary_v)
    elif tid:
        from catalog.models import Transformer

        try:
            tr = Transformer.objects.get(pk=tid)
            s_kva = float(tr.s_kva)
            uk = float(tr.uk_percent)
            u2 = float(tr.u_secondary_v)
        except Transformer.DoesNotExist:
            pass

    z_manual = node.get("z_source_mohm")
    if z_manual is not None and z_manual != "":
        z = float(z_manual)
    else:
        z = calc_transformer_z_mohm(s_kva, uk, u2)

    return {
        "s_kva": s_kva,
        "uk_percent": uk,
        "u_secondary_v": u2,
        "transformer_count": count,
        "z_mohm": z,
    }


def _default_transformer_params() -> dict:
    """Типовой трансформатор из каталога или запасные значения."""
    from catalog.models import Transformer

    try:
        tr = Transformer.objects.get(name=DEFAULT_TRANSFORMER_NAME)
        return {
            "s_kva": tr.s_kva,
            "uk_percent": tr.uk_percent,
            "u_primary_kv": tr.u_primary_kv,
            "u_secondary_v": tr.u_secondary_v,
            "transformer_id": tr.pk,
            "transformer_count": 1,
        }
    except Transformer.DoesNotExist:
        return dict(DEFAULT_TRANSFORMER)


def get_system_defaults() -> dict:
    transformer = _default_transformer_params()
    node_defaults = {
        **NODE_DEFAULTS,
        "transformer_substation": {
            **NODE_DEFAULTS["transformer_substation"],
            **transformer,
        },
    }
    z = calc_transformer_z_mohm(
        transformer["s_kva"],
        transformer["uk_percent"],
        transformer["u_secondary_v"],
    )
    return {
        "transformer": transformer,
        "z_source_mohm": z,
        "u_nom_v": transformer["u_secondary_v"],
        "edge": DEFAULT_EDGE,
        "node_defaults": node_defaults,
    }

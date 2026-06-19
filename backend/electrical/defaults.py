"""Нормативные значения по умолчанию для узлов схемы."""

from __future__ import annotations

# Типовая ТП 10/0,4 кВ для МКД (630 кВА) — ПУЭ / типовые решения
DEFAULT_TRANSFORMER = {
    "s_kva": 630.0,
    "uk_percent": 6.0,
    "u_primary_kv": 10.0,
    "u_secondary_v": 400.0,
    "transformer_id": 1,
}

DEFAULT_EDGE = {
    "length_m": 15,
    "cable_id": 3,
    "breaker_id": 1,
}

NODE_TYPE_LABELS: dict[str, str] = {
    "transformer_substation": "ТП",
    "vru": "ВРУ/ГРЩ",
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
        "label": "ВРУ/ГРЩ",
        "node_type": "vru",
        "kc": 1.0,
        "cos_phi": 0.95,
        "phase": "3",
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
        "u_nom_v": 230,
    },
}


def calc_transformer_z_mohm(s_kva: float, uk_percent: float, u_secondary_v: float = 400) -> float:
    """Zт на стороне НН, мОм (упрощённо по Uk)."""
    if s_kva <= 0:
        return 10.0
    s_va = s_kva * 1000
    z_ohm = (uk_percent / 100) * (u_secondary_v**2) / s_va
    return round(z_ohm * 1000, 3)


def get_system_defaults() -> dict:
    z = calc_transformer_z_mohm(
        DEFAULT_TRANSFORMER["s_kva"],
        DEFAULT_TRANSFORMER["uk_percent"],
        DEFAULT_TRANSFORMER["u_secondary_v"],
    )
    return {
        "transformer": DEFAULT_TRANSFORMER,
        "z_source_mohm": z,
        "u_nom_v": DEFAULT_TRANSFORMER["u_secondary_v"],
        "edge": DEFAULT_EDGE,
        "node_defaults": NODE_DEFAULTS,
    }

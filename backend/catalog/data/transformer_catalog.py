"""Типовые силовые трансформаторы 6/0,4 и 10/0,4 кВ до 2500 кВА (серия ТМГ)."""

from __future__ import annotations

# Стандартный ряд мощностей по ГОСТ / типовым решениям до 2500 кВА
STANDARD_KVA: tuple[float, ...] = (
    25, 40, 63, 100, 160, 250, 400, 630, 1000, 1250, 1600, 2000, 2500,
)

PRIMARY_KV: tuple[float, ...] = (6.0, 10.0)

# Номинальное линейное напряжение НН, В (0,4 кВ)
SECONDARY_V = 400.0


def uk_percent_for_power(s_kva: float) -> float:
    """Типовое Uk, % по мощности (упрощённо по данным ТМГ)."""
    if s_kva <= 160:
        return 4.5
    if s_kva <= 400:
        return 5.5
    if s_kva <= 1000:
        return 6.0
    if s_kva <= 1600:
        return 6.5
    return 7.0


def generate_transformers() -> list[dict]:
    items: list[dict] = []
    for u1 in PRIMARY_KV:
        u1_label = int(u1)
        for s in STANDARD_KVA:
            s_label = int(s) if s == int(s) else s
            items.append(
                {
                    "name": f"ТМГ-{s_label}/{u1_label}",
                    "s_kva": float(s),
                    "u_primary_kv": u1,
                    "u_secondary_v": SECONDARY_V,
                    "uk_percent": uk_percent_for_power(s),
                }
            )
    return items

"""Чистые функции расчёта электрики (ПУЭ 7, 0.4 кВ)."""

import math
from dataclasses import dataclass
from typing import Literal

PhaseMode = Literal["1", "3"]


@dataclass
class LoadResult:
    p_kw: float
    q_kvar: float
    s_kva: float
    i_a: float


@dataclass
class VoltageDropResult:
    delta_u_v: float
    delta_u_percent: float
    r_line_mohm: float
    x_line_mohm: float


@dataclass
class ShortCircuitResult:
    ik_a: float
    z_total_mohm: float
    r_total_mohm: float
    x_total_mohm: float


def calc_load(
    p_kw: float,
    cos_phi: float,
    kc: float = 1.0,
    phase: PhaseMode = "3",
    u_nom_v: float = 400,
) -> LoadResult:
    p = p_kw * kc
    phi = math.acos(min(max(cos_phi, 0.01), 1.0))
    q = p * math.tan(phi)
    s = p / cos_phi if cos_phi else p
    if phase == "1":
        u = u_nom_v / math.sqrt(3) if u_nom_v > 300 else u_nom_v
        i = (p * 1000) / (u * cos_phi) if cos_phi else 0
    else:
        i = (p * 1000) / (math.sqrt(3) * u_nom_v * cos_phi) if cos_phi else 0
    return LoadResult(p_kw=p, q_kvar=q, s_kva=s, i_a=i)


def calc_voltage_drop(
    length_m: float,
    current_a: float,
    r_mohm_per_m: float,
    x_mohm_per_m: float,
    cos_phi: float,
    phase: PhaseMode = "3",
    u_nom_v: float = 400,
) -> VoltageDropResult:
    sin_phi = math.sqrt(max(0, 1 - cos_phi**2))
    r_line = r_mohm_per_m * length_m
    x_line = x_mohm_per_m * length_m
    z_component = r_line * cos_phi + x_line * sin_phi

    if phase == "1":
        u_phase = u_nom_v if u_nom_v <= 300 else u_nom_v / math.sqrt(3)
        delta_u_mohm = 2 * current_a * z_component
        delta_u_v = delta_u_mohm / 1000
        delta_u_percent = (delta_u_v / u_phase) * 100 if u_phase else 0
    else:
        u_line = u_nom_v
        delta_u_mohm = math.sqrt(3) * current_a * z_component
        delta_u_v = delta_u_mohm / 1000
        delta_u_percent = (delta_u_v / u_line) * 100 if u_line else 0

    return VoltageDropResult(
        delta_u_v=delta_u_v,
        delta_u_percent=delta_u_percent,
        r_line_mohm=r_line,
        x_line_mohm=x_line,
    )


def calc_short_circuit(
    u_nom_v: float,
    z_source_mohm: float,
    length_m: float,
    r_mohm_per_m: float,
    x_mohm_per_m: float,
    phase: PhaseMode = "3",
) -> ShortCircuitResult:
    r_line = r_mohm_per_m * length_m
    x_line = x_mohm_per_m * length_m
    r_total = z_source_mohm * 0.8 + r_line  # упрощение: Zsource как модуль
    x_total = z_source_mohm * 0.6 + x_line
    z_total = math.sqrt(r_total**2 + x_total**2)

    if phase == "1":
        u = u_nom_v if u_nom_v <= 300 else u_nom_v / math.sqrt(3)
        ik = (u * 1000) / z_total if z_total else 0
    else:
        ik = (u_nom_v * 1000) / (math.sqrt(3) * z_total) if z_total else 0

    return ShortCircuitResult(
        ik_a=ik,
        z_total_mohm=z_total,
        r_total_mohm=r_total,
        x_total_mohm=x_total,
    )


def min_section_by_current(required_i_a: float, i_long_a: float, section_mm2: float) -> bool:
    return i_long_a >= required_i_a


def voltage_drop_chart(
    sections: list[float],
    r_values: list[float],
    x_values: list[float],
    length_m: float,
    current_a: float,
    cos_phi: float,
    phase: PhaseMode,
    u_nom_v: float,
) -> list[list[float]]:
    points = []
    for s, r, x in zip(sections, r_values, x_values, strict=True):
        res = calc_voltage_drop(length_m, current_a, r, x, cos_phi, phase, u_nom_v)
        points.append([s, round(res.delta_u_percent, 2)])
    return points

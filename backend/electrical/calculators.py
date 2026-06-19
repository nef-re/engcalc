from typing import Any

from catalog.models import Cable, CircuitBreaker, InstallationCondition
from catalog.display import cable_display_name
from calculators.base import BaseCalculator
from electrical.engine import (
    calc_load,
    calc_short_circuit,
    calc_voltage_drop,
    voltage_drop_chart,
)

DELTA_U_LIMIT_PERCENT = 5.0


def _get_cables(catalog: dict[str, Any] | None) -> list[Cable]:
    if catalog and "cables" in catalog:
        return catalog["cables"]
    return list(Cable.objects.select_related("brand").all())


def _get_breakers(catalog: dict[str, Any] | None) -> list[CircuitBreaker]:
    if catalog and "breakers" in catalog:
        return catalog["breakers"]
    return list(CircuitBreaker.objects.all())


class LoadCalculator(BaseCalculator):
    slug = "electrical.load"
    discipline = "electrical"
    name = "Расчёт нагрузки"
    description = "Активная мощность, cos φ, расчётный ток"
    order = 1
    standard_ref = "ПУЭ 7"

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "required": ["p_kw", "cos_phi"],
            "properties": {
                "p_kw": {"type": "number", "title": "P, кВт", "minimum": 0.01},
                "cos_phi": {"type": "number", "title": "cos φ", "minimum": 0.1, "maximum": 1, "default": 0.95},
                "kc": {"type": "number", "title": "Kc", "default": 1.0, "minimum": 0.1, "maximum": 1.5},
                "phase": {"type": "string", "title": "Фазность", "enum": ["1", "3"], "default": "3"},
                "u_nom_v": {"type": "number", "title": "Uном, В", "default": 400},
            },
        }

    def calculate(self, data: dict[str, Any], catalog: dict[str, Any] | None = None) -> dict[str, Any]:
        res = calc_load(
            p_kw=float(data["p_kw"]),
            cos_phi=float(data.get("cos_phi", 0.95)),
            kc=float(data.get("kc", 1.0)),
            phase=data.get("phase", "3"),
            u_nom_v=float(data.get("u_nom_v", 400)),
        )
        return {
            "result": {
                "p_kw": round(res.p_kw, 3),
                "q_kvar": round(res.q_kvar, 3),
                "s_kva": round(res.s_kva, 3),
                "i_a": round(res.i_a, 2),
            },
            "warnings": [],
            "recommendations": {},
            "chart": {
                "type": "pie",
                "series": [
                    {"name": "P", "value": round(res.p_kw, 2)},
                    {"name": "Q", "value": round(res.q_kvar, 2)},
                ],
            },
        }


class CableSectionCalculator(BaseCalculator):
    slug = "electrical.cable_section"
    discipline = "electrical"
    name = "Подбор сечения кабеля"
    description = "По допустимому длительному току и условиям прокладки"
    order = 2
    standard_ref = "ПУЭ 7, табл. 1.3.4"

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "required": ["current_a"],
            "properties": {
                "current_a": {"type": "number", "title": "I расч, А", "minimum": 0.1},
                "material": {"type": "string", "title": "Материал", "enum": ["Cu", "Al"], "default": "Cu"},
                "installation_id": {"type": "integer", "title": "Условие прокладки"},
            },
        }

    def calculate(self, data: dict[str, Any], catalog: dict[str, Any] | None = None) -> dict[str, Any]:
        current_a = float(data["current_a"])
        material = data.get("material", "Cu")
        k = 1.0
        if data.get("installation_id"):
            try:
                cond = InstallationCondition.objects.get(pk=data["installation_id"])
                k = cond.k_temp * cond.k_group
            except InstallationCondition.DoesNotExist:
                pass

        required_i = current_a / k if k else current_a
        cables = [c for c in _get_cables(catalog) if c.material == material and c.i_long_a >= required_i]
        cables.sort(key=lambda c: c.section_mm2)

        warnings = []
        if not cables:
            warnings.append("Нет кабеля в каталоге для заданного тока")

        selected = cables[0] if cables else None
        return {
            "result": {
                "required_i_a": round(required_i, 2),
                "selected_section_mm2": selected.section_mm2 if selected else None,
                "selected_cable": cable_display_name(selected) if selected else None,
            },
            "warnings": warnings,
            "recommendations": {
                "cables": [
                    {
                        "id": c.id,
                        "name": cable_display_name(c),
                        "section_mm2": c.section_mm2,
                        "i_long_a": c.i_long_a,
                        "brand": c.brand.name,
                    }
                    for c in cables[:10]
                ],
            },
            "chart": None,
        }


class VoltageDropCalculator(BaseCalculator):
    slug = "electrical.voltage_drop"
    discipline = "electrical"
    name = "Падение напряжения"
    description = "ΔU на участке линии"
    order = 3
    standard_ref = "ПУЭ 7, п. 1.2.20"

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "required": ["length_m", "current_a", "section_mm2"],
            "properties": {
                "length_m": {"type": "number", "title": "Длина, м", "minimum": 0.1},
                "current_a": {"type": "number", "title": "I, А", "minimum": 0.1},
                "section_mm2": {"type": "number", "title": "S, мм²", "minimum": 0.75},
                "cos_phi": {"type": "number", "title": "cos φ", "default": 0.95, "minimum": 0.1, "maximum": 1},
                "phase": {"type": "string", "title": "Фазность", "enum": ["1", "3"], "default": "3"},
                "u_nom_v": {"type": "number", "title": "Uном, В", "default": 400},
                "material": {"type": "string", "title": "Материал", "enum": ["Cu", "Al"], "default": "Cu"},
            },
        }

    def calculate(self, data: dict[str, Any], catalog: dict[str, Any] | None = None) -> dict[str, Any]:
        length_m = float(data["length_m"])
        current_a = float(data["current_a"])
        section = float(data["section_mm2"])
        cos_phi = float(data.get("cos_phi", 0.95))
        phase = data.get("phase", "3")
        u_nom_v = float(data.get("u_nom_v", 400))
        material = data.get("material", "Cu")

        cables = [c for c in _get_cables(catalog) if c.material == material]
        cable = next((c for c in cables if abs(c.section_mm2 - section) < 0.01), None)
        if cable:
            r, x = cable.r_mohm_per_m, cable.x_mohm_per_m
        else:
            r = 18.7 / section if material == "Cu" else 31.0 / section
            x = 0.08

        res = calc_voltage_drop(length_m, current_a, r, x, cos_phi, phase, u_nom_v)

        warnings = []
        if res.delta_u_percent > DELTA_U_LIMIT_PERCENT:
            warnings.append(
                f"ΔU = {res.delta_u_percent:.2f}% превышает допустимые {DELTA_U_LIMIT_PERCENT}% (ПУЭ)"
            )

        sections = [c.section_mm2 for c in cables]
        r_vals = [c.r_mohm_per_m for c in cables]
        x_vals = [c.x_mohm_per_m for c in cables]
        chart_points = voltage_drop_chart(
            sections, r_vals, x_vals, length_m, current_a, cos_phi, phase, u_nom_v
        )

        suitable = [
            c
            for c in cables
            if calc_voltage_drop(length_m, current_a, c.r_mohm_per_m, c.x_mohm_per_m, cos_phi, phase, u_nom_v).delta_u_percent
            <= DELTA_U_LIMIT_PERCENT
            and c.i_long_a >= current_a
        ]

        return {
            "result": {
                "delta_u_v": round(res.delta_u_v, 3),
                "delta_u_percent": round(res.delta_u_percent, 2),
                "r_line_mohm": round(res.r_line_mohm, 3),
                "x_line_mohm": round(res.x_line_mohm, 3),
            },
            "warnings": warnings,
            "recommendations": {
                "cables": [
                    {
                        "id": c.id,
                        "name": cable_display_name(c),
                        "section_mm2": c.section_mm2,
                        "i_long_a": c.i_long_a,
                    }
                    for c in suitable[:10]
                ],
            },
            "chart": {
                "type": "line",
                "title": "ΔU vs S",
                "x_label": "S, мм²",
                "y_label": "ΔU, %",
                "limit_y": DELTA_U_LIMIT_PERCENT,
                "series": [{"name": "ΔU, %", "data": chart_points}],
            },
        }


class ShortCircuitCalculator(BaseCalculator):
    slug = "electrical.short_circuit"
    discipline = "electrical"
    name = "Ток короткого замыкания"
    description = "Ik на конце линии (1ф / 3ф)"
    order = 4
    standard_ref = "ПУЭ 7, гл. 1.7"

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "required": ["z_source_mohm", "length_m", "section_mm2"],
            "properties": {
                "z_source_mohm": {"type": "number", "title": "Z ист, мОм", "minimum": 0.01},
                "length_m": {"type": "number", "title": "Длина, м", "minimum": 0.1},
                "section_mm2": {"type": "number", "title": "S, мм²", "minimum": 0.75},
                "phase": {"type": "string", "title": "Фазность", "enum": ["1", "3"], "default": "3"},
                "u_nom_v": {"type": "number", "title": "Uном, В", "default": 400},
                "material": {"type": "string", "title": "Материал", "enum": ["Cu", "Al"], "default": "Cu"},
            },
        }

    def calculate(self, data: dict[str, Any], catalog: dict[str, Any] | None = None) -> dict[str, Any]:
        z_source = float(data["z_source_mohm"])
        length_m = float(data["length_m"])
        section = float(data["section_mm2"])
        phase = data.get("phase", "3")
        u_nom_v = float(data.get("u_nom_v", 400))
        material = data.get("material", "Cu")

        cables = [c for c in _get_cables(catalog) if c.material == material]
        cable = next((c for c in cables if abs(c.section_mm2 - section) < 0.01), None)
        if cable:
            r, x = cable.r_mohm_per_m, cable.x_mohm_per_m
        else:
            r = 18.7 / section if material == "Cu" else 31.0 / section
            x = 0.08

        res = calc_short_circuit(u_nom_v, z_source, length_m, r, x, phase)

        chart_points = []
        for c in cables:
            ik_res = calc_short_circuit(u_nom_v, z_source, length_m, c.r_mohm_per_m, c.x_mohm_per_m, phase)
            chart_points.append([c.section_mm2, round(ik_res.ik_a, 0)])

        warnings = []
        if res.ik_a < 100:
            warnings.append("Ток КЗ низкий — проверьте Z источника и сечение")

        return {
            "result": {
                "ik_a": round(res.ik_a, 1),
                "ik_ka": round(res.ik_a / 1000, 3),
                "z_total_mohm": round(res.z_total_mohm, 3),
            },
            "warnings": warnings,
            "recommendations": {},
            "chart": {
                "type": "line",
                "title": "Ik vs S",
                "x_label": "S, мм²",
                "y_label": "Ik, А",
                "series": [{"name": "Ik, А", "data": chart_points}],
            },
        }


class BreakerSelectionCalculator(BaseCalculator):
    slug = "electrical.breaker_selection"
    discipline = "electrical"
    name = "Подбор автомата"
    description = "In и Icu по расчётному току и Ik"
    order = 5
    standard_ref = "ПУЭ 7"

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "required": ["current_a"],
            "properties": {
                "current_a": {"type": "number", "title": "I расч, А", "minimum": 0.1},
                "ik_ka": {"type": "number", "title": "Ik, кА", "minimum": 0.1},
                "curve": {"type": "string", "title": "Кривая", "enum": ["B", "C", "D"], "default": "C"},
                "poles": {"type": "integer", "title": "Полюса", "enum": [1, 3], "default": 1},
            },
        }

    def calculate(self, data: dict[str, Any], catalog: dict[str, Any] | None = None) -> dict[str, Any]:
        current_a = float(data["current_a"])
        ik_ka = float(data.get("ik_ka", 4.5))
        curve = data.get("curve", "C")
        poles = int(data.get("poles", 1))

        breakers = [
            b
            for b in _get_breakers(catalog)
            if b.in_a >= current_a * 1.1
            and b.icu_ka >= ik_ka
            and b.curve == curve
            and b.poles == poles
        ]
        breakers.sort(key=lambda b: b.in_a)

        warnings = []
        if not breakers:
            warnings.append("Нет подходящего автомата в каталоге")

        selected = breakers[0] if breakers else None
        return {
            "result": {
                "recommended_in_a": selected.in_a if selected else None,
                "model": f"{selected.manufacturer} {selected.model_name}" if selected else None,
            },
            "warnings": warnings,
            "recommendations": {
                "breakers": [
                    {
                        "id": b.id,
                        "manufacturer": b.manufacturer,
                        "model_name": b.model_name,
                        "in_a": b.in_a,
                        "icu_ka": b.icu_ka,
                        "curve": b.curve,
                    }
                    for b in breakers[:10]
                ],
            },
            "chart": None,
        }


class SystemCalculator(BaseCalculator):
    slug = "electrical.system"
    discipline = "electrical"
    name = "Расчёт системы"
    description = "МКД: ВРУ → РЩ → ГЩ → нагрузки"
    order = 6
    standard_ref = "ПУЭ 7; ГОСТ Р 50571"

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "graph_data": {"type": "object", "title": "Схема (nodes/edges)"},
                "u_nom_v": {"type": "number", "title": "Uном, В", "default": 400},
                "z_source_mohm": {"type": "number", "title": "Z ист, мОм", "default": 10},
            },
        }

    def calculate(self, data: dict[str, Any], catalog: dict[str, Any] | None = None) -> dict[str, Any]:
        from electrical.system_engine import calculate_system, default_mkd_template

        graph = data.get("graph_data") or default_mkd_template()
        u_nom = float(data.get("u_nom_v", 400))
        z_src = float(data.get("z_source_mohm", 10))

        result = calculate_system(graph, u_nom, z_src)
        return {
            "result": result.get("summary", {}),
            "warnings": result.get("warnings", []),
            "recommendations": {},
            "chart": None,
            "system": result,
        }

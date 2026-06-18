from typing import Any

from calculators.base import BaseCalculator


class AirflowCalculator(BaseCalculator):
    slug = "ventilation.airflow"
    discipline = "ventilation"
    name = "Расход воздуха"
    description = "По кратности или числу людей (заготовка)"
    order = 1
    standard_ref = "СП 60"

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "required": ["volume_m3"],
            "properties": {
                "volume_m3": {"type": "number", "title": "Объём помещения, м³", "minimum": 1},
                "air_changes": {"type": "number", "title": "Кратность, 1/ч", "default": 3},
            },
        }

    def calculate(self, data: dict[str, Any], catalog: dict[str, Any] | None = None) -> dict[str, Any]:
        volume = float(data["volume_m3"])
        n = float(data.get("air_changes", 3))
        l_m3h = volume * n
        return {
            "result": {"airflow_m3h": round(l_m3h, 1)},
            "warnings": [],
            "recommendations": {},
            "chart": None,
        }


class DuctResistanceCalculator(BaseCalculator):
    slug = "ventilation.duct_resistance"
    discipline = "ventilation"
    name = "Сопротивление сети"
    description = "Упрощённый расчёт ΔP (заготовка)"
    order = 2
    standard_ref = "СП 60"

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "required": ["length_m", "diameter_mm", "airflow_m3h"],
            "properties": {
                "length_m": {"type": "number", "title": "Длина, м", "minimum": 0.1},
                "diameter_mm": {"type": "number", "title": "D, мм", "minimum": 50},
                "airflow_m3h": {"type": "number", "title": "L, м³/ч", "minimum": 10},
            },
        }

    def calculate(self, data: dict[str, Any], catalog: dict[str, Any] | None = None) -> dict[str, Any]:
        # Упрощённая оценка для MVP
        l = float(data["length_m"])
        d = float(data["diameter_mm"]) / 1000
        q = float(data["airflow_m3h"]) / 3600
        area = 3.14159 * (d / 2) ** 2
        v = q / area if area else 0
        dp = 0.5 * 1.2 * v**2 * (l / d) * 0.02 if d else 0
        return {
            "result": {"velocity_ms": round(v, 2), "pressure_drop_pa": round(dp, 1)},
            "warnings": [],
            "recommendations": {},
            "chart": None,
        }


class FanSelectionCalculator(BaseCalculator):
    slug = "ventilation.fan_selection"
    discipline = "ventilation"
    name = "Подбор вентилятора"
    description = "По L и ΔP из каталога (заготовка)"
    order = 3
    standard_ref = "СП 60"

    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "required": ["airflow_m3h", "pressure_pa"],
            "properties": {
                "airflow_m3h": {"type": "number", "title": "L, м³/ч", "minimum": 10},
                "pressure_pa": {"type": "number", "title": "ΔP, Па", "minimum": 10},
            },
        }

    def calculate(self, data: dict[str, Any], catalog: dict[str, Any] | None = None) -> dict[str, Any]:
        from catalog.models import Fan

        q = float(data["airflow_m3h"])
        p = float(data["pressure_pa"])
        fans = Fan.objects.filter(q_max_m3h__gte=q, p_max_pa__gte=p).order_by("q_max_m3h")[:10]
        return {
            "result": {"matched_count": fans.count()},
            "warnings": [] if fans.exists() else ["Нет вентиляторов в каталоге"],
            "recommendations": {
                "fans": [
                    {
                        "id": f.id,
                        "manufacturer": f.manufacturer,
                        "model_name": f.model_name,
                        "q_max_m3h": f.q_max_m3h,
                        "p_max_pa": f.p_max_pa,
                    }
                    for f in fans
                ],
            },
            "chart": None,
        }

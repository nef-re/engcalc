"""Справочные данные кабелей по ГОСТ РФ (без привязки к производителю)."""

from __future__ import annotations

# R при 20°C, мОм/м: ρ(Cu)=17.24, ρ(Al)=28.0 Ом·мм²/м
def r_20_cu(section: float) -> float:
    return round(17.24 / section, 3)


def r_20_al(section: float) -> float:
    return round(28.0 / section, 3)


# Допустимый длительный ток, А (ПУЭ 7, табл. 1.3.4 — воздух, Cu, многожильные)
I_LONG_CU_AIR: dict[float, int] = {
    1.5: 19, 2.5: 27, 4: 38, 6: 50, 10: 70, 16: 90, 25: 115,
    35: 140, 50: 175, 70: 215, 95: 260, 120: 300, 150: 340,
    185: 385, 240: 450, 300: 520, 400: 610,
}

# Al ~ 0.77 от Cu при той же S
I_LONG_AL_AIR: dict[float, int] = {
    s: int(v * 0.77) for s, v in I_LONG_CU_AIR.items()
}

# Наружный диаметр 3-жильных Cu (типовые по ГОСТ 31996), мм
DIAMETER_3C_CU: dict[float, tuple[float, float]] = {
    1.5: (8.8, 6.6), 2.5: (10.2, 7.7), 4: (11.7, 8.8), 6: (13.0, 9.8),
    10: (15.5, 11.6), 16: (18.0, 13.5), 25: (21.5, 16.1), 35: (24.5, 18.4),
    50: (28.0, 21.0), 70: (32.0, 24.0), 95: (37.0, 27.8), 120: (41.0, 30.8),
    150: (46.0, 34.5), 185: (51.0, 38.3), 240: (58.0, 43.5), 300: (64.0, 48.0),
    400: (72.0, 54.0),
}

SECTIONS_POWER = list(I_LONG_CU_AIR.keys())
SECTIONS_LIGHT = [1.5, 2.5, 4, 6, 10, 16]

SECTIONS_ARMORED = [4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240]

# Марки кабеля по ГОСТ (тип продукции, не производитель)
CABLE_BRANDS: list[dict] = [
    {
        "name": "ВВГнг(A)-LS",
        "gost": "ГОСТ 31996-2012",
        "description": "Не распространяет горение, пониженное дымо- и газовыделение",
        "material": "Cu",
        "sections": SECTIONS_POWER,
        "constructions": ["2x", "3x", "4x", "5x"],
        "x_mohm": 0.08,
        "u_max_v": 1000,
    },
    {
        "name": "ВВГнг(A)-FRLS",
        "gost": "ГОСТ 31996-2012",
        "description": "Огнестойкий, LS, не распространяет горение",
        "material": "Cu",
        "sections": SECTIONS_POWER,
        "constructions": ["2x", "3x", "4x", "5x"],
        "x_mohm": 0.08,
        "u_max_v": 1000,
    },
    {
        "name": "NYM",
        "gost": "ГОСТ 31996-2012",
        "description": "Силовой с ПВХ изоляцией в оболочке (аналог для внутренней прокладки)",
        "material": "Cu",
        "sections": SECTIONS_LIGHT,
        "constructions": ["2x", "3x", "4x", "5x"],
        "x_mohm": 0.08,
        "u_max_v": 660,
    },
    {
        "name": "АВВГ",
        "gost": "ГОСТ 31996-2012",
        "description": "Силовой алюминиевый с ПВХ изоляцией",
        "material": "Al",
        "sections": SECTIONS_POWER,
        "constructions": ["2x", "3x", "4x", "5x"],
        "x_mohm": 0.08,
        "u_max_v": 1000,
    },
    {
        "name": "ВБбШв",
        "gost": "ГОСТ 31996-2012",
        "description": "Силовой бронированный медный с ПВХ оболочкой",
        "material": "Cu",
        "sections": SECTIONS_ARMORED,
        "constructions": ["3x", "4x", "5x"],
        "x_mohm": 0.08,
        "u_max_v": 1000,
        "diameter_factor": 1.35,
        "category": "armored",
    },
    {
        "name": "АВБбШв",
        "gost": "ГОСТ 31996-2012",
        "description": "Силовой бронированный алюминиевый",
        "material": "Al",
        "sections": SECTIONS_ARMORED[3:],
        "constructions": ["3x", "4x", "5x"],
        "x_mohm": 0.08,
        "u_max_v": 1000,
        "diameter_factor": 1.35,
        "category": "armored",
    },
    {
        "name": "ВБбШвнг(A)-LS",
        "gost": "ГОСТ 31996-2012",
        "description": "Бронированный медный, не распространяет горение, LS",
        "material": "Cu",
        "sections": SECTIONS_ARMORED,
        "constructions": ["3x", "4x", "5x"],
        "x_mohm": 0.08,
        "u_max_v": 1000,
        "diameter_factor": 1.35,
        "category": "armored",
    },
    {
        "name": "АВБбШвнг(A)-LS",
        "gost": "ГОСТ 31996-2012",
        "description": "Бронированный алюминиевый, не распространяет горение, LS",
        "material": "Al",
        "sections": SECTIONS_ARMORED[3:],
        "constructions": ["3x", "4x", "5x"],
        "x_mohm": 0.08,
        "u_max_v": 1000,
        "diameter_factor": 1.35,
        "category": "armored",
    },
    {
        "name": "ВБШв",
        "gost": "ГОСТ 31996-2012",
        "description": "Силовой бронированный медный (стальные ленты)",
        "material": "Cu",
        "sections": SECTIONS_ARMORED,
        "constructions": ["3x", "4x", "5x"],
        "x_mohm": 0.08,
        "u_max_v": 1000,
        "diameter_factor": 1.3,
        "category": "armored",
    },
    {
        "name": "АВБШв",
        "gost": "ГОСТ 31996-2012",
        "description": "Силовой бронированный алюминиевый (стальные ленты)",
        "material": "Al",
        "sections": SECTIONS_ARMORED[3:],
        "constructions": ["3x", "4x", "5x"],
        "x_mohm": 0.08,
        "u_max_v": 1000,
        "diameter_factor": 1.3,
        "category": "armored",
    },
    {
        "name": "ВВГ-П",
        "gost": "ГОСТ 31996-2012",
        "description": "Силовой плоский",
        "material": "Cu",
        "sections": [4, 6, 10, 16, 25, 35],
        "constructions": ["3x"],
        "x_mohm": 0.08,
        "u_max_v": 1000,
        "diameter_factor": 1.5,
    },
]


def _cores_count(construction: str) -> int:
    if construction.endswith("x"):
        return int(construction[0])
    if construction == "3+1":
        return 4
    return 3


def format_cable_name(brand_name: str, construction: str, section: float) -> str:
    """Маркировка кабеля: ВВГ 3×2.5 (один знак ×, без дублирования x)."""
    if construction == "3+1":
        return f"{brand_name} 3×{section:g}+1×{section:g}"
    cores = _cores_count(construction)
    return f"{brand_name} {cores}×{section:g}"


def _diameter(section: float, construction: str, factor: float = 1.0) -> tuple[float, float]:
    base = DIAMETER_3C_CU.get(section, (10 + section ** 0.5 * 2, 7.5 + section ** 0.5 * 1.5))
    cores = _cores_count(construction)
    scale = 1.0 if construction in ("3x", "3+1") else 0.85 + cores * 0.05
    d = round(base[0] * scale * factor, 1)
    r_bend = round(d * 7.5, 1)
    return d, r_bend


def _mass_approx(section: float, cores: int, material: str) -> float:
    density = 8.9 if material == "Cu" else 2.7
    return round(section * cores * density / 1000 * 1.15, 3)


def generate_cables() -> list[dict]:
    """Генерация записей кабелей для загрузки в БД."""
    items = []
    for brand in CABLE_BRANDS:
        mat = brand["material"]
        i_table = I_LONG_CU_AIR if mat == "Cu" else I_LONG_AL_AIR
        r_fn = r_20_cu if mat == "Cu" else r_20_al
        factor = brand.get("diameter_factor", 1.0)

        for construction in brand["constructions"]:
            cores = _cores_count(construction)
            for section in brand["sections"]:
                if section not in i_table:
                    continue
                r20 = r_fn(section)
                outer, bend = _diameter(section, construction, factor)
                name = format_cable_name(brand["name"], construction, section)

                items.append({
                    "brand_name": brand["name"],
                    "name": name,
                    "construction": construction,
                    "section_mm2": section,
                    "cores": cores,
                    "material": mat,
                    "u_max_v": brand["u_max_v"],
                    "r_mohm_per_m": r20,
                    "r_20_mohm_per_m": r20,
                    "temp_coeff": 0.004 if mat == "Cu" else 0.00403,
                    "x_mohm_per_m": brand["x_mohm"],
                    "i_long_a": i_table[section],
                    "outer_diameter_mm": outer,
                    "min_bend_radius_mm": bend,
                    "n_core_section_mm2": section if cores >= 3 else None,
                    "pe_core_section_mm2": section if cores >= 4 else None,
                    "mass_kg_per_m": _mass_approx(section, cores, mat),
                    "gost_ref": brand["gost"],
                })
    return items

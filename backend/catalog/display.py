"""Единое отображение маркировки кабелей."""

from __future__ import annotations

import re

from catalog.data.cable_specs import format_cable_name


def normalize_cable_marking(name: str) -> str:
    """«ВВГ 3x×16» → «ВВГ 3×16», «ВВГ 3x16» → «ВВГ 3×16»."""
    if not name:
        return name
    s = re.sub(r"(\d+)x×", r"\1×", name, flags=re.IGNORECASE)
    s = re.sub(r"(\d+)x(\d+\.?\d*)", r"\1×\2", s)
    return s


def cable_display_name(cable) -> str:
    """Маркировка из полей кабеля (не из устаревшего name в БД)."""
    if cable.brand_id and cable.construction and cable.section_mm2 is not None:
        return format_cable_name(cable.brand.name, cable.construction, cable.section_mm2)
    return normalize_cable_marking(cable.name)

"""Логика секционированного ВРУ: схемы, секции, секционный выключатель."""

from __future__ import annotations

VRU_SCHEMES = ("1in_2out", "2in_2out", "2in_2out_sv")
VRU_MODES = ("normal", "section1", "section2")
VRU_SWITCH = ("open", "closed")


def vru_has_section_switch(scheme: str) -> bool:
    return scheme in ("1in_2out", "2in_2out_sv")


def vru_dual_inputs(scheme: str) -> bool:
    return scheme in ("2in_2out", "2in_2out_sv")


def handle_section_index(handle: str | None) -> int:
    if not handle:
        return 0
    for prefix in ("in", "out", "tap"):
        if handle.startswith(f"{prefix}-"):
            try:
                return int(handle.split("-", 1)[1])
            except ValueError:
                pass
    return 0


def is_tap_handle(handle: str | None) -> bool:
    return bool(handle and handle.startswith("tap-"))


def vru_ports(scheme: str) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    if vru_dual_inputs(scheme):
        return (
            [{"id": "in-0"}, {"id": "in-1"}],
            [{"id": "out-0"}, {"id": "out-1"}],
        )
    return ([{"id": "in-0"}], [{"id": "out-0"}, {"id": "out-1"}])


def vru_active_sections(node: dict) -> set[int]:
    mode = node.get("vru_operating_mode", "normal")
    if mode == "section1":
        return {0}
    if mode == "section2":
        return {1}
    return {0, 1}


def vru_sections_merged(node: dict) -> bool:
    scheme = node.get("vru_scheme", "1in_2out")
    if not vru_has_section_switch(scheme):
        return False
    return node.get("vru_section_switch", "open") == "closed"


def vru_per_section_inputs(node: dict) -> bool:
    """Отдельный вводной автомат на каждую секцию (2 ввода)."""
    return vru_dual_inputs(node.get("vru_scheme", "1in_2out"))

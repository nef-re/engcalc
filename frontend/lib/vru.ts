export type VruScheme = "1in_2out" | "2in_2out" | "2in_2out_sv";
export type VruSectionSwitch = "open" | "closed";
export type VruOperatingMode = "normal" | "section1" | "section2";

export type VruSectionLoad = {
  section: number;
  label: string;
  p_kw?: number;
  i_a?: number;
  active?: boolean;
  tap_i_a?: number;
};

export type VruSectionBreaker = {
  section: number;
  label: string;
  i_a?: number;
  breaker_id?: number;
  breaker_in_a?: number;
  breaker?: string;
  selectivity_ok?: boolean;
};

export const VRU_SCHEME_OPTIONS: { value: VruScheme; label: string }[] = [
  { value: "1in_2out", label: "1 ввод → 2 секции (СВ)" },
  { value: "2in_2out", label: "2 ввода → 2 секции" },
  { value: "2in_2out_sv", label: "2 ввода → 2 секции (СВ)" },
];

export const VRU_MODE_OPTIONS: { value: VruOperatingMode; label: string }[] = [
  { value: "normal", label: "Обе секции" },
  { value: "section1", label: "Только С-1" },
  { value: "section2", label: "Только С-2" },
];

export function vruHasSectionSwitch(scheme: VruScheme | string | undefined): boolean {
  return scheme === "1in_2out" || scheme === "2in_2out_sv";
}

export function vruDualInputs(scheme: VruScheme | string | undefined): boolean {
  return scheme === "2in_2out" || scheme === "2in_2out_sv";
}

export function vruPorts(scheme: VruScheme): {
  input_ports: { id: string }[];
  output_ports: { id: string }[];
} {
  if (vruDualInputs(scheme)) {
    return {
      input_ports: [{ id: "in-0" }, { id: "in-1" }],
      output_ports: [{ id: "out-0" }, { id: "out-1" }],
    };
  }
  return {
    input_ports: [{ id: "in-0" }],
    output_ports: [{ id: "out-0" }, { id: "out-1" }],
  };
}

export function vruTapPorts(
  scheme: VruScheme | string,
  tapIn0: boolean,
  tapIn1: boolean
): { id: string }[] {
  const taps: { id: string }[] = [];
  if (tapIn0) taps.push({ id: "tap-0" });
  if (tapIn1 && vruDualInputs(scheme)) taps.push({ id: "tap-1" });
  return taps;
}

export function vruActiveSections(
  mode: VruOperatingMode | string | undefined
): Set<number> {
  if (mode === "section1") return new Set([0]);
  if (mode === "section2") return new Set([1]);
  return new Set([0, 1]);
}

export function vruSectionsMerged(
  scheme: VruScheme | string | undefined,
  sectionSwitch: VruSectionSwitch | string | undefined
): boolean {
  return vruHasSectionSwitch(scheme) && sectionSwitch === "closed";
}

export function vruInputLabel(scheme: VruScheme | string, index: number): string {
  if (!vruDualInputs(scheme)) return "Ввод";
  return index === 0 ? "Ввод1" : "Ввод2";
}

/** Индекс секции по id порта in/out/tap */
export function portSectionIndex(handleId: string | null | undefined): number {
  if (!handleId) return 0;
  const m = handleId.match(/^(in|out|tap)-(\d+)$/);
  if (m) return Number(m[2]);
  return 0;
}

export function isVruTapHandle(handle: string | null | undefined): boolean {
  return Boolean(handle?.startsWith("tap-"));
}

export function syncVruPortData(data: Record<string, unknown>): Record<string, unknown> {
  const scheme = (data.vru_scheme as VruScheme) ?? "1in_2out";
  const ports = vruPorts(scheme);
  const tapIn0 = Boolean(data.vru_tap_in0);
  const tapIn1 = vruDualInputs(scheme) && Boolean(data.vru_tap_in1);
  return {
    ...data,
    input_ports: ports.input_ports,
    output_ports: ports.output_ports,
    tap_ports: vruTapPorts(scheme, tapIn0, tapIn1),
    vru_tap_in1: tapIn1,
  };
}

export function applyVruSchemeData(
  data: Record<string, unknown>,
  scheme: VruScheme
): Record<string, unknown> {
  const next = {
    ...data,
    node_type: "vru",
    vru_scheme: scheme,
    vru_section_switch: vruHasSectionSwitch(scheme) ? data.vru_section_switch ?? "open" : "open",
    vru_tap_in1: vruDualInputs(scheme) ? data.vru_tap_in1 : false,
  };
  return syncVruPortData(next);
}

export function toggleVruSectionSwitch(
  data: Record<string, unknown>
): Record<string, unknown> {
  if (!vruHasSectionSwitch(String(data.vru_scheme))) return data;
  const next = data.vru_section_switch === "closed" ? "open" : "closed";
  return { ...data, vru_section_switch: next };
}

export function vruModeLabel(mode: string | undefined): string {
  return VRU_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? "Обе секции";
}

export function vruSwitchLabel(
  scheme: string | undefined,
  sw: string | undefined
): string {
  if (!vruHasSectionSwitch(scheme)) return "";
  return sw === "closed" ? "СВ замкнут" : "СВ разомкнут";
}

/** Высота строки заголовка узла ВРУ (над схемой секций) */
export const VRU_HEADER_PX = 24;

/** Высота области схемы С1 — СВ — С2 */
export const VRU_SCHEMATIC_H_PX = 132;

/** Y-центры секций С1 и С2 внутри области схемы (px) */
export const VRU_SECTION_ROW_Y: [number, number] = [24, 108];

/** Y-центр секционного выключателя внутри области схемы (px) */
export const VRU_SV_ROW_Y = 66;

/** Y-центры строк схемы (2 секции) в px */
export function vruRowCenters(_schematicHeight: number = VRU_SCHEMATIC_H_PX): [number, number] {
  return VRU_SECTION_ROW_Y;
}

export function vruSchematicTop(): number {
  return VRU_HEADER_PX;
}

export function vruHandleTop(
  handleId: string,
  scheme: VruScheme | string,
  _nodeHeight?: number
): number {
  const top = vruSchematicTop();
  const [r0, r1] = vruRowCenters();
  if (handleId === "in-0" && !vruDualInputs(scheme)) {
    return top + VRU_SV_ROW_Y;
  }
  const idx = portSectionIndex(handleId);
  return top + (idx === 0 ? r0 : r1);
}

export function vruNodeHeight(hasTap: boolean): number {
  const base = VRU_HEADER_PX + VRU_SCHEMATIC_H_PX;
  return hasTap ? base + 8 : base;
}

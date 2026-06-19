import { formatCableResultValue } from "@/lib/cables";

type Props = {
  result: Record<string, unknown>;
  warnings: string[];
};

const LABELS: Record<string, string> = {
  p_kw: "P, кВт",
  q_kvar: "Q, квар",
  s_kva: "S, кВА",
  i_a: "I, А",
  delta_u_v: "ΔU, В",
  delta_u_percent: "ΔU, %",
  ik_a: "Ik, А",
  ik_ka: "Ik, кА",
  z_total_mohm: "Z, мОм",
  required_i_a: "I треб, А",
  selected_section_mm2: "S, мм²",
  selected_cable: "Кабель",
  recommended_in_a: "In, А",
  model: "Автомат",
  airflow_m3h: "L, м³/ч",
  velocity_ms: "V, м/с",
  pressure_drop_pa: "ΔP, Па",
};

export function ResultPanel({ result, warnings }: Props) {
  return (
    <div className="space-y-4">
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="mb-1 text-sm font-medium text-amber-300">Предупреждения</p>
          <ul className="list-inside list-disc text-sm text-amber-200/90">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(result).map(([key, value]) => (
          <div
            key={key}
            className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2"
          >
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {LABELS[key] ?? key}
            </p>
            <p className="mt-0.5 text-base font-semibold text-slate-100">
              {formatCableResultValue(key, value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

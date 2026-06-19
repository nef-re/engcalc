import type { StandardRef } from "@/lib/api";

type Props = {
  standardRef?: string;
  standards?: StandardRef[];
};

export function StandardsPanel({ standardRef, standards = [] }: Props) {
  if (!standardRef && !standards.length) return null;

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Нормативная база расчёта
      </h3>
      {standardRef && (
        <p className="mb-1.5 text-xs text-slate-400">{standardRef}</p>
      )}
      {standards.length > 0 && (
        <ul className="space-y-1.5">
          {standards.map((s) => (
            <li key={s.code} className="text-xs">
              <span className="font-medium text-sky-400">{s.code}</span>
              {s.clause && (
                <span className="text-slate-500"> ({s.clause})</span>
              )}
              <p className="text-slate-400">{s.title}</p>
              {s.description && (
                <p className="text-[11px] text-slate-500">{s.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

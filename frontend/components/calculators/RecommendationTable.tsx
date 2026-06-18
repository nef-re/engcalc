type Item = Record<string, unknown>;

type Props = {
  recommendations: Record<string, Item[]>;
};

const HEADERS: Record<string, Record<string, string>> = {
  cables: {
    name: "Кабель",
    section_mm2: "S, мм²",
    i_long_a: "Iд, А",
    brand: "Марка",
  },
  breakers: {
    manufacturer: "Производитель",
    model_name: "Модель",
    in_a: "In, А",
    icu_ka: "Icu, кА",
    curve: "Кривая",
  },
  fans: {
    manufacturer: "Производитель",
    model_name: "Модель",
    q_max_m3h: "Q, м³/ч",
    p_max_pa: "P, Па",
  },
};

const TITLES: Record<string, string> = {
  cables: "Рекомендуемые кабели",
  breakers: "Рекомендуемые автоматы",
  fans: "Рекомендуемые вентиляторы",
};

export function RecommendationTable({ recommendations }: Props) {
  const entries = Object.entries(recommendations).filter(([, items]) => items?.length);

  if (!entries.length) return null;

  return (
    <div className="space-y-6">
      {entries.map(([key, items]) => {
        const headers = HEADERS[key] ?? {};
        const cols = Object.keys(headers);

        return (
          <div key={key}>
            <h3 className="mb-2 text-sm font-medium text-slate-300">{TITLES[key] ?? key}</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-700/60">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/80 text-slate-400">
                  <tr>
                    {cols.map((col) => (
                      <th key={col} className="px-3 py-2 font-medium">
                        {headers[col]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={idx}
                      className="border-t border-slate-700/40 hover:bg-slate-800/30"
                    >
                      {cols.map((col) => (
                        <td key={col} className="px-3 py-2 text-slate-200">
                          {String(item[col] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

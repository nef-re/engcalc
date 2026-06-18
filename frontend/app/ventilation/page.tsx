import Link from "next/link";

import { AppShell } from "@/components/AppShell";

const CALCS = [
  { href: "/ventilation/airflow", title: "Расход воздуха", desc: "По кратности воздухообмена" },
  { href: "/ventilation/duct-resistance", title: "Сопротивление сети", desc: "Упрощённый ΔP" },
  { href: "/ventilation/fan-selection", title: "Подбор вентилятора", desc: "Из каталога по L и P" },
];

export default function VentilationHubPage() {
  return (
    <AppShell accent="vent">
      <h1 className="text-2xl font-bold text-slate-100">Вентиляция (ОВ)</h1>
      <p className="mt-2 text-slate-400">Раздел в разработке — базовые калькуляторы доступны.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {CALCS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-slate-800 p-5 transition hover:border-teal-500/40 hover:bg-slate-900/50"
          >
            <h2 className="font-semibold text-teal-400">{c.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{c.desc}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}

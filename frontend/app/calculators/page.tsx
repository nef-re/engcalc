import Link from "next/link";

import { AppShell } from "@/components/AppShell";

const GROUPS = [
  {
    title: "Электрика — ЭОМ / ЭС",
    href: "/electrical",
    color: "text-sky-400",
    items: [
      { href: "/electrical/load", title: "Расчёт нагрузки" },
      { href: "/electrical/cable-section", title: "Подбор сечения" },
      { href: "/electrical/voltage-drop", title: "Падение напряжения" },
      { href: "/electrical/short-circuit", title: "Ток КЗ" },
      { href: "/electrical/breaker-selection", title: "Подбор автомата" },
    ],
  },
  {
    title: "Вентиляция — ОВ",
    href: "/ventilation",
    color: "text-teal-400",
    items: [
      { href: "/ventilation/airflow", title: "Расход воздуха" },
      { href: "/ventilation/duct-resistance", title: "Сопротивление сети" },
      { href: "/ventilation/fan-selection", title: "Подбор вентилятора" },
    ],
  },
];

export default function CalculatorsPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-100">Калькуляторы</h1>
      <p className="mt-2 text-slate-400">
        Свободный доступ — без регистрации. Для сквозного расчёта системы используйте{" "}
        <Link href="/cabinet" className="text-sky-400 hover:underline">
          личный кабинет
        </Link>
        .
      </p>

      <div className="mt-10 space-y-10">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <Link href={g.href} className={`text-lg font-semibold ${g.color} hover:underline`}>
              {g.title}
            </Link>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {g.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl border border-slate-800 px-5 py-4 transition hover:border-slate-600 hover:bg-slate-900/40"
                >
                  <span className="font-medium text-slate-200">{item.title}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

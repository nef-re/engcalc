import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { ElectricalSidebar } from "@/components/ElectricalSidebar";

const CALCS = [
  {
    href: "/electrical/load",
    title: "Расчёт нагрузки",
    desc: "P, cos φ → I, S, Q",
  },
  {
    href: "/electrical/cable-section",
    title: "Подбор сечения",
    desc: "По допустимому току и прокладке",
  },
  {
    href: "/electrical/voltage-drop",
    title: "Падение напряжения",
    desc: "ΔU, график, рекомендации по кабелю",
  },
  {
    href: "/electrical/short-circuit",
    title: "Ток КЗ",
    desc: "Ik на конце линии",
  },
  {
    href: "/electrical/breaker-selection",
    title: "Подбор автомата",
    desc: "In, Icu из каталога",
  },
  {
    href: "/electrical/catalog",
    title: "Каталог",
    desc: "Кабели по ГОСТ и аппараты защиты",
  },
];

export default function ElectricalHubPage() {
  return (
    <AppShell sidebar={<ElectricalSidebar />}>
      <h1 className="text-2xl font-bold text-slate-100">Электрика — ЭОМ / ЭС</h1>
      <p className="mt-2 text-slate-400">
        Калькуляторы в свободном доступе. Сквозной расчёт системы — в{" "}
        <Link href="/cabinet" className="text-sky-400 hover:underline">
          личном кабинете
        </Link>
        .
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {CALCS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-slate-800 p-5 transition hover:border-sky-500/40 hover:bg-slate-900/50"
          >
            <h2 className="font-semibold text-sky-400">{c.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{c.desc}</p>
          </Link>
        ))}
        <Link
          href="/cabinet/system"
          className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-5 transition hover:border-sky-400/50"
        >
          <h2 className="font-semibold text-sky-300">Расчёт системы МКД</h2>
          <p className="mt-1 text-sm text-slate-500">ТП → ВРУ → РЩ → ГЩ — по регистрации</p>
        </Link>
      </div>
    </AppShell>
  );
}

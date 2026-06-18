import Link from "next/link";

import { AppShell } from "@/components/AppShell";

export default function HomePage() {
  return (
    <AppShell>
      <section className="relative overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 p-8 md:p-12">
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Инженерный портал расчётов
          </h1>
          <p className="mt-4 text-lg text-slate-400">
            Калькуляторы для проектирования разделов ЭОМ и ЭС: нагрузки, сечение кабеля,
            падение напряжения, ток КЗ, подбор автоматов. Каталог материалов и оборудования.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/electrical"
              className="rounded-lg bg-sky-600 px-5 py-2.5 font-medium text-white transition hover:bg-sky-500"
            >
              Электрика →
            </Link>
            <Link
              href="/ventilation"
              className="rounded-lg border border-teal-600/50 px-5 py-2.5 font-medium text-teal-300 transition hover:bg-teal-950/50"
            >
              Вентиляция →
            </Link>
          </div>
        </div>
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl"
          aria-hidden
        />
      </section>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Link
          href="/electrical/voltage-drop"
          className="group rounded-xl border border-slate-800 p-5 transition hover:border-sky-500/40 hover:bg-slate-900/50"
        >
          <h2 className="font-semibold text-sky-400 group-hover:text-sky-300">
            Падение напряжения
          </h2>
          <p className="mt-1 text-sm text-slate-500">ΔU на участке, график ΔU(S), подбор кабеля</p>
        </Link>
        <Link
          href="/electrical/short-circuit"
          className="group rounded-xl border border-slate-800 p-5 transition hover:border-sky-500/40 hover:bg-slate-900/50"
        >
          <h2 className="font-semibold text-sky-400 group-hover:text-sky-300">
            Ток короткого замыкания
          </h2>
          <p className="mt-1 text-sm text-slate-500">Ik 1ф/3ф, график Ik(S)</p>
        </Link>
        <Link
          href="/electrical/system"
          className="group rounded-xl border border-slate-800 p-5 transition hover:border-sky-500/40 hover:bg-slate-900/50"
        >
          <h2 className="font-semibold text-sky-400 group-hover:text-sky-300">
            Расчёт системы МКД
          </h2>
          <p className="mt-1 text-sm text-slate-500">ВРУ → РЩ → ГЩ → нагрузка</p>
        </Link>
      </div>
    </AppShell>
  );
}

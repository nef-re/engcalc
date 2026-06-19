import Link from "next/link";

import { AppShell } from "@/components/AppShell";

const FREE_CALCS = [
  { href: "/electrical/voltage-drop", title: "Падение напряжения", tag: "ЭОМ" },
  { href: "/electrical/short-circuit", title: "Ток КЗ", tag: "ЭС" },
  { href: "/electrical/cable-section", title: "Сечение кабеля", tag: "ЭОМ" },
  { href: "/electrical/load", title: "Расчёт нагрузки", tag: "ЭОМ" },
  { href: "/electrical/breaker-selection", title: "Подбор автомата", tag: "ЭС" },
  { href: "/ventilation/airflow", title: "Расход воздуха", tag: "ОВ" },
];

const SECTIONS = [
  {
    title: "Электрика",
    desc: "ЭОМ и ЭС: нагрузки, кабели, ΔU, КЗ, защита",
    href: "/electrical",
    color: "sky",
    status: "Доступно",
  },
  {
    title: "Вентиляция",
    desc: "ОВ: расход, сопротивление сети, подбор оборудования",
    href: "/ventilation",
    color: "teal",
    status: "Доступно",
  },
  {
    title: "Водоснабжение",
    desc: "ВК: гидравлика, подбор труб и арматуры",
    href: "#",
    color: "slate",
    status: "Скоро",
  },
  {
    title: "Теплоснабжение",
    desc: "Отопление, теплопотери, гидравлический расчёт",
    href: "#",
    color: "slate",
    status: "Скоро",
  },
];

export default function HomePage() {
  return (
    <AppShell fullBleed>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-20 lg:px-12 lg:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-900/20 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-sky-400/80">
            Инженерный портал
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white lg:text-5xl">
            Расчёты и проектирование инженерных систем
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-400">
            Каталоги материалов и оборудования, нормативная база ГОСТ и ПУЭ,
            калькуляторы в свободном доступе и полноценный расчёт распределительных
            сетей в личном кабинете.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/calculators"
              className="rounded-xl bg-sky-600 px-6 py-3 font-medium text-white shadow-lg shadow-sky-900/30 transition hover:bg-sky-500"
            >
              Калькуляторы — бесплатно
            </Link>
            <Link
              href="/register"
              className="rounded-xl border border-slate-600 bg-slate-900/50 px-6 py-3 font-medium text-slate-200 transition hover:border-sky-500/50 hover:bg-slate-800/50"
            >
              Расчёт системы — регистрация
            </Link>
          </div>
        </div>
      </section>

      {/* Two tiers */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:px-12">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-8">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
              Свободный доступ
            </span>
            <h2 className="mt-4 text-2xl font-bold text-white">Калькуляторы</h2>
            <p className="mt-2 text-slate-400">
              Отдельные инженерные расчёты без регистрации: ΔU, КЗ, сечение,
              нагрузка, подбор автоматов, вентиляция.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-slate-300">
              <li>✓ Графики и подбор из каталога</li>
              <li>✓ Нормативы ПУЭ, ГОСТ Р</li>
              <li>✓ Без ограничений по числу расчётов</li>
            </ul>
            <Link
              href="/calculators"
              className="mt-6 inline-block text-sm font-medium text-emerald-400 hover:text-emerald-300"
            >
              Все калькуляторы →
            </Link>
          </div>

          <div className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-8">
            <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-medium text-sky-300">
              Личный кабинет
            </span>
            <h2 className="mt-4 text-2xl font-bold text-white">Расчёт системы</h2>
            <p className="mt-2 text-slate-400">
              Схема распределения: ТП → ВРУ → РЩ → ГЩ → нагрузки. Интерактивный
              редактор, сквозной расчёт по всей цепи, сохранение проектов.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-slate-300">
              <li>✓ Визуальная схема (React Flow)</li>
              <li>✓ Расчёт ΔU, Ik по участкам</li>
              <li>✓ Проекты и история расчётов</li>
            </ul>
            <Link
              href="/cabinet"
              className="mt-6 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Войти в кабинет →
            </Link>
          </div>
        </div>
      </section>

      {/* Disciplines */}
      <section className="border-t border-slate-800 bg-slate-900/30 px-6 py-16 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold text-white">Разделы проектирования</h2>
          <p className="mt-2 text-slate-400">Модульная архитектура — новые разделы добавляются по мере развития</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SECTIONS.map((s) => (
              <Link
                key={s.title}
                href={s.href}
                className={`rounded-xl border p-5 transition ${
                  s.status === "Скоро"
                    ? "cursor-default border-slate-800 opacity-60"
                    : "border-slate-700 hover:border-sky-500/40 hover:bg-slate-900/50"
                }`}
              >
                <span className="text-xs text-slate-500">{s.status}</span>
                <h3 className="mt-1 font-semibold text-slate-100">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{s.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Free calculators grid */}
      <section className="mx-auto max-w-6xl px-6 py-16 lg:px-12">
        <h2 className="text-2xl font-bold text-white">Популярные калькуляторы</h2>
        <p className="mt-2 text-slate-400">Доступны без регистрации</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FREE_CALCS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex items-center justify-between rounded-xl border border-slate-800 px-5 py-4 transition hover:border-sky-500/30 hover:bg-slate-900/40"
            >
              <div>
                <span className="text-[10px] uppercase tracking-wide text-slate-600">{c.tag}</span>
                <p className="font-medium text-slate-200 group-hover:text-sky-300">{c.title}</p>
              </div>
              <span className="text-slate-600 group-hover:text-sky-400">→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800 px-6 py-16 lg:px-12">
        <div className="mx-auto max-w-6xl rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-950/50 to-slate-900 p-10 text-center">
          <h2 className="text-2xl font-bold text-white">Начните проектирование</h2>
          <p className="mx-auto mt-3 max-w-lg text-slate-400">
            Калькуляторы — сразу. Полный расчёт системы МКД — после бесплатной регистрации.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/register" className="rounded-lg bg-sky-600 px-6 py-2.5 font-medium text-white hover:bg-sky-500">
              Создать аккаунт
            </Link>
            <Link href="/login" className="rounded-lg border border-slate-600 px-6 py-2.5 text-slate-300 hover:bg-slate-800">
              Уже есть аккаунт
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

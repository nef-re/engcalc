"use client";

import Link from "next/link";

import { useAuth } from "@/components/AuthProvider";

const NAV = [
  { href: "/", label: "Главная" },
  { href: "/calculators", label: "Калькуляторы" },
  { href: "/electrical", label: "Электрика" },
  { href: "/ventilation", label: "Вентиляция" },
];

type Props = {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  accent?: "electric" | "vent";
  wide?: boolean;
  fullBleed?: boolean;
};

export function AppShell({
  children,
  sidebar,
  accent = "electric",
  wide = false,
  fullBleed = false,
}: Props) {
  const { user, logout, loading } = useAuth();
  const accentBorder =
    accent === "vent" ? "border-teal-500/30" : "border-sky-500/30";
  const accentText = accent === "vent" ? "text-teal-400" : "text-sky-400";

  const contentClass = fullBleed
    ? "w-full"
    : `mx-auto px-4 py-8 lg:px-6 ${wide ? "max-w-none" : "max-w-6xl"}`;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside
        className={`hidden w-64 shrink-0 flex-col border-r ${accentBorder} bg-slate-900/80 lg:flex`}
      >
        <div className="border-b border-slate-800 px-5 py-4">
          <Link href="/" className={`text-lg font-bold ${accentText}`}>
            EngCalc
          </Link>
          <p className="text-xs text-slate-500">Инженерный портал</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/cabinet"
            className="mt-2 block rounded-lg border border-sky-500/30 px-3 py-2 text-sm text-sky-300 transition hover:bg-sky-950/50"
          >
            Личный кабинет
          </Link>
        </nav>
        {sidebar && (
          <div className="border-t border-slate-800 p-3 text-sm">{sidebar}</div>
        )}
        <div className="border-t border-slate-800 p-3 text-sm">
          {!loading && user ? (
            <div>
              <p className="truncate text-slate-400">{user.username}</p>
              <button
                type="button"
                onClick={logout}
                className="mt-1 text-xs text-slate-500 hover:text-slate-300"
              >
                Выйти
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Link href="/login" className="text-sky-400 hover:text-sky-300">
                Войти
              </Link>
              <Link href="/register" className="text-xs text-slate-500 hover:text-slate-400">
                Регистрация
              </Link>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 lg:hidden">
          <Link href="/" className={`font-bold ${accentText}`}>
            EngCalc
          </Link>
          <div className="flex gap-3 text-sm">
            {user ? (
              <Link href="/cabinet" className="text-sky-400">
                Кабинет
              </Link>
            ) : (
              <Link href="/login" className="text-sky-400">
                Войти
              </Link>
            )}
          </div>
        </header>
        <div className={contentClass}>{children}</div>
      </main>
    </div>
  );
}

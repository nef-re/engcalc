import Link from "next/link";

const NAV = [
  { href: "/", label: "Главная" },
  { href: "/electrical", label: "Электрика (ЭОМ/ЭС)" },
  { href: "/ventilation", label: "Вентиляция" },
  { href: "/projects", label: "Проекты" },
];

type Props = {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  accent?: "electric" | "vent";
};

export function AppShell({ children, sidebar, accent = "electric" }: Props) {
  const accentBorder =
    accent === "vent" ? "border-teal-500/30" : "border-sky-500/30";
  const accentText = accent === "vent" ? "text-teal-400" : "text-sky-400";

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside
        className={`hidden w-64 shrink-0 flex-col border-r ${accentBorder} bg-slate-900/80 lg:flex`}
      >
        <div className="border-b border-slate-800 px-5 py-4">
          <Link href="/" className={`text-lg font-bold ${accentText}`}>
            EngCalc
          </Link>
          <p className="text-xs text-slate-500">Инженерные калькуляторы</p>
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
        </nav>
        {sidebar && (
          <div className="border-t border-slate-800 p-3 text-sm">{sidebar}</div>
        )}
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="border-b border-slate-800 px-4 py-3 lg:hidden">
          <Link href="/" className={`font-bold ${accentText}`}>
            EngCalc
          </Link>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </main>
    </div>
  );
}

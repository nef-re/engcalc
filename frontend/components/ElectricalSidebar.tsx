import Link from "next/link";

const STEPS = [
  { href: "/electrical/load", label: "1. Нагрузка", slug: "electrical.load" },
  { href: "/electrical/cable-section", label: "2. Сечение", slug: "electrical.cable_section" },
  { href: "/electrical/voltage-drop", label: "3. ΔU", slug: "electrical.voltage_drop" },
  { href: "/electrical/short-circuit", label: "4. КЗ", slug: "electrical.short_circuit" },
  { href: "/electrical/breaker-selection", label: "5. Автомат", slug: "electrical.breaker_selection" },
  { href: "/electrical/system", label: "6. Система МКД", slug: "electrical.system" },
];

export function ElectricalSidebar({ current }: { current?: string }) {
  return (
    <div>
      <p className="mb-2 px-2 text-xs font-medium uppercase text-slate-500">Цепочка ЭОМ/ЭС</p>
      <ul className="space-y-0.5">
        {STEPS.map((step) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className={`block rounded-md px-2 py-1.5 text-xs transition ${
                current === step.slug
                  ? "bg-sky-500/20 text-sky-300"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {step.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

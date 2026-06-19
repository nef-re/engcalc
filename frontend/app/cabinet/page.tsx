"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { authHeaders } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Project = { id: number; name: string; client: string; updated_at: string };
type System = { id: number; name: string; updated_at: string };

function CabinetContent() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [systems, setSystems] = useState<System[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/projects/`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setProjects);
    fetch(`${API_URL}/api/v1/electrical/systems/`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then(setSystems);
  }, []);

  return (
    <AppShell wide>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100">Личный кабинет</h1>
        <p className="mt-1 text-slate-400">
          Добро пожаловать, <span className="text-sky-300">{user?.username}</span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Link
          href="/cabinet/system"
          className="group rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-950/40 to-slate-900/40 p-8 transition hover:border-sky-400/50"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-sky-400">
            Проектирование
          </span>
          <h2 className="mt-2 text-xl font-bold text-white group-hover:text-sky-200">
            Расчёт системы
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            ТП → ВРУ → РЩ → ГЩ → нагрузки. Интерактивная схема и сквозной расчёт.
          </p>
          <span className="mt-4 inline-block text-sm font-medium text-sky-400">
            Открыть редактор →
          </span>
        </Link>

        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/40 p-8">
          <h2 className="text-lg font-semibold text-slate-200">Мои проекты</h2>
          <p className="mt-1 text-sm text-slate-500">Сохранённые объекты проектирования</p>
          <ul className="mt-4 space-y-2">
            {projects.map((p) => (
              <li key={p.id} className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300">
                {p.name}
                {p.client && <span className="ml-2 text-slate-600">— {p.client}</span>}
              </li>
            ))}
            {!projects.length && (
              <li className="text-sm text-slate-600">Пока нет проектов</li>
            )}
          </ul>
        </div>
      </div>

      {systems.length > 0 && (
        <div className="mt-8 rounded-xl border border-slate-700/60 bg-slate-900/40 p-6">
          <h2 className="font-semibold text-slate-200">Сохранённые схемы</h2>
          <ul className="mt-3 space-y-2">
            {systems.map((s) => (
              <li key={s.id} className="text-sm text-slate-400">
                {s.name} — {new Date(s.updated_at).toLocaleDateString("ru")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <p className="text-sm text-slate-500">
          Калькуляторы в свободном доступе —{" "}
          <Link href="/calculators" className="text-sky-400 hover:underline">
            перейти к калькуляторам
          </Link>
        </p>
      </div>
    </AppShell>
  );
}

export default function CabinetPage() {
  return (
    <ProtectedRoute>
      <CabinetContent />
    </ProtectedRoute>
  );
}

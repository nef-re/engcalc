"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Project = {
  id: number;
  name: string;
  client: string;
  address: string;
  updated_at: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  function load() {
    fetch(`${API_URL}/api/v1/projects/`)
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/v1/projects/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
      load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-100">Проекты</h1>
      <p className="mt-2 text-slate-400">Сохранение расчётов в проект (при расчёте укажите project_id в API).</p>

      <form onSubmit={createProject} className="mt-6 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название проекта"
          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-sky-600 px-4 py-2 text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Создать
        </button>
      </form>

      <ul className="mt-8 space-y-2">
        {projects.map((p) => (
          <li
            key={p.id}
            className="rounded-lg border border-slate-800 px-4 py-3 text-slate-300"
          >
            <span className="font-medium text-slate-100">{p.name}</span>
            {p.client && <span className="ml-2 text-sm text-slate-500">— {p.client}</span>}
            <span className="ml-2 text-xs text-slate-600">id: {p.id}</span>
          </li>
        ))}
        {!projects.length && (
          <li className="text-sm text-slate-500">Пока нет проектов</li>
        )}
      </ul>
    </AppShell>
  );
}

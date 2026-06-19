"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { AppShell } from "@/components/AppShell";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(username, email, password);
      router.push("/cabinet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold text-slate-100">Регистрация</h1>
        <p className="mt-2 text-slate-400">
          Бесплатный аккаунт для расчёта систем и сохранения проектов
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block text-sm text-slate-400">
            Логин
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block text-sm text-slate-400">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block text-sm text-slate-400">
            Пароль (мин. 6 символов)
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 py-2.5 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {loading ? "Создание…" : "Создать аккаунт"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-sky-400 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </AppShell>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/AuthProvider";

type Props = {
  children: React.ReactNode;
};

export function ProtectedRoute({ children }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?next=/cabinet");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
        Загрузка…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-8 text-center">
        <p className="text-slate-300">Для доступа нужна авторизация</p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/login" className="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white">
            Войти
          </Link>
          <Link href="/register" className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300">
            Регистрация
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

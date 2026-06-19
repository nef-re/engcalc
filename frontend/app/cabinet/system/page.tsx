import { AppShell } from "@/components/AppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SystemFlowEditor } from "@/components/electrical/SystemFlowEditor";

export default function CabinetSystemPage() {
  return (
    <ProtectedRoute>
      <AppShell wide>
        <h1 className="mb-2 text-2xl font-bold text-slate-100">Расчёт системы — МКД</h1>
        <p className="mb-6 text-slate-400">
          Личный кабинет · схема: ТП → ВРУ → РЩ → ГЩ → нагрузка.
          Параметры — справа от схемы. Сохраняйте и загружайте проекты в верхней панели.
        </p>
        <SystemFlowEditor />
      </AppShell>
    </ProtectedRoute>
  );
}

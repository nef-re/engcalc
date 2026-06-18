import { AppShell } from "@/components/AppShell";
import { SystemFlowEditor } from "@/components/electrical/SystemFlowEditor";
import { ElectricalSidebar } from "@/components/ElectricalSidebar";

export default function SystemPage() {
  return (
    <AppShell sidebar={<ElectricalSidebar current="electrical.system" />}>
      <h1 className="mb-2 text-2xl font-bold text-slate-100">Расчёт системы — МКД</h1>
      <p className="mb-6 text-slate-400">
        Схема: ТП → ВРУ → распределительный щит → групповой щит → нагрузка.
        Добавляйте элементы кнопками, соединяйте линиями. ТП задаёт Z источника по умолчанию.
      </p>
      <SystemFlowEditor />
    </AppShell>
  );
}

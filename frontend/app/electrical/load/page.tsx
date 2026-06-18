import { AppShell } from "@/components/AppShell";
import { CalculatorClient } from "@/components/calculators/CalculatorClient";
import { ElectricalSidebar } from "@/components/ElectricalSidebar";

export default function LoadPage() {
  return (
    <AppShell sidebar={<ElectricalSidebar current="electrical.load" />}>
      <CalculatorClient
        slug="electrical.load"
        title="Расчёт нагрузки"
        description="Активная мощность и cos φ → расчётный ток, S, Q"
        standardRef="ПУЭ 7"
      />
    </AppShell>
  );
}

import { AppShell } from "@/components/AppShell";
import { CalculatorClient } from "@/components/calculators/CalculatorClient";
import { ElectricalSidebar } from "@/components/ElectricalSidebar";

export default function BreakerSelectionPage() {
  return (
    <AppShell sidebar={<ElectricalSidebar current="electrical.breaker_selection" />}>
      <CalculatorClient
        slug="electrical.breaker_selection"
        title="Подбор автоматического выключателя"
        description="In и Icu по расчётному току и току КЗ"
        standardRef="ПУЭ 7"
      />
    </AppShell>
  );
}

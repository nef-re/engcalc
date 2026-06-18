import { AppShell } from "@/components/AppShell";
import { CalculatorClient } from "@/components/calculators/CalculatorClient";
import { ElectricalSidebar } from "@/components/ElectricalSidebar";

export default function ShortCircuitPage() {
  return (
    <AppShell sidebar={<ElectricalSidebar current="electrical.short_circuit" />}>
      <CalculatorClient
        slug="electrical.short_circuit"
        title="Ток короткого замыкания"
        description="Расчёт Ik на конце кабельной линии (1ф / 3ф)"
        standardRef="ПУЭ 7, гл. 1.7"
      />
    </AppShell>
  );
}

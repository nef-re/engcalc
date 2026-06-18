import { AppShell } from "@/components/AppShell";
import { CalculatorClient } from "@/components/calculators/CalculatorClient";
import { ElectricalSidebar } from "@/components/ElectricalSidebar";

export default function VoltageDropPage() {
  return (
    <AppShell sidebar={<ElectricalSidebar current="electrical.voltage_drop" />}>
      <CalculatorClient
        slug="electrical.voltage_drop"
        title="Падение напряжения"
        description="Расчёт ΔU на участке линии с подбором сечения из каталога"
        standardRef="ПУЭ 7, п. 1.2.20"
      />
    </AppShell>
  );
}

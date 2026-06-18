import { AppShell } from "@/components/AppShell";
import { CalculatorClient } from "@/components/calculators/CalculatorClient";
import { ElectricalSidebar } from "@/components/ElectricalSidebar";

export default function CableSectionPage() {
  return (
    <AppShell sidebar={<ElectricalSidebar current="electrical.cable_section" />}>
      <CalculatorClient
        slug="electrical.cable_section"
        title="Подбор сечения кабеля"
        description="По допустимому длительному току с учётом условий прокладки"
        standardRef="ПУЭ 7, табл. 1.3.4"
      />
    </AppShell>
  );
}

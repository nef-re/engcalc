import { AppShell } from "@/components/AppShell";
import { CalculatorClient } from "@/components/calculators/CalculatorClient";

export default function DuctResistancePage() {
  return (
    <AppShell accent="vent">
      <CalculatorClient
        slug="ventilation.duct_resistance"
        title="Сопротивление воздуховода"
        description="Упрощённая оценка потери давления"
        standardRef="СП 60"
        accent="#2dd4bf"
      />
    </AppShell>
  );
}

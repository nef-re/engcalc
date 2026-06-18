import { AppShell } from "@/components/AppShell";
import { CalculatorClient } from "@/components/calculators/CalculatorClient";

export default function FanSelectionPage() {
  return (
    <AppShell accent="vent">
      <CalculatorClient
        slug="ventilation.fan_selection"
        title="Подбор вентилятора"
        description="По требуемым L и ΔP из каталога"
        standardRef="СП 60"
        accent="#2dd4bf"
      />
    </AppShell>
  );
}

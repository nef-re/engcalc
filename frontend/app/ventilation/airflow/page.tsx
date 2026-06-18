import { AppShell } from "@/components/AppShell";
import { CalculatorClient } from "@/components/calculators/CalculatorClient";

export default function AirflowPage() {
  return (
    <AppShell accent="vent">
      <CalculatorClient
        slug="ventilation.airflow"
        title="Расход воздуха"
        description="Расчёт по объёму помещения и кратности"
        standardRef="СП 60"
        accent="#2dd4bf"
      />
    </AppShell>
  );
}

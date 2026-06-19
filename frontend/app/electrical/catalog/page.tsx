import { AppShell } from "@/components/AppShell";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";
import { ElectricalSidebar } from "@/components/ElectricalSidebar";

export default function CatalogPage() {
  return (
    <AppShell sidebar={<ElectricalSidebar current="electrical.catalog" />} wide>
      <h1 className="text-2xl font-bold text-slate-100">Каталог кабелей и аппаратов</h1>
      <p className="mt-2 text-slate-400">
        Справочник по ГОСТ (кабели без производителя) и линейкам IEK, Dekraft, КЭАЗ, EKF,
        Контактор. Выберите позицию для просмотра характеристик.
      </p>
      <div className="mt-8">
        <CatalogBrowser />
      </div>
    </AppShell>
  );
}

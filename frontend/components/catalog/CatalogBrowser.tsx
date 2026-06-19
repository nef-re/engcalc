"use client";

import { useCallback, useEffect, useState } from "react";

import {
  BreakerItem,
  CableItem,
  fetchBreakers,
  fetchBreakersMeta,
  fetchCableBrands,
  fetchCables,
} from "@/lib/api";
import {
  compactListItemActiveCls,
  compactListItemCls,
  formatCableMarking,
  formatConstructionLabel,
} from "@/lib/cables";

type Tab = "cables" | "breakers";

const MATERIAL_LABELS: Record<string, string> = { Cu: "Медь", Al: "Алюминий" };
const CATEGORY_LABELS: Record<string, string> = {
  household: "Бытовой",
  industrial: "Промышленный",
};
const BREAKER_TYPE_LABELS: Record<string, string> = {
  MCB: "Модульный (MCB)",
  MCCB: "В литом корпусе (MCCB)",
  ACB: "Воздушный (ACB)",
};

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex justify-between gap-3 border-b border-slate-800/80 py-1 text-xs last:border-0">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-200">{value}</span>
    </div>
  );
}

function CableDetail({ item }: { item: CableItem }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-sky-300">{formatCableMarking(item.name)}</h3>
      <p className="mt-1 text-xs text-slate-500">{item.gost_ref}</p>
      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <SpecRow label="Марка" value={item.brand} />
        <SpecRow label="Исполнение" value={formatConstructionLabel(item.construction)} />
        <SpecRow label="Сечение, мм²" value={item.section_mm2} />
        <SpecRow label="Число жил" value={item.cores} />
        <SpecRow label="Материал" value={MATERIAL_LABELS[item.material] ?? item.material} />
        <SpecRow label="Класс напряжения, В" value={item.u_max_v} />
        <SpecRow label="Iд (длит.), А" value={item.i_long_a} />
        <SpecRow label="R, мОм/м" value={item.r_mohm_per_m} />
        <SpecRow label="R при 20°C, мОм/м" value={item.r_20_mohm_per_m} />
        <SpecRow label="α (темп. коэф.)" value={item.temp_coeff} />
        <SpecRow label="X, мОм/м" value={item.x_mohm_per_m} />
        <SpecRow label="Наружный Ø, мм" value={item.outer_diameter_mm} />
        <SpecRow label="Мин. радиус изгиба, мм" value={item.min_bend_radius_mm} />
        <SpecRow label="Сечение N, мм²" value={item.n_core_section_mm2} />
        <SpecRow label="Сечение PE, мм²" value={item.pe_core_section_mm2} />
        <SpecRow label="Масса, кг/м" value={item.mass_kg_per_m} />
      </div>
    </div>
  );
}

function BreakerDetail({ item }: { item: BreakerItem }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-sky-300">{item.model_name}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {item.manufacturer} · {item.series} · {item.gost_ref}
      </p>
      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
        <SpecRow label="Производитель" value={item.manufacturer} />
        <SpecRow label="Серия" value={item.series} />
        <SpecRow label="Категория" value={CATEGORY_LABELS[item.category] ?? item.category} />
        <SpecRow label="Тип" value={BREAKER_TYPE_LABELS[item.breaker_type] ?? item.breaker_type} />
        <SpecRow label="In, А" value={item.in_a} />
        <SpecRow label="Icu, кА" value={item.icu_ka} />
        <SpecRow label="Ics, кА" value={item.ics_ka} />
        <SpecRow label="Ue, В" value={item.u_e_v} />
        <SpecRow label="Uimp, кВ" value={item.u_imp_kv} />
        <SpecRow label="Кривая отключения" value={item.curve} />
        <SpecRow label="Полюса" value={item.poles} />
        <SpecRow label="С УЗО" value={item.has_rcd ? "Да" : "Нет"} />
        {item.has_rcd && (
          <>
            <SpecRow label="Тип УЗО" value={item.rcd_type} />
            <SpecRow label="IΔn, мА" value={item.rcd_in_ma} />
          </>
        )}
      </div>
    </div>
  );
}

const selectCls =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100";

export function CatalogBrowser() {
  const [tab, setTab] = useState<Tab>("cables");

  const [brands, setBrands] = useState<Array<{ id: number; name: string }>>([]);
  const [breakerMeta, setBreakerMeta] = useState<{ manufacturers: string[]; series: string[] }>({
    manufacturers: [],
    series: [],
  });

  const [cableFilters, setCableFilters] = useState({
    brand: "",
    material: "",
    construction: "",
    section_min: "",
    section_max: "",
    gost: "",
  });
  const [breakerFilters, setBreakerFilters] = useState({
    manufacturer: "",
    category: "",
    series: "",
    breaker_type: "",
    curve: "",
    poles: "",
    in_min: "",
    in_max: "",
  });

  const [cables, setCables] = useState<CableItem[]>([]);
  const [breakers, setBreakers] = useState<BreakerItem[]>([]);
  const [selectedCable, setSelectedCable] = useState<CableItem | null>(null);
  const [selectedBreaker, setSelectedBreaker] = useState<BreakerItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCableBrands().then(setBrands);
    fetchBreakersMeta().then(setBreakerMeta);
  }, []);

  const loadCables = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (cableFilters.brand) params.brand = cableFilters.brand;
      if (cableFilters.material) params.material = cableFilters.material;
      if (cableFilters.construction) params.construction = cableFilters.construction;
      if (cableFilters.section_min) params.section_min = cableFilters.section_min;
      if (cableFilters.section_max) params.section_max = cableFilters.section_max;
      if (cableFilters.gost) params.gost = cableFilters.gost;
      const data = await fetchCables(params);
      setCables(data);
      setSelectedCable((prev) => {
        if (prev && data.find((c) => c.id === prev.id)) return prev;
        return data[0] ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [cableFilters]);

  const loadBreakers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (breakerFilters.manufacturer) params.manufacturer = breakerFilters.manufacturer;
      if (breakerFilters.category) params.category = breakerFilters.category;
      if (breakerFilters.series) params.series = breakerFilters.series;
      if (breakerFilters.breaker_type) params.breaker_type = breakerFilters.breaker_type;
      if (breakerFilters.curve) params.curve = breakerFilters.curve;
      if (breakerFilters.poles) params.poles = breakerFilters.poles;
      if (breakerFilters.in_min) params.in_min = breakerFilters.in_min;
      if (breakerFilters.in_max) params.in_max = breakerFilters.in_max;
      const data = await fetchBreakers(params);
      setBreakers(data);
      setSelectedBreaker((prev) => {
        if (prev && data.find((b) => b.id === prev.id)) return prev;
        return data[0] ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [breakerFilters]);

  useEffect(() => {
    if (tab === "cables") loadCables();
  }, [tab, loadCables]);

  useEffect(() => {
    if (tab === "breakers") loadBreakers();
  }, [tab, loadBreakers]);

  const filteredCables = search
    ? cables.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : cables;
  const filteredBreakers = search
    ? breakers.filter(
        (b) =>
          b.model_name.toLowerCase().includes(search.toLowerCase()) ||
          b.series.toLowerCase().includes(search.toLowerCase())
      )
    : breakers;

  function resetCableFilters() {
    setCableFilters({
      brand: "",
      material: "",
      construction: "",
      section_min: "",
      section_max: "",
      gost: "",
    });
    setSelectedCable(null);
    setSearch("");
  }

  function resetBreakerFilters() {
    setBreakerFilters({
      manufacturer: "",
      category: "",
      series: "",
      breaker_type: "",
      curve: "",
      poles: "",
      in_min: "",
      in_max: "",
    });
    setSelectedBreaker(null);
    setSearch("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
        <button
          type="button"
          onClick={() => setTab("cables")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "cables"
              ? "bg-sky-600 text-white"
              : "bg-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          Кабели ({cables.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("breakers")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === "breakers"
              ? "bg-sky-600 text-white"
              : "bg-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          Аппараты защиты ({breakers.length})
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr_320px]">
        {/* Filters */}
        <aside className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Фильтры</h2>
            <button
              type="button"
              onClick={tab === "cables" ? resetCableFilters : resetBreakerFilters}
              className="text-xs text-sky-400 hover:underline"
            >
              Сбросить
            </button>
          </div>

          {tab === "cables" ? (
            <>
              <label className="block text-xs text-slate-500">
                Марка
                <select
                  value={cableFilters.brand}
                  onChange={(e) => setCableFilters((f) => ({ ...f, brand: e.target.value }))}
                  className={`mt-1 ${selectCls}`}
                >
                  <option value="">Все</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-500">
                Материал
                <select
                  value={cableFilters.material}
                  onChange={(e) => setCableFilters((f) => ({ ...f, material: e.target.value }))}
                  className={`mt-1 ${selectCls}`}
                >
                  <option value="">Все</option>
                  <option value="Cu">Медь</option>
                  <option value="Al">Алюминий</option>
                </select>
              </label>
              <label className="block text-xs text-slate-500">
                Исполнение
                <select
                  value={cableFilters.construction}
                  onChange={(e) => setCableFilters((f) => ({ ...f, construction: e.target.value }))}
                  className={`mt-1 ${selectCls}`}
                >
                  <option value="">Все</option>
                  {["1x", "2x", "3x", "4x", "5x"].map((c) => (
                    <option key={c} value={c}>
                      {formatConstructionLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-slate-500">
                  S от, мм²
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={cableFilters.section_min}
                    onChange={(e) =>
                      setCableFilters((f) => ({ ...f, section_min: e.target.value }))
                    }
                    className={`mt-1 ${selectCls}`}
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  S до, мм²
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={cableFilters.section_max}
                    onChange={(e) =>
                      setCableFilters((f) => ({ ...f, section_max: e.target.value }))
                    }
                    className={`mt-1 ${selectCls}`}
                  />
                </label>
              </div>
              <label className="block text-xs text-slate-500">
                ГОСТ
                <input
                  value={cableFilters.gost}
                  onChange={(e) => setCableFilters((f) => ({ ...f, gost: e.target.value }))}
                  placeholder="31996"
                  className={`mt-1 ${selectCls}`}
                />
              </label>
            </>
          ) : (
            <>
              <label className="block text-xs text-slate-500">
                Производитель
                <select
                  value={breakerFilters.manufacturer}
                  onChange={(e) =>
                    setBreakerFilters((f) => ({ ...f, manufacturer: e.target.value }))
                  }
                  className={`mt-1 ${selectCls}`}
                >
                  <option value="">Все</option>
                  {breakerMeta.manufacturers.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-500">
                Категория
                <select
                  value={breakerFilters.category}
                  onChange={(e) => setBreakerFilters((f) => ({ ...f, category: e.target.value }))}
                  className={`mt-1 ${selectCls}`}
                >
                  <option value="">Все</option>
                  <option value="household">Бытовой</option>
                  <option value="industrial">Промышленный</option>
                </select>
              </label>
              <label className="block text-xs text-slate-500">
                Серия
                <select
                  value={breakerFilters.series}
                  onChange={(e) => setBreakerFilters((f) => ({ ...f, series: e.target.value }))}
                  className={`mt-1 ${selectCls}`}
                >
                  <option value="">Все</option>
                  {breakerMeta.series.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-500">
                Тип
                <select
                  value={breakerFilters.breaker_type}
                  onChange={(e) =>
                    setBreakerFilters((f) => ({ ...f, breaker_type: e.target.value }))
                  }
                  className={`mt-1 ${selectCls}`}
                >
                  <option value="">Все</option>
                  <option value="MCB">MCB (модульный)</option>
                  <option value="MCCB">MCCB (промышленный)</option>
                </select>
              </label>
              <label className="block text-xs text-slate-500">
                Кривая
                <select
                  value={breakerFilters.curve}
                  onChange={(e) => setBreakerFilters((f) => ({ ...f, curve: e.target.value }))}
                  className={`mt-1 ${selectCls}`}
                >
                  <option value="">Все</option>
                  {["B", "C", "D"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-500">
                Полюса
                <select
                  value={breakerFilters.poles}
                  onChange={(e) => setBreakerFilters((f) => ({ ...f, poles: e.target.value }))}
                  className={`mt-1 ${selectCls}`}
                >
                  <option value="">Все</option>
                  {[1, 2, 3, 4].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-slate-500">
                  In от, А
                  <input
                    type="number"
                    min={0}
                    value={breakerFilters.in_min}
                    onChange={(e) => setBreakerFilters((f) => ({ ...f, in_min: e.target.value }))}
                    className={`mt-1 ${selectCls}`}
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  In до, А
                  <input
                    type="number"
                    min={0}
                    value={breakerFilters.in_max}
                    onChange={(e) => setBreakerFilters((f) => ({ ...f, in_max: e.target.value }))}
                    className={`mt-1 ${selectCls}`}
                  />
                </label>
              </div>
            </>
          )}
        </aside>

        {/* List */}
        <section className="flex min-h-[320px] flex-col rounded-xl border border-slate-800 bg-slate-900/20">
          <div className="border-b border-slate-800 p-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по маркировке…"
              className={`${selectCls} py-1.5 text-xs`}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-6 text-center text-sm text-slate-500">Загрузка…</p>
            ) : tab === "cables" ? (
              filteredCables.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">Ничего не найдено</p>
              ) : (
                <ul>
                  {filteredCables.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCable(c)}
                        className={`${compactListItemCls} ${
                          selectedCable?.id === c.id ? compactListItemActiveCls : ""
                        }`}
                      >
                        <span className="text-slate-200">{formatCableMarking(c.name)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : filteredBreakers.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">Ничего не найдено</p>
            ) : (
              <ul>
                {filteredBreakers.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedBreaker(b)}
                      className={`${compactListItemCls} ${
                        selectedBreaker?.id === b.id ? compactListItemActiveCls : ""
                      }`}
                    >
                      <span className="text-slate-200">{b.model_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="border-t border-slate-800 px-4 py-2 text-xs text-slate-600">
            Показано до 500 позиций. Уточните фильтры для сужения выборки.
          </p>
        </section>

        {/* Detail */}
        <aside className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 lg:sticky lg:top-4 lg:self-start">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Характеристики
          </h2>
          {tab === "cables" ? (
            selectedCable ? (
              <CableDetail item={selectedCable} />
            ) : (
              <p className="text-sm text-slate-500">Выберите кабель из списка</p>
            )
          ) : selectedBreaker ? (
            <BreakerDetail item={selectedBreaker} />
          ) : (
            <p className="text-sm text-slate-500">Выберите аппарат из списка</p>
          )}
        </aside>
      </div>
    </div>
  );
}

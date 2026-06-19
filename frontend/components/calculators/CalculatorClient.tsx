"use client";

import { useCallback, useEffect, useState } from "react";

import { calculate, fetchSchema, fetchStandards, type CalculateResponse, type StandardRef } from "@/lib/api";

import { StandardsPanel } from "@/components/StandardsPanel";
import { DynamicForm } from "./DynamicForm";
import { EngineeringChart } from "./EngineeringChart";
import { RecommendationTable } from "./RecommendationTable";
import { ResultPanel } from "./ResultPanel";

type Props = {
  slug: string;
  title: string;
  description?: string;
  standardRef?: string;
  accent?: string;
};

export function CalculatorClient({
  slug,
  title,
  description,
  standardRef,
  accent = "#38bdf8",
}: Props) {
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
  const [output, setOutput] = useState<CalculateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [standards, setStandards] = useState<StandardRef[]>([]);
  const [fetchedStandardRef, setFetchedStandardRef] = useState("");

  useEffect(() => {
    fetchSchema(slug)
      .then(setSchema)
      .catch((e) => setError(e.message));
    fetchStandards(slug).then((s) => {
      setStandards(s.standards);
      setFetchedStandardRef(s.standard_ref);
    });
  }, [slug]);

  const onSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      try {
        const res = await calculate(slug, data);
        setOutput(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка расчёта");
      } finally {
        setLoading(false);
      }
    },
    [slug]
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
        {description && <p className="mt-1 text-slate-400">{description}</p>}
        {standardRef && (
          <p className="mt-1 text-xs text-slate-500">Норматив: {standardRef}</p>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Исходные данные
          </h2>
          {schema ? (
            <DynamicForm
              schema={schema as Parameters<typeof DynamicForm>[0]["schema"]}
              onSubmit={onSubmit}
              loading={loading}
            />
          ) : (
            <p className="text-slate-500">Загрузка формы…</p>
          )}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>

        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Результат
          </h2>
          {output ? (
            <ResultPanel result={output.result} warnings={output.warnings} />
          ) : (
            <p className="text-slate-500">Введите параметры и нажмите «Рассчитать»</p>
          )}
        </div>
      </div>

      {output?.chart && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          <EngineeringChart chart={output.chart} accent={accent} />
        </div>
      )}

      {output?.recommendations && Object.keys(output.recommendations).length > 0 && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4">
          <RecommendationTable recommendations={output.recommendations as Record<string, Record<string, unknown>[]>} />
        </div>
      )}

      <StandardsPanel
        standardRef={fetchedStandardRef || standardRef}
        standards={standards}
      />
    </div>
  );
}

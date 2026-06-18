"use client";

import { useEffect, useState } from "react";

type SchemaProperty = {
  type?: string;
  title?: string;
  enum?: (string | number)[];
  default?: string | number;
  minimum?: number;
  maximum?: number;
};

type Schema = {
  properties?: Record<string, SchemaProperty>;
  required?: string[];
};

type Props = {
  schema: Schema;
  onSubmit: (data: Record<string, unknown>) => void;
  loading?: boolean;
};

export function DynamicForm({ schema, onSubmit, loading }: Props) {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      Object.entries(props).map(([key, val]) => [key, val.default ?? ""])
    )
  );

  useEffect(() => {
    setValues(
      Object.fromEntries(
        Object.entries(props).map(([key, val]) => [key, val.default ?? ""])
      )
    );
  }, [schema]);

  function handleChange(key: string, raw: string) {
    const spec = props[key];
    let value: unknown = raw;
    if (spec?.type === "number") value = raw === "" ? "" : Number(raw);
    else if (spec?.type === "integer") value = raw === "" ? "" : parseInt(raw, 10);
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const [key, spec] of Object.entries(props)) {
      const v = values[key];
      if (v === "" || v === undefined) continue;
      payload[key] = spec.type === "number" || spec.type === "integer" ? Number(v) : v;
    }
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {Object.entries(props).map(([key, spec]) => (
        <label key={key} className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">
            {spec.title ?? key}
            {required.has(key) && <span className="text-amber-400"> *</span>}
          </span>
          {spec.enum ? (
            <select
              value={String(values[key] ?? spec.default ?? "")}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              {spec.enum.map((opt) => (
                <option key={String(opt)} value={String(opt)}>
                  {opt === "1" ? "1-ф" : opt === "3" ? "3-ф" : String(opt)}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={spec.type === "number" || spec.type === "integer" ? "number" : "text"}
              step={spec.type === "number" ? "any" : undefined}
              min={spec.minimum}
              max={spec.maximum}
              value={values[key] === undefined ? "" : String(values[key])}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          )}
        </label>
      ))}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-sky-600 px-4 py-2.5 font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
      >
        {loading ? "Расчёт…" : "Рассчитать"}
      </button>
    </form>
  );
}

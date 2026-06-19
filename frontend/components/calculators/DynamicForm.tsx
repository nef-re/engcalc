"use client";

import { useEffect, useState } from "react";

import { formButtonCls, formFieldCls, formLabelCls } from "@/lib/forms";

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
    <form onSubmit={handleSubmit} className="space-y-2">
      {Object.entries(props).map(([key, spec]) => (
        <label key={key} className="block">
          <span className={formLabelCls}>
            {spec.title ?? key}
            {required.has(key) && <span className="text-amber-400"> *</span>}
          </span>
          {spec.enum ? (
            <select
              value={String(values[key] ?? spec.default ?? "")}
              onChange={(e) => handleChange(key, e.target.value)}
              className={formFieldCls}
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
              className={formFieldCls}
            />
          )}
        </label>
      ))}
      <button type="submit" disabled={loading} className={formButtonCls}>
        {loading ? "Расчёт…" : "Рассчитать"}
      </button>
    </form>
  );
}

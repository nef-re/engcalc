"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type ChartData = {
  type: string;
  title?: string;
  x_label?: string;
  y_label?: string;
  limit_y?: number;
  series?: Array<{ name: string; data?: unknown[]; value?: number }>;
};

type Props = {
  chart: ChartData | null | undefined;
  accent?: string;
};

export function EngineeringChart({ chart, accent = "#38bdf8" }: Props) {
  const option = useMemo(() => {
    if (!chart) return null;

    if (chart.type === "pie" && chart.series) {
      return {
        tooltip: { trigger: "item" },
        legend: { bottom: 0, textStyle: { color: "#94a3b8" } },
        series: [
          {
            type: "pie",
            radius: ["40%", "70%"],
            data: chart.series.map((s) => ({ name: s.name, value: s.value })),
            itemStyle: { borderRadius: 6 },
            color: [accent, "#fbbf24", "#34d399"],
          },
        ],
      };
    }

    if (chart.type === "line" && chart.series?.[0]?.data) {
      const data = chart.series[0].data as [number, number][];
      const markLine = chart.limit_y
        ? {
            silent: true,
            data: [{ yAxis: chart.limit_y, name: "Предел" }],
            lineStyle: { color: "#f87171", type: "dashed" },
            label: { formatter: `${chart.limit_y}%` },
          }
        : undefined;

      return {
        title: chart.title
          ? { text: chart.title, textStyle: { color: "#e2e8f0", fontSize: 14 } }
          : undefined,
        tooltip: { trigger: "axis" },
        grid: { left: 48, right: 24, top: 40, bottom: 40 },
        xAxis: {
          type: "value",
          name: chart.x_label,
          nameTextStyle: { color: "#94a3b8" },
          axisLine: { lineStyle: { color: "#475569" } },
          splitLine: { lineStyle: { color: "#1e293b" } },
        },
        yAxis: {
          type: "value",
          name: chart.y_label,
          nameTextStyle: { color: "#94a3b8" },
          axisLine: { lineStyle: { color: "#475569" } },
          splitLine: { lineStyle: { color: "#1e293b" } },
        },
        series: [
          {
            name: chart.series[0].name,
            type: "line",
            smooth: true,
            data,
            areaStyle: { color: `${accent}22` },
            lineStyle: { color: accent, width: 2 },
            itemStyle: { color: accent },
            markLine,
          },
        ],
      };
    }

    return null;
  }, [chart, accent]);

  if (!option) return null;

  return (
    <div className="h-72 w-full rounded-xl border border-slate-700/60 bg-slate-900/50 p-2">
      <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

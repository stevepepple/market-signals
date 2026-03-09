import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ThemeSignal } from "../types";

interface SignalChartProps {
  themeSignals: Record<string, ThemeSignal>;
  dark?: boolean;
}

export default function SignalChart({ themeSignals, dark = false }: SignalChartProps) {
  const data = Object.values(themeSignals)
    .sort((a, b) => a.magnitude - b.magnitude)
    .map((s) => ({ name: s.label, magnitude: s.magnitude }));

  if (data.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">No signal data to chart.</p>;
  }

  const height = Math.max(data.length * 40 + 40, 200);

  const tickColor = dark ? "#9ca3af" : "#6b7280";
  const labelColor = dark ? "#d1d5db" : "#374151";
  const axisStroke = dark ? "#374151" : "#e5e7eb";
  const tooltipBg = dark ? "#1f2937" : "#ffffff";
  const tooltipBorder = dark ? "#374151" : "#e5e7eb";
  const tooltipText = dark ? "#f3f4f6" : "#111827";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart layout="vertical" data={data} margin={{ left: 20, right: 20 }}>
        <XAxis
          type="number"
          domain={[0, "auto"]}
          tick={{ fill: tickColor, fontSize: 12 }}
          axisLine={{ stroke: axisStroke }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fill: labelColor, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: 8,
            color: tooltipText,
          }}
        />
        <Bar dataKey="magnitude" fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

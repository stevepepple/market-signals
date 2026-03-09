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
}

export default function SignalChart({ themeSignals }: SignalChartProps) {
  const data = Object.values(themeSignals)
    .sort((a, b) => a.magnitude - b.magnitude)
    .map((s) => ({ name: s.label, magnitude: s.magnitude }));

  if (data.length === 0) {
    return <p className="text-gray-400">No signal data to chart.</p>;
  }

  const height = Math.max(data.length * 40 + 40, 200);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart layout="vertical" data={data} margin={{ left: 20, right: 20 }}>
        <XAxis
          type="number"
          domain={[0, "auto"]}
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          axisLine={{ stroke: "#374151" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={120}
          tick={{ fill: "#d1d5db", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            borderRadius: 8,
            color: "#f3f4f6",
          }}
        />
        <Bar dataKey="magnitude" fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

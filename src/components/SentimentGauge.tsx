import type { SentimentReading } from "../types/economic";

function getGaugeColor(score: number): string {
  if (score <= 25) return "bg-red-500";
  if (score <= 45) return "bg-orange-400";
  if (score <= 55) return "bg-yellow-400";
  if (score <= 75) return "bg-lime-400";
  return "bg-green-500";
}

function GaugeBar({ reading }: { reading: SentimentReading }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {reading.source === "cnn_fear_greed" ? "Fear & Greed" : reading.source === "crypto_fear_greed" ? "Crypto F&G" : "VIX"}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          {reading.source === "vix" ? reading.score.toFixed(1) : `${reading.score}/100`}
          {reading.stale && " (stale)"}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={`h-2 rounded-full transition-all ${getGaugeColor(reading.source === "vix" ? 100 - Math.min(reading.score * 2, 100) : reading.score)}`}
          style={{ width: `${reading.source === "vix" ? Math.min(reading.score * 2, 100) : reading.score}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">{reading.label}</span>
    </div>
  );
}

export default function SentimentGauge({ readings }: { readings: SentimentReading[] }) {
  if (readings.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Market Sentiment</h3>
      <div className="flex flex-col gap-3">
        {readings.map((r) => (
          <GaugeBar key={r.source} reading={r} />
        ))}
      </div>
    </div>
  );
}

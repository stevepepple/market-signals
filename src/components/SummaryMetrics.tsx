interface SummaryMetricsProps {
  totalMarkets: number;
  themedMarkets: number;
  strongSignals: number;
  kalshiCount: number;
  polymarketCount: number;
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-100">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export default function SummaryMetrics({
  totalMarkets,
  themedMarkets,
  strongSignals,
  kalshiCount,
  polymarketCount,
}: SummaryMetricsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <MetricCard label="Total Markets" value={totalMarkets} />
      <MetricCard label="Themed Markets" value={themedMarkets} />
      <MetricCard label="Strong Signals" value={strongSignals} />
      <MetricCard label="Kalshi Markets" value={kalshiCount} />
      <MetricCard label="Polymarket Markets" value={polymarketCount} />
    </div>
  );
}

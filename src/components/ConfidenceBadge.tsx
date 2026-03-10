import type { ThemeConfidence } from "../types/economic";

export default function ConfidenceBadge({ confidence }: { confidence?: ThemeConfidence }) {
  if (!confidence || confidence.status === "neutral") return null;

  const isConfirmed = confidence.status === "confirmed";
  const bgColor = isConfirmed ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30";
  const textColor = isConfirmed ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400";
  const label = isConfirmed ? "Confirmed" : "Divergence";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${bgColor} ${textColor}`}
      title={confidence.reason}
    >
      <span>{isConfirmed ? "\u2713" : "\u26A0"}</span>
      {label}
    </span>
  );
}

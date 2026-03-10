export interface EconomicIndicator {
  series_id: string;
  theme: string;
  label: string;
  value: number;
  date: string;
  previous_value: number;
  change_pct: number;
}

export interface CalendarEvent {
  date: string;
  event: string;
  impact: "low" | "medium" | "high";
  themes: string[];
  actual?: number;
  estimate?: number;
  previous?: number;
  source: "finnhub" | "fred";
}

export interface SentimentReading {
  source: string;
  score: number;
  label: string;
  timestamp: string;
  stale?: boolean;
  sub_indicators?: Record<string, number>;
}

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  datetime: string;
  themes: string[];
  sentiment?: number;
}

export interface ThemeConfidence {
  status: "confirmed" | "divergent" | "neutral";
  reason: string;
}

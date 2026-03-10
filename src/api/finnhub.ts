import type { CalendarEvent, NewsItem } from "../types/economic";
import { SIGNAL_THEMES } from "../lib/config";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

function classifyText(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const [key, config] of Object.entries(SIGNAL_THEMES)) {
    for (const kw of config.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        matched.push(key);
        break;
      }
    }
  }
  return matched;
}

export async function fetchEconomicCalendar(
  apiKey: string,
  fromDate: string,
  toDate: string,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ from: fromDate, to: toDate, token: apiKey });
  const resp = await fetch(`${FINNHUB_BASE}/calendar/economic?${params}`);
  if (!resp.ok) throw new Error(`Finnhub economic calendar error: ${resp.status}`);

  const data = await resp.json();
  const events = data.economicCalendar ?? [];

  return events
    .filter((e: { country: string }) => e.country === "US")
    .map((e: Record<string, unknown>) => ({
      date: e.date as string,
      event: e.event as string,
      impact: (e.impact as string) || "medium",
      themes: classifyText(e.event as string),
      actual: e.actual != null ? Number(e.actual) : undefined,
      estimate: e.estimate != null ? Number(e.estimate) : undefined,
      previous: e.prev != null ? Number(e.prev) : undefined,
      source: "finnhub" as const,
    }));
}

export async function fetchEarningsCalendar(
  apiKey: string,
  fromDate: string,
  toDate: string,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ from: fromDate, to: toDate, token: apiKey });
  const resp = await fetch(`${FINNHUB_BASE}/calendar/earnings?${params}`);
  if (!resp.ok) throw new Error(`Finnhub earnings calendar error: ${resp.status}`);

  const data = await resp.json();
  const earnings = data.earningsCalendar ?? [];

  return earnings.map((e: Record<string, unknown>) => ({
    date: e.date as string,
    event: `${e.symbol} earnings (Q${e.quarter})`,
    impact: "medium" as const,
    themes: [],
    estimate: e.epsEstimate != null ? Number(e.epsEstimate) : undefined,
    actual: e.epsActual != null ? Number(e.epsActual) : undefined,
    source: "finnhub" as const,
  }));
}

export async function fetchMarketNews(
  apiKey: string,
  category = "general",
): Promise<NewsItem[]> {
  const params = new URLSearchParams({ category, token: apiKey });
  const resp = await fetch(`${FINNHUB_BASE}/news?${params}`);
  if (!resp.ok) throw new Error(`Finnhub news error: ${resp.status}`);

  const articles: Record<string, unknown>[] = await resp.json();

  return articles.slice(0, 50).map((a) => ({
    headline: a.headline as string,
    source: a.source as string,
    url: a.url as string,
    datetime: new Date((a.datetime as number) * 1000).toISOString(),
    themes: classifyText(`${a.headline} ${a.summary ?? ""}`),
    sentiment: undefined,
  }));
}

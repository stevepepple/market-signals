import type { EconomicIndicator, CalendarEvent, SentimentReading, NewsItem } from "../types/economic";

async function loadJson<T>(path: string): Promise<T[]> {
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/${path}`);
    if (!resp.ok) return [];
    return await resp.json();
  } catch {
    return [];
  }
}

export function loadEconomicData(): Promise<EconomicIndicator[]> {
  return loadJson<EconomicIndicator>("economic.json");
}

export function loadCalendarData(): Promise<CalendarEvent[]> {
  return loadJson<CalendarEvent>("calendar.json");
}

export function loadSentimentData(): Promise<SentimentReading[]> {
  return loadJson<SentimentReading>("sentiment.json");
}

export function loadNewsData(): Promise<NewsItem[]> {
  return loadJson<NewsItem>("news.json");
}

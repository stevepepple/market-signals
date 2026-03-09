import type { NormalizedMarket } from "../types";
import {
  KALSHI_BASE_URL,
  POLYMARKET_GAMMA_URL,
  SIGNAL_THEMES,
  MIN_VOLUME_KALSHI,
  MIN_VOLUME_POLYMARKET,
  REQUEST_TIMEOUT_MS,
} from "../lib/config";

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(id);
  }
}

export async function fetchKalshiMarkets(limit = 200): Promise<any[]> {
  const all: any[] = [];
  let cursor = "";
  try {
    while (true) {
      const params = new URLSearchParams({ limit: String(limit), status: "open" });
      if (cursor) params.set("cursor", cursor);
      const resp = await fetchWithTimeout(`${KALSHI_BASE_URL}/markets?${params}`);
      if (!resp.ok) break;
      const data = await resp.json();
      const markets = data.markets ?? [];
      all.push(...markets);
      cursor = data.cursor ?? "";
      if (!cursor || markets.length < limit || all.length >= 1000) break;
    }
  } catch (e) {
    console.warn("Kalshi API error:", e);
  }
  return all;
}

export async function fetchPolymarketMarkets(limit = 100): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  try {
    while (true) {
      const params = new URLSearchParams({
        limit: String(limit),
        active: "true",
        closed: "false",
        order: "volume24hr",
        ascending: "false",
        offset: String(offset),
      });
      const resp = await fetchWithTimeout(`${POLYMARKET_GAMMA_URL}/markets?${params}`);
      if (!resp.ok) break;
      const markets = await resp.json();
      if (!markets.length) break;
      all.push(...markets);
      offset += limit;
      if (all.length >= 500) break;
    }
  } catch (e) {
    console.warn("Polymarket API error:", e);
  }
  return all;
}

export function normalizeKalshiMarket(market: any): NormalizedMarket {
  let yesPrice = market.last_price ?? 0;
  if (yesPrice > 1) yesPrice = yesPrice / 100;
  return {
    source: "kalshi",
    id: market.ticker ?? "",
    event_id: market.event_ticker ?? "",
    title: market.title ?? "",
    subtitle: market.subtitle ?? "",
    yes_price: yesPrice,
    no_price: yesPrice ? 1 - yesPrice : null,
    volume_24h: market.volume_24h ?? 0,
    open_interest: market.open_interest ?? 0,
    status: market.status ?? "",
    close_time: market.close_time ?? "",
    url: `https://kalshi.com/markets/${market.event_ticker ?? ""}`,
    themes: [],
  };
}

export function normalizePolymarketMarket(market: any): NormalizedMarket {
  let outcomePrices = market.outcomePrices ?? [];
  if (typeof outcomePrices === "string") {
    try {
      outcomePrices = JSON.parse(outcomePrices);
    } catch {
      outcomePrices = [];
    }
  }
  const yesPrice = outcomePrices.length > 0 ? Number(outcomePrices[0]) : null;
  const noPrice = outcomePrices.length > 1 ? Number(outcomePrices[1]) : null;
  return {
    source: "polymarket",
    id: market.id ?? "",
    event_id: market.groupItemTitle ?? "",
    title: market.question ?? "",
    subtitle: "",
    yes_price: yesPrice,
    no_price: noPrice,
    volume_24h: Number(market.volume24hr ?? 0),
    open_interest: Number(market.liquidityNum ?? 0),
    status: market.active ? "open" : "closed",
    close_time: market.endDate ?? "",
    url: `https://polymarket.com/event/${market.slug ?? ""}`,
    themes: [],
  };
}

export function classifyMarket(market: NormalizedMarket): string[] {
  const text = `${market.title} ${market.subtitle}`.toLowerCase();
  const matched: string[] = [];
  for (const [themeKey, config] of Object.entries(SIGNAL_THEMES)) {
    for (const keyword of config.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matched.push(themeKey);
        break;
      }
    }
  }
  return matched;
}

export function isStrongSignal(market: NormalizedMarket, threshold = 0.75): boolean {
  const price = market.yes_price;
  if (price === null) return false;
  return price >= threshold || price <= 1 - threshold;
}

export async function fetchAndClassifyAll(options: {
  kalshi?: boolean;
  polymarket?: boolean;
  volumeFilter?: boolean;
}): Promise<NormalizedMarket[]> {
  const { kalshi = true, polymarket = true, volumeFilter = true } = options;
  const all: NormalizedMarket[] = [];

  const [kalshiRaw, polyRaw] = await Promise.all([
    kalshi ? fetchKalshiMarkets() : Promise.resolve([]),
    polymarket ? fetchPolymarketMarkets() : Promise.resolve([]),
  ]);

  for (const m of kalshiRaw) {
    const normalized = normalizeKalshiMarket(m);
    if (volumeFilter && normalized.volume_24h < MIN_VOLUME_KALSHI) continue;
    normalized.themes = classifyMarket(normalized);
    all.push(normalized);
  }

  for (const m of polyRaw) {
    const normalized = normalizePolymarketMarket(m);
    if (volumeFilter && normalized.volume_24h < MIN_VOLUME_POLYMARKET) continue;
    normalized.themes = classifyMarket(normalized);
    all.push(normalized);
  }

  return all;
}

export async function loadFallbackData(): Promise<NormalizedMarket[]> {
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/markets.json`);
    if (!resp.ok) return [];
    const data: NormalizedMarket[] = await resp.json();
    return data;
  } catch {
    return [];
  }
}

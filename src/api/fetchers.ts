import type { NormalizedMarket, InsiderTrade } from "../types";
import {
  SIGNAL_THEMES,
  MIN_VOLUME_KALSHI,
  MIN_VOLUME_POLYMARKET,
} from "../lib/config";

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

/** Load market data from the static JSON file (refreshed by cron). */
export async function loadMarketData(options: {
  kalshi?: boolean;
  polymarket?: boolean;
  volumeFilter?: boolean;
}): Promise<NormalizedMarket[]> {
  const { kalshi = true, polymarket = true, volumeFilter = true } = options;

  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/markets.json`);
    if (!resp.ok) return [];
    const data: NormalizedMarket[] = await resp.json();

    return data.filter((m) => {
      // Source filter
      if (!kalshi && m.source === "kalshi") return false;
      if (!polymarket && m.source === "polymarket") return false;

      // Volume filter
      if (volumeFilter) {
        if (m.source === "kalshi" && m.volume_24h < MIN_VOLUME_KALSHI) return false;
        if (m.source === "polymarket" && m.volume_24h < MIN_VOLUME_POLYMARKET) return false;
      }

      // Re-classify with latest themes (in case config changed since data was fetched)
      if (!m.themes || m.themes.length === 0) {
        m.themes = classifyMarket(m);
      }

      return true;
    });
  } catch {
    return [];
  }
}

/** Load portfolio holdings from static JSON. */
export async function loadPortfolioHoldings(): Promise<Set<string>> {
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/portfolio.json`);
    if (!resp.ok) return new Set();
    const data = await resp.json();
    return new Set((data.holdings || []).map((h: { symbol: string }) => h.symbol));
  } catch {
    return new Set();
  }
}

/** Load insider trade data from the static JSON file (refreshed by cron). */
export async function loadInsiderTrades(): Promise<InsiderTrade[]> {
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/insider-trades.json`);
    if (!resp.ok) return [];
    return await resp.json();
  } catch {
    return [];
  }
}

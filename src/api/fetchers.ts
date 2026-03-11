import type { NormalizedMarket, InsiderTrade } from "../types";
import {
  SIGNAL_THEMES,
  MIN_VOLUME_KALSHI,
  MIN_VOLUME_POLYMARKET,
} from "../lib/config";

/** Patterns that indicate sports, entertainment, or other non-financial markets. */
const EXCLUDE_PATTERNS = [
  /\bvs\.\s/i,                    // "Team vs. Team"
  /\bspread:\s/i,                 // "Spread: Team (-3.5)"
  /\bo\/u\s\d/i,                  // "O/U 227.5"
  /\bmoneyline\b/i,
  /\bnba\b/i, /\bnfl\b/i, /\bmlb\b/i, /\bnhl\b/i, /\bmls\b/i, /\bufc\b/i,
  /\bserie a\b/i, /\bpremier league\b/i, /\bla liga\b/i, /\bbundesliga\b/i,
  /\bsuper bowl\b/i, /\bworld series\b/i, /\bstanley cup\b/i,
  /\bgrand prix\b/i, /\bformula [12]\b/i,
  /win the \d{4}.*\b(mvp|finals|championship|playoff|conference|trophy|cup|bowl)\b/i,
  /\b(oscar|emmy|grammy|golden globe|academy award|best picture|best director|best actor|best actress)\b/i,
  /\bnobel\b/i,
  /\bballon d'or\b/i,
  /win the \d{4}.*(presidential|democratic|republican|gubernatorial|senate|governor)\b/i,
  /\bcounter-strike\b/i, /\besports?\b/i, /\b(bo[123])\b/i,
];

function isNonFinancialMarket(title: string): boolean {
  return EXCLUDE_PATTERNS.some((pattern) => pattern.test(title));
}

function keywordMatches(text: string, keyword: string): boolean {
  if (keyword.includes("\\b")) {
    // Keyword uses word-boundary markers — treat as regex
    try {
      return new RegExp(keyword, "i").test(text);
    } catch {
      return false;
    }
  }
  return text.includes(keyword.toLowerCase());
}

export function classifyMarket(market: NormalizedMarket): string[] {
  if (isNonFinancialMarket(market.title)) return [];

  const text = `${market.title} ${market.subtitle}`.toLowerCase();
  const matched: string[] = [];
  for (const [themeKey, config] of Object.entries(SIGNAL_THEMES)) {
    for (const keyword of config.keywords) {
      if (keywordMatches(text, keyword)) {
        matched.push(themeKey);
        break;
      }
    }
  }
  return matched;
}

/** Classify and return matched keywords for transparency. */
export function classifyMarketWithReasons(market: NormalizedMarket): { themes: string[]; matched_keywords: Record<string, string> } {
  if (isNonFinancialMarket(market.title)) return { themes: [], matched_keywords: {} };

  const text = `${market.title} ${market.subtitle}`.toLowerCase();
  const themes: string[] = [];
  const matched_keywords: Record<string, string> = {};

  for (const [themeKey, config] of Object.entries(SIGNAL_THEMES)) {
    for (const keyword of config.keywords) {
      if (keywordMatches(text, keyword)) {
        themes.push(themeKey);
        matched_keywords[themeKey] = keyword.replace(/\\b/g, "");
        break;
      }
    }
  }
  return { themes, matched_keywords };
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

/** Load portfolio holdings from static JSON (supports multi-account format). */
export async function loadPortfolioHoldings(): Promise<Set<string>> {
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/portfolio.json`);
    if (!resp.ok) return new Set();
    const data = await resp.json();
    const symbols = new Set<string>();
    if (data.accounts) {
      for (const account of data.accounts) {
        for (const h of account.holdings || []) symbols.add(h.symbol);
      }
    } else if (data.holdings) {
      for (const h of data.holdings) symbols.add(h.symbol);
    }
    return symbols;
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

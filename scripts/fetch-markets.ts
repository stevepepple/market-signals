/**
 * Server-side market data fetcher.
 * Runs via GitHub Actions cron — fetches from Kalshi + Polymarket APIs,
 * classifies markets by theme, and writes to public/data/markets.json.
 *
 * Usage: npx tsx scripts/fetch-markets.ts
 */

import { writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../public/data/markets.json");
const INSIDER_OUTPUT_PATH = resolve(__dirname, "../public/data/insider-trades.json");

const KALSHI_API_URLS = [
  "https://trading-api.kalshi.com/trade-api/v2",
  "https://api.elections.kalshi.com/trade-api/v2",
];
const POLYMARKET_GAMMA_URL = "https://gamma-api.polymarket.com";
const MIN_VOLUME_KALSHI = 1000;
const MIN_VOLUME_POLYMARKET = 5000;
const REQUEST_TIMEOUT_MS = 15000;

// Mirror of SIGNAL_THEMES from config.ts (keep in sync)
const SIGNAL_THEMES: Record<string, { label: string; keywords: string[] }> = {
  fed_rate: { label: "Fed Interest Rate Decisions", keywords: ["fed", "interest rate", "fomc", "federal reserve", "rate cut", "rate hike"] },
  inflation: { label: "Inflation / CPI", keywords: ["inflation", "cpi", "consumer price", "pce"] },
  recession: { label: "Recession Probability", keywords: ["recession", "gdp", "economic contraction", "nber", "economic growth", "gdp growth"] },
  tariffs_trade: { label: "Tariffs & Trade Policy", keywords: ["tariff", "trade war", "import duty", "trade policy", "trade deal"] },
  tech_regulation: { label: "Tech Regulation & Antitrust", keywords: ["antitrust", "tech regulation", "big tech", "breakup", "ftc"] },
  crypto: { label: "Crypto & Digital Assets", keywords: ["bitcoin", "crypto", "ethereum", "btc", "digital asset", "stablecoin"] },
  energy_climate: { label: "Energy & Climate Policy", keywords: ["oil price", "energy", "climate", "renewable", "ev mandate", "drilling", "crude oil", "natural gas", "opec", "oil production"] },
  geopolitical: { label: "Geopolitical Risk", keywords: ["war", "conflict", "sanctions", "nato", "china", "taiwan", "russia", "ukraine", "iran", "strike", "ceasefire", "regime", "invasion", "military", "troops", "forces enter"] },
  ai_tech: { label: "AI & Technology", keywords: ["artificial intelligence", "ai", "openai", "gpu", "nvidia", "chatgpt", "agi"] },
  housing: { label: "Housing Market", keywords: ["housing", "home price", "mortgage", "real estate", "home sales"] },
  employment: { label: "Jobs & Employment", keywords: ["jobs", "unemployment", "nonfarm", "payroll", "labor", "employment", "jobless claims", "jobs report", "job growth"] },
  government_shutdown: { label: "Government Shutdown / Debt Ceiling", keywords: ["shutdown", "debt ceiling", "government funding", "default"] },
  healthcare_biotech: { label: "Healthcare & Biotech", keywords: ["drug approval", "fda", "medicare", "biotech", "pharmaceutical", "vaccine", "clinical trial", "medicaid"] },
  financials_banking: { label: "Financials & Banking", keywords: ["bank regulation", "fdic", "fintech", "credit", "banking crisis", "bank failure", "dodd-frank", "basel"] },
  commodities_agriculture: { label: "Commodities & Agriculture", keywords: ["gold price", "silver", "wheat", "crop", "commodity", "corn", "soybean", "copper", "mining"] },
  defense_aerospace: { label: "Defense & Aerospace", keywords: ["defense spending", "military", "nato budget", "space", "pentagon", "arms deal", "missile", "drone"] },
  consumer_retail: { label: "Consumer & Retail", keywords: ["consumer spending", "retail sales", "consumer confidence", "holiday spending", "e-commerce", "consumer sentiment"] },
  stock_market: { label: "Stock Market & Indices", keywords: ["s&p 500", "s&p500", "sp500", "spy", "nasdaq", "dow jones", "djia", "stock market", "russell 2000", "market crash", "bear market", "bull market", "equity market", "stock index"] },
  treasury_bonds: { label: "Treasury & Bond Yields", keywords: ["treasury yield", "10-year yield", "bond yield", "treasury bond", "2-year yield", "yield curve", "10 year treasury", "30-year bond", "t-bill", "treasury rate"] },
  dollar_forex: { label: "US Dollar & Forex", keywords: ["us dollar", "dollar index", "dxy", "forex", "euro dollar", "eur/usd", "usd/jpy", "currency", "dollar strength", "dollar weakness", "exchange rate"] },
};

interface NormalizedMarket {
  source: "kalshi" | "polymarket";
  id: string;
  event_id: string;
  title: string;
  subtitle: string;
  yes_price: number | null;
  no_price: number | null;
  volume_24h: number;
  open_interest: number;
  status: string;
  close_time: string;
  url: string;
  themes: string[];
}

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function fetchWithTimeout(url: string, headers?: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, headers });
  } finally {
    clearTimeout(id);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyMarket(title: string, subtitle: string): string[] {
  const text = `${title} ${subtitle}`.toLowerCase();
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

async function fetchKalshiMarkets(): Promise<NormalizedMarket[]> {
  // Try each API URL until one works (trading-api requires auth, elections is public)
  for (let i = 0; i < KALSHI_API_URLS.length; i++) {
    if (i > 0) await delay(2000); // Avoid rate limiting between attempts
    const baseUrl = KALSHI_API_URLS[i];
    console.log(`Trying Kalshi API: ${baseUrl}`);
    const results = await fetchKalshiFromUrl(baseUrl);
    if (results.length > 0) return results;
  }
  console.error("All Kalshi API endpoints failed");
  return [];
}

async function fetchKalshiFromUrl(baseUrl: string): Promise<NormalizedMarket[]> {
  const results: NormalizedMarket[] = [];
  let cursor = "";
  const limit = 200;

  try {
    while (true) {
      const params = new URLSearchParams({ limit: String(limit), status: "open" });
      if (cursor) params.set("cursor", cursor);
      const resp = await fetchWithTimeout(`${baseUrl}/markets?${params}`);
      if (!resp.ok) {
        console.error(`Kalshi API error (${baseUrl}): ${resp.status} ${resp.statusText}`);
        break;
      }
      const data = await resp.json();
      const markets = data.markets ?? [];

      for (const m of markets) {
        let yesPrice = m.last_price ?? 0;
        if (yesPrice > 1) yesPrice = yesPrice / 100;
        const volume = m.volume_24h ?? 0;
        if (volume < MIN_VOLUME_KALSHI) continue;

        const normalized: NormalizedMarket = {
          source: "kalshi",
          id: m.ticker ?? "",
          event_id: m.event_ticker ?? "",
          title: m.title ?? "",
          subtitle: m.subtitle ?? "",
          yes_price: yesPrice,
          no_price: yesPrice ? 1 - yesPrice : null,
          volume_24h: volume,
          open_interest: m.open_interest ?? 0,
          status: m.status ?? "",
          close_time: m.close_time ?? "",
          url: `https://kalshi.com/markets/${m.event_ticker ?? ""}`,
          themes: [],
        };
        normalized.themes = classifyMarket(normalized.title, normalized.subtitle);
        results.push(normalized);
      }

      cursor = data.cursor ?? "";
      if (!cursor || markets.length < limit || results.length >= 1000) break;
    }
  } catch (e) {
    console.error("Kalshi fetch error:", e);
  }

  return results;
}

async function fetchPolymarketMarkets(): Promise<NormalizedMarket[]> {
  const results: NormalizedMarket[] = [];
  let offset = 0;
  const limit = 100;

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
      if (!resp.ok) {
        console.error(`Polymarket API error: ${resp.status} ${resp.statusText}`);
        break;
      }
      const markets = await resp.json();
      if (!markets.length) break;

      for (const m of markets) {
        let outcomePrices = m.outcomePrices ?? [];
        if (typeof outcomePrices === "string") {
          try { outcomePrices = JSON.parse(outcomePrices); } catch { outcomePrices = []; }
        }
        const yesPrice = outcomePrices.length > 0 ? Number(outcomePrices[0]) : null;
        const noPrice = outcomePrices.length > 1 ? Number(outcomePrices[1]) : null;
        const volume = Number(m.volume24hr ?? 0);
        if (volume < MIN_VOLUME_POLYMARKET) continue;

        const normalized: NormalizedMarket = {
          source: "polymarket",
          id: m.id ?? "",
          event_id: m.groupItemTitle ?? "",
          title: m.question ?? "",
          subtitle: "",
          yes_price: yesPrice,
          no_price: noPrice,
          volume_24h: volume,
          open_interest: Number(m.liquidityNum ?? 0),
          status: m.active ? "open" : "closed",
          close_time: m.endDate ?? "",
          url: `https://polymarket.com/event/${m.slug ?? ""}`,
          themes: [],
        };
        normalized.themes = classifyMarket(normalized.title, normalized.subtitle);
        results.push(normalized);
      }

      offset += limit;
      if (results.length >= 500) break;
    }
  } catch (e) {
    console.error("Polymarket fetch error:", e);
  }

  return results;
}

interface InsiderTrade {
  filing_date: string;
  trade_date: string;
  ticker: string;
  company_name: string;
  insider_name: string;
  title: string;
  trade_type: "Purchase" | "Sale";
  price: number;
  qty: number;
  value: number;
  url: string;
}

function parseInsiderTable(html: string, tradeType: "Purchase" | "Sale"): InsiderTrade[] {
  const results: InsiderTrade[] = [];
  // Find the tinytable tbody rows
  const tbodyMatch = html.match(/<table[^>]*class="[^"]*tinytable[^"]*"[^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return results;

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tbodyMatch[1])) !== null) {
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      // Strip HTML tags and trim
      cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
    }
    // Expected columns: [indicator], Filing Date, Trade Date, Ticker, Company, Insider, Title, Trade Type, Price, Qty, Owned, ΔOwn, Value
    if (cells.length < 12) continue;

    const ticker = cells[3].replace(/\s/g, "");
    if (!ticker) continue;

    const priceStr = cells[7].replace(/[$,]/g, "");
    const qtyStr = cells[8].replace(/[+,]/g, "");
    const valueStr = cells[11].replace(/[$,+]/g, "");

    const price = parseFloat(priceStr) || 0;
    const qty = parseInt(qtyStr) || 0;
    const value = parseInt(valueStr) || 0;

    if (value < 25000) continue; // Only significant trades

    results.push({
      filing_date: cells[1],
      trade_date: cells[2],
      ticker,
      company_name: cells[4],
      insider_name: cells[5],
      title: cells[6],
      trade_type: tradeType,
      price,
      qty: Math.abs(qty),
      value: Math.abs(value),
      url: `http://openinsider.com/screener?s=${encodeURIComponent(ticker)}&o=&pl=&ph=&ll=&lh=&fd=30&td=0&tdr=&fdlyl=&fdlyh=&daysago=&xp=1&vl=25000&vh=&sortcol=0&cnt=100`,
    });
  }
  return results;
}

async function fetchInsiderTrades(): Promise<InsiderTrade[]> {
  const results: InsiderTrade[] = [];
  const pages = [
    { url: "http://openinsider.com/top-insider-purchases-of-the-week", type: "Purchase" as const },
    { url: "http://openinsider.com/top-insider-sales-of-the-week", type: "Sale" as const },
  ];

  for (const page of pages) {
    try {
      const resp = await fetchWithTimeout(page.url, { "User-Agent": BROWSER_UA, "Accept": "text/html" });
      if (!resp.ok) {
        console.error(`OpenInsider error for ${page.type}: ${resp.status}`);
        continue;
      }
      const html = await resp.text();
      const trades = parseInsiderTable(html, page.type);
      results.push(...trades);
      console.log(`Fetched ${trades.length} insider ${page.type.toLowerCase()}s from OpenInsider`);
    } catch (e) {
      console.error(`OpenInsider fetch error (${page.type}):`, e);
    }
  }

  return results.sort((a, b) => b.value - a.value);
}

function writeIfChanged(path: string, newData: string, label: string): void {
  let existingData = "";
  try {
    existingData = readFileSync(path, "utf-8");
  } catch {
    // File doesn't exist yet
  }
  if (existingData === newData) {
    console.log(`${label}: no changes detected — skipping write.`);
  } else {
    writeFileSync(path, newData);
    console.log(`${label}: wrote to ${path}`);
  }
}

async function main() {
  console.log("Fetching market data...");

  const [kalshi, polymarket, insiderTrades] = await Promise.all([
    fetchKalshiMarkets(),
    fetchPolymarketMarkets(),
    fetchInsiderTrades(),
  ]);

  const allMarkets = [...kalshi, ...polymarket];
  console.log(`Fetched ${kalshi.length} Kalshi + ${polymarket.length} Polymarket = ${allMarkets.length} total markets`);

  const themed = allMarkets.filter((m) => m.themes.length > 0);
  console.log(`${themed.length} markets classified into themes`);
  console.log(`${insiderTrades.length} insider trades from OpenInsider`);

  writeIfChanged(OUTPUT_PATH, JSON.stringify(allMarkets, null, 2), "Markets");
  writeIfChanged(INSIDER_OUTPUT_PATH, JSON.stringify(insiderTrades, null, 2), "Insider trades");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});

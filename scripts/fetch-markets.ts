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

const KALSHI_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";
const POLYMARKET_GAMMA_URL = "https://gamma-api.polymarket.com";
const MIN_VOLUME_KALSHI = 1000;
const MIN_VOLUME_POLYMARKET = 5000;
const REQUEST_TIMEOUT_MS = 15000;

// Mirror of SIGNAL_THEMES from config.ts (keep in sync)
const SIGNAL_THEMES: Record<string, { label: string; keywords: string[] }> = {
  fed_rate: { label: "Fed Interest Rate Decisions", keywords: ["fed", "interest rate", "fomc", "federal reserve", "rate cut", "rate hike"] },
  inflation: { label: "Inflation / CPI", keywords: ["inflation", "cpi", "consumer price", "pce"] },
  recession: { label: "Recession Probability", keywords: ["recession", "gdp", "economic contraction", "nber"] },
  tariffs_trade: { label: "Tariffs & Trade Policy", keywords: ["tariff", "trade war", "import duty", "trade policy", "trade deal"] },
  tech_regulation: { label: "Tech Regulation & Antitrust", keywords: ["antitrust", "tech regulation", "big tech", "breakup", "ftc"] },
  crypto: { label: "Crypto & Digital Assets", keywords: ["bitcoin", "crypto", "ethereum", "btc", "digital asset", "stablecoin"] },
  energy_climate: { label: "Energy & Climate Policy", keywords: ["oil price", "energy", "climate", "renewable", "ev mandate", "drilling"] },
  geopolitical: { label: "Geopolitical Risk", keywords: ["war", "conflict", "sanctions", "nato", "china", "taiwan", "russia", "ukraine"] },
  ai_tech: { label: "AI & Technology", keywords: ["artificial intelligence", "ai", "openai", "gpu", "nvidia", "chatgpt", "agi"] },
  housing: { label: "Housing Market", keywords: ["housing", "home price", "mortgage", "real estate", "home sales"] },
  employment: { label: "Jobs & Employment", keywords: ["jobs", "unemployment", "nonfarm", "payroll", "labor", "employment"] },
  government_shutdown: { label: "Government Shutdown / Debt Ceiling", keywords: ["shutdown", "debt ceiling", "government funding", "default"] },
  healthcare_biotech: { label: "Healthcare & Biotech", keywords: ["drug approval", "fda", "medicare", "biotech", "pharmaceutical", "vaccine", "clinical trial", "medicaid"] },
  financials_banking: { label: "Financials & Banking", keywords: ["bank regulation", "fdic", "fintech", "credit", "banking crisis", "bank failure", "dodd-frank", "basel"] },
  commodities_agriculture: { label: "Commodities & Agriculture", keywords: ["gold price", "silver", "wheat", "crop", "commodity", "corn", "soybean", "copper", "mining"] },
  defense_aerospace: { label: "Defense & Aerospace", keywords: ["defense spending", "military", "nato budget", "space", "pentagon", "arms deal", "missile", "drone"] },
  consumer_retail: { label: "Consumer & Retail", keywords: ["consumer spending", "retail sales", "consumer confidence", "holiday spending", "e-commerce", "consumer sentiment"] },
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

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
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
  const results: NormalizedMarket[] = [];
  let cursor = "";
  const limit = 200;

  try {
    while (true) {
      const params = new URLSearchParams({ limit: String(limit), status: "open" });
      if (cursor) params.set("cursor", cursor);
      const resp = await fetchWithTimeout(`${KALSHI_BASE_URL}/markets?${params}`);
      if (!resp.ok) {
        console.error(`Kalshi API error: ${resp.status} ${resp.statusText}`);
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

async function main() {
  console.log("Fetching market data...");

  const [kalshi, polymarket] = await Promise.all([
    fetchKalshiMarkets(),
    fetchPolymarketMarkets(),
  ]);

  const allMarkets = [...kalshi, ...polymarket];
  console.log(`Fetched ${kalshi.length} Kalshi + ${polymarket.length} Polymarket = ${allMarkets.length} total markets`);

  const themed = allMarkets.filter((m) => m.themes.length > 0);
  console.log(`${themed.length} markets classified into themes`);

  // Check if data actually changed
  let existingData = "";
  try {
    existingData = readFileSync(OUTPUT_PATH, "utf-8");
  } catch {
    // File doesn't exist yet
  }

  const newData = JSON.stringify(allMarkets, null, 2);
  if (existingData === newData) {
    console.log("No changes detected — skipping write.");
    process.exit(0);
  }

  writeFileSync(OUTPUT_PATH, newData);
  console.log(`Wrote ${allMarkets.length} markets to ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});

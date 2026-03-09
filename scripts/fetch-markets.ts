/**
 * Server-side market data fetcher.
 * Runs via GitHub Actions cron — fetches from Kalshi + Polymarket APIs,
 * classifies markets by theme, and writes to public/data/markets.json.
 *
 * Usage: npx tsx scripts/fetch-markets.ts
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createPrivateKey, sign as cryptoSign, constants as cryptoConstants } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../public/data/markets.json");
const INSIDER_OUTPUT_PATH = resolve(__dirname, "../public/data/insider-trades.json");

// trading-api requires RSA key auth since 2026; elections endpoint is public but mostly sports
const KALSHI_TRADING_URL = "https://trading-api.kalshi.com/trade-api/v2";
const KALSHI_ELECTIONS_URL = "https://api.elections.kalshi.com/trade-api/v2";

// Kalshi auth: set KALSHI_API_KEY_ID and either KALSHI_PRIVATE_KEY (PEM string) or KALSHI_PRIVATE_KEY_PATH
const KALSHI_API_KEY_ID = process.env.KALSHI_API_KEY_ID ?? "";
const KALSHI_PRIVATE_KEY_RAW = process.env.KALSHI_PRIVATE_KEY ?? "";
const KALSHI_PRIVATE_KEY_PATH = process.env.KALSHI_PRIVATE_KEY_PATH ?? "";

function loadKalshiPrivateKey(): ReturnType<typeof createPrivateKey> | null {
  try {
    let pem = KALSHI_PRIVATE_KEY_RAW;
    if (!pem && KALSHI_PRIVATE_KEY_PATH && existsSync(KALSHI_PRIVATE_KEY_PATH)) {
      pem = readFileSync(KALSHI_PRIVATE_KEY_PATH, "utf-8");
    }
    if (!pem) return null;
    return createPrivateKey({ key: pem, format: "pem" });
  } catch (e) {
    console.warn("Failed to load Kalshi private key:", e);
    return null;
  }
}

function signKalshiRequest(privateKey: ReturnType<typeof createPrivateKey>, timestamp: string, method: string, path: string): string {
  const message = Buffer.from(`${timestamp}${method}${path}`);
  const signature = cryptoSign("sha256", message, {
    key: privateKey,
    padding: cryptoConstants.RSA_PKCS1_PSS_PADDING,
    saltLength: cryptoConstants.RSA_PSS_SALTLEN_DIGEST,
  });
  return signature.toString("base64");
}

function getKalshiAuthHeaders(method: string, path: string): Record<string, string> | null {
  const privateKey = loadKalshiPrivateKey();
  if (!privateKey || !KALSHI_API_KEY_ID) return null;
  const timestamp = String(Date.now());
  const signature = signKalshiRequest(privateKey, timestamp, method, path);
  return {
    "KALSHI-ACCESS-KEY": KALSHI_API_KEY_ID,
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
    "KALSHI-ACCESS-SIGNATURE": signature,
  };
}
const POLYMARKET_GAMMA_URL = "https://gamma-api.polymarket.com";
const MIN_VOLUME_KALSHI = 1000;
const MIN_VOLUME_POLYMARKET = 5000;
const REQUEST_TIMEOUT_MS = 15000;

// Mirror of SIGNAL_THEMES from config.ts (keep in sync)
const SIGNAL_THEMES: Record<string, { label: string; keywords: string[] }> = {
  fed_rate: { label: "Fed Interest Rate Decisions", keywords: ["fed", "interest rate", "fomc", "federal reserve", "rate cut", "rate hike"] },
  inflation: { label: "Inflation / CPI", keywords: ["inflation", "cpi", "consumer price", "pce", "annual inflation"] },
  recession: { label: "Recession Probability", keywords: ["recession", "gdp", "economic contraction", "nber", "economic growth", "gdp growth"] },
  tariffs_trade: { label: "Tariffs & Trade Policy", keywords: ["tariff", "trade war", "import duty", "trade policy", "trade deal"] },
  tech_regulation: { label: "Tech Regulation & Antitrust", keywords: ["antitrust", "tech regulation", "big tech", "breakup", "ftc"] },
  crypto: { label: "Crypto & Digital Assets", keywords: ["bitcoin", "crypto", "ethereum", "btc", "digital asset", "stablecoin"] },
  energy_climate: { label: "Energy & Climate Policy", keywords: ["oil price", "energy", "climate", "renewable", "ev mandate", "drilling", "crude oil", "natural gas", "opec", "oil production", "oil (cl)", "brent crude"] },
  geopolitical: { label: "Geopolitical Risk", keywords: ["war", "conflict", "sanctions", "nato", "china", "taiwan", "russia", "ukraine", "iran", "strike", "ceasefire", "regime", "invasion", "military", "troops", "forces enter"] },
  ai_tech: { label: "AI & Technology", keywords: ["artificial intelligence", "ai", "openai", "gpu", "nvidia", "chatgpt", "agi", "nvda", "anthropic", "databricks", "perplexity"] },
  housing: { label: "Housing Market", keywords: ["housing", "home price", "mortgage", "real estate", "home sales"] },
  employment: { label: "Jobs & Employment", keywords: ["jobs", "unemployment", "nonfarm", "payroll", "labor", "employment", "jobless claims", "jobs report", "job growth", "us unemployment"] },
  government_shutdown: { label: "Government Shutdown / Debt Ceiling", keywords: ["shutdown", "debt ceiling", "government funding", "dhs shutdown"] },
  healthcare_biotech: { label: "Healthcare & Biotech", keywords: ["drug approval", "fda", "medicare", "biotech", "pharmaceutical", "vaccine", "clinical trial", "medicaid"] },
  financials_banking: { label: "Financials & Banking", keywords: ["bank regulation", "fdic", "fintech", "credit", "banking crisis", "bank failure", "dodd-frank", "basel", "sofi"] },
  commodities_agriculture: { label: "Commodities & Agriculture", keywords: ["gold price", "gold (gc)", "silver (si)", "silver.*hit", "wheat", "crop", "commodity", "corn", "soybean", "copper", "mining"] },
  defense_aerospace: { label: "Defense & Aerospace", keywords: ["defense spending", "military", "nato budget", "space", "pentagon", "arms deal", "missile", "drone"] },
  consumer_retail: { label: "Consumer & Retail", keywords: ["consumer spending", "retail sales", "consumer confidence", "holiday spending", "e-commerce", "consumer sentiment"] },
  stock_market: { label: "Stock Market & Indices", keywords: ["s&p 500", "s&p500", "sp500", "spy", "spx", "nasdaq 100", "ndx", "dow jones", "djia", "stock market", "russell 2000", "market crash", "bear market", "bull market", "equity market", "stock index", "all time high", "largest company", "market cap"] },
  treasury_bonds: { label: "Treasury & Bond Yields", keywords: ["treasury yield", "10-year yield", "bond yield", "treasury bond", "2-year yield", "yield curve", "10 year treasury", "30-year bond", "t-bill", "treasury rate", "10-year treasury"] },
  dollar_forex: { label: "US Dollar & Forex", keywords: ["us dollar", "dollar index", "dxy", "forex", "euro dollar", "eur/usd", "usd/jpy", "currency", "dollar strength", "dollar weakness", "exchange rate", "bank of japan", "bank of england"] },
  volatility: { label: "Market Volatility", keywords: ["vix", "volatility index", "fear index"] },
};

/**
 * Individual stock/ticker detection for Polymarket.
 * Maps company names and tickers in market titles directly to stock themes.
 */
const STOCK_TICKER_MAP: Record<string, { themes: string[]; keywords: string[] }> = {
  // Mega-cap tech
  NVDA: { themes: ["ai_tech"], keywords: ["nvidia", "nvda"] },
  MSFT: { themes: ["ai_tech"], keywords: ["microsoft", "msft"] },
  GOOGL: { themes: ["ai_tech", "tech_regulation"], keywords: ["alphabet", "googl", "google"] },
  META: { themes: ["ai_tech", "tech_regulation"], keywords: ["meta platforms", "meta acquire", "meta close"] },
  AAPL: { themes: ["ai_tech"], keywords: ["apple.*largest", "apple.*market cap", "aapl"] },
  AMZN: { themes: ["consumer_retail", "ai_tech"], keywords: ["amazon", "amzn"] },
  TSLA: { themes: ["ai_tech", "energy_climate"], keywords: ["tesla", "tsla"] },
  // Crypto-adjacent stocks
  MSTR: { themes: ["crypto"], keywords: ["microstrategy"] },
  COIN: { themes: ["crypto"], keywords: ["coinbase", "\\bcoin\\b"] },
  // Other individual stocks
  NFLX: { themes: ["consumer_retail"], keywords: ["netflix"] },
  DIS: { themes: ["consumer_retail"], keywords: ["disney"] },
  SOFI: { themes: ["financials_banking"], keywords: ["sofi"] },
};

/** Detect individual stock tickers mentioned in market titles. */
function detectStockTickers(title: string): string[] {
  const text = title.toLowerCase();
  const detected: string[] = [];
  for (const [, config] of Object.entries(STOCK_TICKER_MAP)) {
    for (const kw of config.keywords) {
      if (kw.includes("\\b") || kw.includes(".*")) {
        // Regex pattern
        try {
          if (new RegExp(kw, "i").test(title)) {
            for (const theme of config.themes) {
              if (!detected.includes(theme)) detected.push(theme);
            }
            break;
          }
        } catch { /* skip invalid regex */ }
      } else if (text.includes(kw)) {
        for (const theme of config.themes) {
          if (!detected.includes(theme)) detected.push(theme);
        }
        break;
      }
    }
  }
  return detected;
}

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

  // Also detect individual stock tickers
  const stockThemes = detectStockTickers(title);
  for (const theme of stockThemes) {
    if (!matched.includes(theme)) matched.push(theme);
  }

  return matched;
}

/** Financial series tickers on Kalshi that map to our themes. */
const KALSHI_FINANCIAL_SERIES = [
  "KXFED", "KXFEDDECISION", "KXCPI", "KXGDP", "KXINX",
  "KXTARIFFREVENUE", "KXFEDCHGCOUNT",
];

async function fetchKalshiMarkets(): Promise<NormalizedMarket[]> {
  const hasAuth = !!(KALSHI_API_KEY_ID && (KALSHI_PRIVATE_KEY_RAW || KALSHI_PRIVATE_KEY_PATH));
  if (!hasAuth) {
    console.log("No Kalshi API credentials found — set KALSHI_API_KEY_ID and KALSHI_PRIVATE_KEY to enable.");
    console.log("  Sign up at https://kalshi.com → Account Settings → API Keys");
    return [];
  }

  console.log("Fetching Kalshi financial markets with auth...");
  const results: NormalizedMarket[] = [];

  // Fetch markets by financial series (the general listing only returns sports parlays)
  for (const series of KALSHI_FINANCIAL_SERIES) {
    try {
      const fetched = await fetchKalshiBySeries(series);
      results.push(...fetched);
      if (fetched.length > 0) {
        console.log(`  ${series}: ${fetched.length} markets`);
      }
      await delay(200); // Rate limit courtesy
    } catch (e) {
      console.warn(`  ${series}: failed`, e);
    }
  }

  console.log(`Kalshi total: ${results.length} financial markets`);
  return results;
}

async function fetchKalshiBySeries(seriesTicker: string): Promise<NormalizedMarket[]> {
  const results: NormalizedMarket[] = [];
  let cursor = "";
  const limit = 100;
  const baseUrl = KALSHI_ELECTIONS_URL;

  while (true) {
    const params = new URLSearchParams({
      limit: String(limit),
      series_ticker: seriesTicker,
      status: "open",
    });
    if (cursor) params.set("cursor", cursor);

    const path = "/trade-api/v2/markets";
    const headers: Record<string, string> = {};
    const authHeaders = getKalshiAuthHeaders("GET", path);
    if (authHeaders) Object.assign(headers, authHeaders);

    const resp = await fetchWithTimeout(`${baseUrl}/markets?${params}`, headers);
    if (!resp.ok) break;

    const data = await resp.json();
    const markets = data.markets ?? [];

    for (const m of markets) {
      let yesPrice = m.last_price ?? 0;
      if (yesPrice > 1) yesPrice = yesPrice / 100;
      const volume = m.volume_24h ?? m.volume ?? 0;

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
    if (!cursor || markets.length < limit) break;
  }

  return results;
}

// fetchKalshiFromUrl removed — replaced by series-based fetching in fetchKalshiBySeries

async function fetchPolymarketMarkets(): Promise<NormalizedMarket[]> {
  const results: NormalizedMarket[] = [];
  const seenIds = new Set<string>();
  let offset = 0;
  const limit = 100;

  // Lower volume threshold for markets that match financial themes — these have
  // less volume than sports/politics but are the ones that drive recommendations.
  const MIN_VOLUME_FINANCIAL = 1000;

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
        const id = m.id ?? "";
        if (seenIds.has(id)) continue;

        let outcomePrices = m.outcomePrices ?? [];
        if (typeof outcomePrices === "string") {
          try { outcomePrices = JSON.parse(outcomePrices); } catch { outcomePrices = []; }
        }
        const yesPrice = outcomePrices.length > 0 ? Number(outcomePrices[0]) : null;
        const noPrice = outcomePrices.length > 1 ? Number(outcomePrices[1]) : null;
        const volume = Number(m.volume24hr ?? 0);

        const themes = classifyMarket(m.question ?? "", "");
        const isFinancial = themes.length > 0;
        const minVol = isFinancial ? MIN_VOLUME_FINANCIAL : MIN_VOLUME_POLYMARKET;
        if (volume < minVol) continue;

        seenIds.add(id);
        const normalized: NormalizedMarket = {
          source: "polymarket",
          id,
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
          themes,
        };
        results.push(normalized);
      }

      offset += limit;
      // Fetch deeper to capture financial markets in the long tail
      if (offset >= 2000) break;
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

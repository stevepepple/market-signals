# Market Signals GitHub Pages Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the Streamlit Market Signals Dashboard to a React 19 + Vite SPA deployed to GitHub Pages with hybrid live/static data.

**Architecture:** React 19 SPA in `dashboards/market_signals/static/`. Fetches live from Kalshi/Polymarket APIs, falls back to static JSON. Vite builds to `dist/`, GitHub Actions deploys to `gh-pages`.

**Tech Stack:** React 19, TypeScript, Vite, Recharts, Tailwind CSS 4, GitHub Actions

---

### Task 1: Scaffold Vite + React 19 project

**Files:**
- Create: `dashboards/market_signals/static/package.json`
- Create: `dashboards/market_signals/static/vite.config.ts`
- Create: `dashboards/market_signals/static/tsconfig.json`
- Create: `dashboards/market_signals/static/tsconfig.app.json`
- Create: `dashboards/market_signals/static/index.html`
- Create: `dashboards/market_signals/static/src/main.tsx`
- Create: `dashboards/market_signals/static/src/index.css`
- Create: `dashboards/market_signals/static/src/App.tsx`
- Create: `dashboards/market_signals/static/.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "market-signals-dashboard",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "^2.15.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.4.0",
    "typescript": "~5.7.0",
    "vite": "^6.2.0",
    "vitest": "^3.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0"
  }
}
```

**Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/Vibemap-Analysis/",
  build: {
    outDir: "dist",
  },
  test: {
    environment: "node",
  },
});
```

Note: `base` must match the GitHub repo name for GitHub Pages to serve assets correctly.

**Step 3: Create tsconfig.json**

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }]
}
```

**Step 4: Create tsconfig.app.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

**Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Market Signals Dashboard</title>
  </head>
  <body class="bg-gray-950 text-gray-100 min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 6: Create src/index.css**

```css
@import "tailwindcss";
```

**Step 7: Create src/main.tsx**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**Step 8: Create src/App.tsx (minimal placeholder)**

```tsx
export default function App() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Market Signals Dashboard</h1>
      <p className="text-gray-400 mt-2">Loading...</p>
    </div>
  );
}
```

**Step 9: Create .gitignore**

```
node_modules
dist
```

**Step 10: Install dependencies and verify build**

```bash
cd dashboards/market_signals/static && npm install && npm run build
```

Expected: Build completes with `dist/` containing `index.html` and JS bundles.

**Step 11: Commit**

```bash
git add dashboards/market_signals/static/
git commit -m "scaffold: Vite + React 19 + Tailwind project for static dashboard"
```

---

### Task 2: Port types and config

**Files:**
- Create: `dashboards/market_signals/static/src/types.ts`
- Create: `dashboards/market_signals/static/src/lib/config.ts`

**Step 1: Create src/types.ts**

Port from Python data shapes. These are the common interfaces used across the app.

```typescript
export interface NormalizedMarket {
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

export interface ThemeConfig {
  label: string;
  keywords: string[];
  kalshi_series: string[];
}

export interface Investment {
  ticker: string;
  name: string;
  direction: "positive" | "negative";
  weight: number;
  type?: "ETF" | "stock";
}

export interface ThemeSignal {
  label: string;
  avg_yes_price: number;
  market_count: number;
  total_volume_24h: number;
  strength: "strong" | "moderate" | "weak" | "none";
  magnitude: number;
  direction: "yes" | "no" | "neutral";
  top_markets: NormalizedMarket[];
}

export interface Recommendation {
  ticker: string;
  name: string;
  type: "ETF" | "stock";
  score: number;
  abs_score: number;
  direction: "bullish" | "bearish";
  signal_themes: string;
  rationale: string;
}

export interface PortfolioSummary {
  total_signals: number;
  bullish_count: number;
  bearish_count: number;
  etf_count: number;
  stock_count: number;
  top_bullish: Recommendation[];
  top_bearish: Recommendation[];
  all_themes: string[];
}

export interface Filters {
  useKalshi: boolean;
  usePolymarket: boolean;
  filterVolume: boolean;
  signalFilter: "all" | "strong" | "moderate+";
  showEtfs: boolean;
  showStocks: boolean;
  selectedTheme: string;
}
```

**Step 2: Create src/lib/config.ts**

Direct port of `config.py`. Copy all 12 themes with keywords and all THEME_INVESTMENTS verbatim.

```typescript
import type { ThemeConfig, Investment } from "../types";

export const KALSHI_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";
export const POLYMARKET_GAMMA_URL = "https://gamma-api.polymarket.com";

export const STRONG_SIGNAL_THRESHOLD = 0.75;
export const MODERATE_SIGNAL_THRESHOLD = 0.60;

export const MIN_VOLUME_KALSHI = 1000;
export const MIN_VOLUME_POLYMARKET = 5000;

export const REQUEST_TIMEOUT_MS = 5000;

export const SIGNAL_THEMES: Record<string, ThemeConfig> = {
  fed_rate: {
    label: "Fed Interest Rate Decisions",
    keywords: ["fed", "interest rate", "fomc", "federal reserve", "rate cut", "rate hike"],
    kalshi_series: ["FED", "FOMC"],
  },
  inflation: {
    label: "Inflation / CPI",
    keywords: ["inflation", "cpi", "consumer price", "pce"],
    kalshi_series: ["CPI", "INFL"],
  },
  recession: {
    label: "Recession Probability",
    keywords: ["recession", "gdp", "economic contraction", "nber"],
    kalshi_series: ["RECESSION", "GDP"],
  },
  tariffs_trade: {
    label: "Tariffs & Trade Policy",
    keywords: ["tariff", "trade war", "import duty", "trade policy", "trade deal"],
    kalshi_series: [],
  },
  tech_regulation: {
    label: "Tech Regulation & Antitrust",
    keywords: ["antitrust", "tech regulation", "big tech", "breakup", "ftc"],
    kalshi_series: [],
  },
  crypto: {
    label: "Crypto & Digital Assets",
    keywords: ["bitcoin", "crypto", "ethereum", "btc", "digital asset", "stablecoin"],
    kalshi_series: ["BTC", "ETH"],
  },
  energy_climate: {
    label: "Energy & Climate Policy",
    keywords: ["oil price", "energy", "climate", "renewable", "ev mandate", "drilling"],
    kalshi_series: [],
  },
  geopolitical: {
    label: "Geopolitical Risk",
    keywords: ["war", "conflict", "sanctions", "nato", "china", "taiwan", "russia", "ukraine"],
    kalshi_series: [],
  },
  ai_tech: {
    label: "AI & Technology",
    keywords: ["artificial intelligence", "ai", "openai", "gpu", "nvidia", "chatgpt", "agi"],
    kalshi_series: [],
  },
  housing: {
    label: "Housing Market",
    keywords: ["housing", "home price", "mortgage", "real estate", "home sales"],
    kalshi_series: [],
  },
  employment: {
    label: "Jobs & Employment",
    keywords: ["jobs", "unemployment", "nonfarm", "payroll", "labor", "employment"],
    kalshi_series: ["JOBS", "UNRATE"],
  },
  government_shutdown: {
    label: "Government Shutdown / Debt Ceiling",
    keywords: ["shutdown", "debt ceiling", "government funding", "default"],
    kalshi_series: [],
  },
};

export const THEME_INVESTMENTS: Record<string, Record<string, Investment[]>> = {
  fed_rate: {
    rate_cut_bullish: [
      { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", direction: "positive", weight: 0.9 },
      { ticker: "SCHD", name: "Schwab US Dividend Equity ETF", direction: "positive", weight: 0.6 },
      { ticker: "XLU", name: "Utilities Select Sector SPDR", direction: "positive", weight: 0.7 },
      { ticker: "VNQ", name: "Vanguard Real Estate ETF", direction: "positive", weight: 0.7 },
      { ticker: "QQQ", name: "Invesco QQQ Trust", direction: "positive", weight: 0.5 },
    ],
    rate_hike_bullish: [
      { ticker: "SHV", name: "iShares Short Treasury Bond ETF", direction: "positive", weight: 0.7 },
      { ticker: "KRE", name: "SPDR S&P Regional Banking ETF", direction: "positive", weight: 0.6 },
    ],
  },
  inflation: {
    high_inflation: [
      { ticker: "TIP", name: "iShares TIPS Bond ETF", direction: "positive", weight: 0.9 },
      { ticker: "GLD", name: "SPDR Gold Shares", direction: "positive", weight: 0.8 },
      { ticker: "DBC", name: "Invesco DB Commodity Index", direction: "positive", weight: 0.7 },
      { ticker: "XLE", name: "Energy Select Sector SPDR", direction: "positive", weight: 0.5 },
      { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", direction: "negative", weight: 0.7 },
    ],
  },
  recession: {
    recession_likely: [
      { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", direction: "positive", weight: 0.8 },
      { ticker: "GLD", name: "SPDR Gold Shares", direction: "positive", weight: 0.7 },
      { ticker: "XLP", name: "Consumer Staples Select Sector SPDR", direction: "positive", weight: 0.7 },
      { ticker: "XLV", name: "Health Care Select Sector SPDR", direction: "positive", weight: 0.6 },
      { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", direction: "negative", weight: 0.8 },
      { ticker: "XLY", name: "Consumer Discretionary Select Sector SPDR", direction: "negative", weight: 0.7 },
      { ticker: "IWM", name: "iShares Russell 2000 ETF", direction: "negative", weight: 0.8 },
    ],
  },
  tariffs_trade: {
    tariffs_increase: [
      { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", direction: "negative", weight: 0.5 },
      { ticker: "EEM", name: "iShares MSCI Emerging Markets ETF", direction: "negative", weight: 0.8 },
      { ticker: "FXI", name: "iShares China Large-Cap ETF", direction: "negative", weight: 0.9 },
      { ticker: "XLI", name: "Industrial Select Sector SPDR", direction: "negative", weight: 0.6 },
      { ticker: "GLD", name: "SPDR Gold Shares", direction: "positive", weight: 0.5 },
      { ticker: "DBA", name: "Invesco DB Agriculture Fund", direction: "negative", weight: 0.5 },
    ],
  },
  tech_regulation: {
    regulation_increases: [
      { ticker: "QQQ", name: "Invesco QQQ Trust", direction: "negative", weight: 0.7 },
      { ticker: "META", name: "Meta Platforms", direction: "negative", weight: 0.8, type: "stock" },
      { ticker: "GOOGL", name: "Alphabet", direction: "negative", weight: 0.8, type: "stock" },
      { ticker: "AMZN", name: "Amazon", direction: "negative", weight: 0.6, type: "stock" },
      { ticker: "AAPL", name: "Apple", direction: "negative", weight: 0.6, type: "stock" },
      { ticker: "RSP", name: "Invesco S&P 500 Equal Weight ETF", direction: "positive", weight: 0.4 },
    ],
  },
  crypto: {
    crypto_bullish: [
      { ticker: "IBIT", name: "iShares Bitcoin Trust ETF", direction: "positive", weight: 0.9 },
      { ticker: "ETHA", name: "iShares Ethereum Trust ETF", direction: "positive", weight: 0.8 },
      { ticker: "COIN", name: "Coinbase Global", direction: "positive", weight: 0.7, type: "stock" },
      { ticker: "MSTR", name: "Strategy (MicroStrategy)", direction: "positive", weight: 0.6, type: "stock" },
      { ticker: "MARA", name: "MARA Holdings", direction: "positive", weight: 0.5, type: "stock" },
    ],
  },
  energy_climate: {
    fossil_fuel_bullish: [
      { ticker: "XLE", name: "Energy Select Sector SPDR", direction: "positive", weight: 0.9 },
      { ticker: "XOP", name: "SPDR S&P Oil & Gas Exploration ETF", direction: "positive", weight: 0.8 },
      { ticker: "USO", name: "United States Oil Fund", direction: "positive", weight: 0.7 },
    ],
    renewables_bullish: [
      { ticker: "ICLN", name: "iShares Global Clean Energy ETF", direction: "positive", weight: 0.9 },
      { ticker: "TAN", name: "Invesco Solar ETF", direction: "positive", weight: 0.7 },
      { ticker: "LIT", name: "Global X Lithium & Battery Tech ETF", direction: "positive", weight: 0.6 },
      { ticker: "TSLA", name: "Tesla", direction: "positive", weight: 0.5, type: "stock" },
    ],
  },
  geopolitical: {
    risk_elevated: [
      { ticker: "GLD", name: "SPDR Gold Shares", direction: "positive", weight: 0.9 },
      { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", direction: "positive", weight: 0.6 },
      { ticker: "XAR", name: "SPDR S&P Aerospace & Defense ETF", direction: "positive", weight: 0.7 },
      { ticker: "LMT", name: "Lockheed Martin", direction: "positive", weight: 0.6, type: "stock" },
      { ticker: "EEM", name: "iShares MSCI Emerging Markets ETF", direction: "negative", weight: 0.7 },
      { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", direction: "negative", weight: 0.3 },
    ],
  },
  ai_tech: {
    ai_growth: [
      { ticker: "SMH", name: "VanEck Semiconductor ETF", direction: "positive", weight: 0.9 },
      { ticker: "NVDA", name: "NVIDIA", direction: "positive", weight: 0.9, type: "stock" },
      { ticker: "QQQ", name: "Invesco QQQ Trust", direction: "positive", weight: 0.6 },
      { ticker: "MSFT", name: "Microsoft", direction: "positive", weight: 0.7, type: "stock" },
      { ticker: "GOOGL", name: "Alphabet", direction: "positive", weight: 0.6, type: "stock" },
      { ticker: "BOTZ", name: "Global X Robotics & AI ETF", direction: "positive", weight: 0.7 },
    ],
  },
  housing: {
    housing_downturn: [
      { ticker: "VNQ", name: "Vanguard Real Estate ETF", direction: "negative", weight: 0.8 },
      { ticker: "XHB", name: "SPDR S&P Homebuilders ETF", direction: "negative", weight: 0.9 },
      { ticker: "ITB", name: "iShares US Home Construction ETF", direction: "negative", weight: 0.9 },
    ],
    housing_strong: [
      { ticker: "VNQ", name: "Vanguard Real Estate ETF", direction: "positive", weight: 0.8 },
      { ticker: "XHB", name: "SPDR S&P Homebuilders ETF", direction: "positive", weight: 0.9 },
      { ticker: "HD", name: "Home Depot", direction: "positive", weight: 0.5, type: "stock" },
    ],
  },
  employment: {
    strong_jobs: [
      { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", direction: "positive", weight: 0.5 },
      { ticker: "XLY", name: "Consumer Discretionary Select Sector SPDR", direction: "positive", weight: 0.6 },
      { ticker: "IWM", name: "iShares Russell 2000 ETF", direction: "positive", weight: 0.6 },
      { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", direction: "negative", weight: 0.4 },
    ],
  },
  government_shutdown: {
    shutdown_likely: [
      { ticker: "SHV", name: "iShares Short Treasury Bond ETF", direction: "positive", weight: 0.5 },
      { ticker: "GLD", name: "SPDR Gold Shares", direction: "positive", weight: 0.4 },
      { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", direction: "negative", weight: 0.4 },
    ],
  },
};
```

**Step 3: Verify build**

```bash
cd dashboards/market_signals/static && npm run build
```

**Step 4: Commit**

```bash
git add dashboards/market_signals/static/src/types.ts dashboards/market_signals/static/src/lib/config.ts
git commit -m "feat: add TypeScript types and config (port of config.py)"
```

---

### Task 3: Port fetchers

**Files:**
- Create: `dashboards/market_signals/static/src/api/fetchers.ts`
- Create: `dashboards/market_signals/static/src/api/__tests__/fetchers.test.ts`

**Step 1: Write tests for normalizers and classifier**

```typescript
import { describe, it, expect } from "vitest";
import { normalizeKalshiMarket, normalizePolymarketMarket, classifyMarket, isStrongSignal } from "../fetchers";

describe("normalizeKalshiMarket", () => {
  it("converts cents to decimal and builds URL", () => {
    const raw = { ticker: "T1", event_ticker: "E1", title: "Fed rate", subtitle: "", last_price: 75, volume_24h: 5000, open_interest: 100, status: "open", close_time: "" };
    const result = normalizeKalshiMarket(raw);
    expect(result.source).toBe("kalshi");
    expect(result.yes_price).toBe(0.75);
    expect(result.no_price).toBeCloseTo(0.25);
    expect(result.url).toBe("https://kalshi.com/markets/E1");
  });
});

describe("normalizePolymarketMarket", () => {
  it("parses JSON outcomePrices string", () => {
    const raw = { id: "P1", groupItemTitle: "G1", question: "Will BTC hit 100k?", outcomePrices: "[0.65, 0.35]", volume24hr: 10000, liquidityNum: 5000, active: true, endDate: "", slug: "btc-100k" };
    const result = normalizePolymarketMarket(raw);
    expect(result.source).toBe("polymarket");
    expect(result.yes_price).toBe(0.65);
    expect(result.url).toBe("https://polymarket.com/event/btc-100k");
  });
});

describe("classifyMarket", () => {
  it("matches multiple themes", () => {
    const market = { title: "Will the Fed cut interest rates amid recession fears?", subtitle: "" };
    const themes = classifyMarket(market as any);
    expect(themes).toContain("fed_rate");
    expect(themes).toContain("recession");
  });

  it("returns empty for unmatched market", () => {
    const market = { title: "Will it rain tomorrow?", subtitle: "" };
    expect(classifyMarket(market as any)).toEqual([]);
  });
});

describe("isStrongSignal", () => {
  it("detects high conviction yes", () => {
    expect(isStrongSignal({ yes_price: 0.85 } as any)).toBe(true);
  });
  it("detects high conviction no", () => {
    expect(isStrongSignal({ yes_price: 0.15 } as any)).toBe(true);
  });
  it("rejects moderate signal", () => {
    expect(isStrongSignal({ yes_price: 0.65 } as any)).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd dashboards/market_signals/static && npx vitest run src/api/__tests__/fetchers.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement fetchers.ts**

Port of `fetchers.py`. The key difference: uses `fetch()` with `AbortController` timeout instead of `requests`.

```typescript
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
```

**Step 4: Run tests**

```bash
cd dashboards/market_signals/static && npx vitest run src/api/__tests__/fetchers.test.ts
```

Expected: All pass.

**Step 5: Commit**

```bash
git add dashboards/market_signals/static/src/api/
git commit -m "feat: port fetchers to TypeScript with tests"
```

---

### Task 4: Port portfolio logic

**Files:**
- Create: `dashboards/market_signals/static/src/lib/portfolio.ts`
- Create: `dashboards/market_signals/static/src/lib/__tests__/portfolio.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { signalStrength, aggregateThemeSignals, generateRecommendations, buildPortfolioSummary } from "../portfolio";
import type { NormalizedMarket, ThemeSignal } from "../../types";

describe("signalStrength", () => {
  it("returns strong for high probability", () => {
    const [label, mag, dir] = signalStrength(0.85);
    expect(label).toBe("strong");
    expect(dir).toBe("yes");
    expect(mag).toBeCloseTo(0.7);
  });

  it("returns strong for very low probability", () => {
    const [label, , dir] = signalStrength(0.15);
    expect(label).toBe("strong");
    expect(dir).toBe("no");
  });

  it("returns moderate for 65%", () => {
    const [label] = signalStrength(0.65);
    expect(label).toBe("moderate");
  });

  it("returns weak for 55%", () => {
    const [label] = signalStrength(0.55);
    expect(label).toBe("weak");
  });

  it("handles null", () => {
    const [label, mag, dir] = signalStrength(null);
    expect(label).toBe("none");
    expect(mag).toBe(0);
    expect(dir).toBe("neutral");
  });
});

describe("aggregateThemeSignals", () => {
  it("aggregates markets by theme with volume weighting", () => {
    const markets: NormalizedMarket[] = [
      { source: "kalshi", id: "1", event_id: "", title: "Fed rate cut", subtitle: "", yes_price: 0.80, no_price: 0.20, volume_24h: 10000, open_interest: 0, status: "open", close_time: "", url: "", themes: ["fed_rate"] },
      { source: "kalshi", id: "2", event_id: "", title: "FOMC meeting", subtitle: "", yes_price: 0.70, no_price: 0.30, volume_24h: 5000, open_interest: 0, status: "open", close_time: "", url: "", themes: ["fed_rate"] },
    ];
    const result = aggregateThemeSignals(markets);
    expect(result.fed_rate).toBeDefined();
    expect(result.fed_rate.market_count).toBe(2);
    // Volume weighted: (0.80*10000 + 0.70*5000) / 15000 = 0.7667
    expect(result.fed_rate.avg_yes_price).toBeCloseTo(0.7667, 2);
    expect(result.fed_rate.strength).toBe("strong");
  });
});

describe("generateRecommendations", () => {
  it("produces recommendations for strong signals", () => {
    const signals: Record<string, ThemeSignal> = {
      fed_rate: {
        label: "Fed Interest Rate Decisions",
        avg_yes_price: 0.80,
        market_count: 3,
        total_volume_24h: 50000,
        strength: "strong",
        magnitude: 0.6,
        direction: "yes",
        top_markets: [],
      },
    };
    const recs = generateRecommendations(signals);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some((r) => r.ticker === "TLT")).toBe(true);
  });

  it("skips weak signals", () => {
    const signals: Record<string, ThemeSignal> = {
      fed_rate: {
        label: "Fed Interest Rate Decisions",
        avg_yes_price: 0.52,
        market_count: 1,
        total_volume_24h: 1000,
        strength: "weak",
        magnitude: 0.04,
        direction: "yes",
        top_markets: [],
      },
    };
    const recs = generateRecommendations(signals);
    expect(recs.length).toBe(0);
  });
});

describe("buildPortfolioSummary", () => {
  it("counts bullish and bearish correctly", () => {
    const recs = [
      { ticker: "TLT", name: "T", type: "ETF" as const, score: 0.5, abs_score: 0.5, direction: "bullish" as const, signal_themes: "Fed", rationale: "" },
      { ticker: "SPY", name: "S", type: "ETF" as const, score: -0.3, abs_score: 0.3, direction: "bearish" as const, signal_themes: "Recession", rationale: "" },
    ];
    const summary = buildPortfolioSummary(recs);
    expect(summary.total_signals).toBe(2);
    expect(summary.bullish_count).toBe(1);
    expect(summary.bearish_count).toBe(1);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd dashboards/market_signals/static && npx vitest run src/lib/__tests__/portfolio.test.ts
```

**Step 3: Implement portfolio.ts**

Direct port of `portfolio.py`. No pandas — uses plain arrays and objects.

```typescript
import type { NormalizedMarket, ThemeSignal, Recommendation, PortfolioSummary } from "../types";
import {
  SIGNAL_THEMES,
  THEME_INVESTMENTS,
  STRONG_SIGNAL_THRESHOLD,
  MODERATE_SIGNAL_THRESHOLD,
} from "./config";

export function signalStrength(yesPrice: number | null): [string, number, string] {
  if (yesPrice === null) return ["none", 0, "neutral"];

  const deviation = Math.abs(yesPrice - 0.5);
  const direction = yesPrice > 0.5 ? "yes" : yesPrice < 0.5 ? "no" : "neutral";

  if (yesPrice >= STRONG_SIGNAL_THRESHOLD || yesPrice <= 1 - STRONG_SIGNAL_THRESHOLD) {
    return ["strong", deviation * 2, direction];
  }
  if (yesPrice >= MODERATE_SIGNAL_THRESHOLD || yesPrice <= 1 - MODERATE_SIGNAL_THRESHOLD) {
    return ["moderate", deviation * 2, direction];
  }
  return ["weak", deviation * 2, direction];
}

export function aggregateThemeSignals(markets: NormalizedMarket[]): Record<string, ThemeSignal> {
  const themeData: Record<string, { prices: number[]; volumes: number[]; markets: NormalizedMarket[] }> = {};

  for (const market of markets) {
    for (const theme of market.themes) {
      if (!themeData[theme]) themeData[theme] = { prices: [], volumes: [], markets: [] };
      const price = market.yes_price;
      const vol = market.volume_24h || 1;
      if (price !== null) {
        themeData[theme].prices.push(price);
        themeData[theme].volumes.push(vol);
        themeData[theme].markets.push(market);
      }
    }
  }

  const results: Record<string, ThemeSignal> = {};
  for (const [theme, data] of Object.entries(themeData)) {
    if (!data.prices.length) continue;

    const totalVol = data.volumes.reduce((a, b) => a + b, 0);
    const avgPrice = totalVol > 0
      ? data.prices.reduce((sum, p, i) => sum + p * data.volumes[i], 0) / totalVol
      : data.prices.reduce((a, b) => a + b, 0) / data.prices.length;

    const [strength, magnitude, direction] = signalStrength(avgPrice);
    const sortedMarkets = [...data.markets].sort((a, b) => (b.volume_24h ?? 0) - (a.volume_24h ?? 0));

    results[theme] = {
      label: SIGNAL_THEMES[theme]?.label ?? theme,
      avg_yes_price: Math.round(avgPrice * 10000) / 10000,
      market_count: data.prices.length,
      total_volume_24h: totalVol,
      strength: strength as ThemeSignal["strength"],
      magnitude: Math.round(magnitude * 10000) / 10000,
      direction: direction as ThemeSignal["direction"],
      top_markets: sortedMarkets.slice(0, 5),
    };
  }

  return results;
}

function isScenarioActive(scenarioKey: string, avgPrice: number): boolean {
  const key = scenarioKey.toLowerCase();
  const highProbKeywords = ["likely", "increase", "elevated", "high", "downturn", "bullish", "strong", "growth"];
  const lowProbKeywords = ["unlikely", "decrease", "low"];

  for (const kw of highProbKeywords) {
    if (key.includes(kw)) return avgPrice > 0.5;
  }
  for (const kw of lowProbKeywords) {
    if (key.includes(kw)) return avgPrice < 0.5;
  }
  return avgPrice > 0.5;
}

export function generateRecommendations(themeSignals: Record<string, ThemeSignal>): Recommendation[] {
  const tickerScores: Record<string, {
    name: string;
    type: "ETF" | "stock";
    rawScore: number;
    contributingThemes: string[];
    rationales: string[];
  }> = {};

  for (const [themeKey, signal] of Object.entries(themeSignals)) {
    if (!(themeKey in THEME_INVESTMENTS)) continue;
    if (signal.strength === "weak") continue;

    const avgPrice = signal.avg_yes_price;
    const { magnitude, strength } = signal;

    for (const [scenarioKey, investments] of Object.entries(THEME_INVESTMENTS[themeKey])) {
      if (!isScenarioActive(scenarioKey, avgPrice)) continue;

      for (const inv of investments) {
        const directionFactor = inv.direction === "positive" ? 1.0 : -1.0;
        const score = magnitude * inv.weight * directionFactor;

        if (!tickerScores[inv.ticker]) {
          tickerScores[inv.ticker] = {
            name: inv.name,
            type: inv.type ?? "ETF",
            rawScore: 0,
            contributingThemes: [],
            rationales: [],
          };
        }

        const entry = tickerScores[inv.ticker];
        entry.rawScore += score;
        entry.contributingThemes.push(signal.label);
        entry.rationales.push(`${signal.label}: ${Math.round(avgPrice * 100)}% probability (${strength})`);
      }
    }
  }

  const rows: Recommendation[] = [];
  for (const [ticker, data] of Object.entries(tickerScores)) {
    if (Math.abs(data.rawScore) < 0.05) continue;
    rows.push({
      ticker,
      name: data.name,
      type: data.type,
      score: Math.round(data.rawScore * 1000) / 1000,
      abs_score: Math.round(Math.abs(data.rawScore) * 1000) / 1000,
      direction: data.rawScore > 0 ? "bullish" : "bearish",
      signal_themes: [...new Set(data.contributingThemes)].sort().join(", "),
      rationale: data.rationales.slice(0, 3).join(" | "),
    });
  }

  return rows.sort((a, b) => b.abs_score - a.abs_score);
}

export function buildPortfolioSummary(recommendations: Recommendation[]): PortfolioSummary {
  if (!recommendations.length) {
    return { total_signals: 0, bullish_count: 0, bearish_count: 0, etf_count: 0, stock_count: 0, top_bullish: [], top_bearish: [], all_themes: [] };
  }

  const bullish = recommendations.filter((r) => r.direction === "bullish");
  const bearish = recommendations.filter((r) => r.direction === "bearish");

  const allThemes = new Set<string>();
  for (const r of recommendations) {
    for (const t of r.signal_themes.split(",")) {
      allThemes.add(t.trim());
    }
  }

  return {
    total_signals: recommendations.length,
    bullish_count: bullish.length,
    bearish_count: bearish.length,
    etf_count: recommendations.filter((r) => r.type === "ETF").length,
    stock_count: recommendations.filter((r) => r.type === "stock").length,
    top_bullish: bullish.slice(0, 5),
    top_bearish: bearish.slice(0, 5),
    all_themes: [...allThemes].sort(),
  };
}
```

**Step 4: Run tests**

```bash
cd dashboards/market_signals/static && npx vitest run src/lib/__tests__/portfolio.test.ts
```

Expected: All pass.

**Step 5: Commit**

```bash
git add dashboards/market_signals/static/src/lib/
git commit -m "feat: port portfolio scoring logic to TypeScript with tests"
```

---

### Task 5: Build UI components

**Files:**
- Create: `dashboards/market_signals/static/src/components/Sidebar.tsx`
- Create: `dashboards/market_signals/static/src/components/SummaryMetrics.tsx`
- Create: `dashboards/market_signals/static/src/components/SignalThemes.tsx`
- Create: `dashboards/market_signals/static/src/components/Recommendations.tsx`
- Create: `dashboards/market_signals/static/src/components/SignalChart.tsx`
- Create: `dashboards/market_signals/static/src/components/RawDataExplorer.tsx`

All components are presentational, receiving data via props. Port the layout from `app.py` sections. Use Tailwind for styling with a dark theme (gray-950 background, gray-100 text).

**Step 1: Create Sidebar.tsx**

Props: `filters: Filters`, `onFilterChange: (f: Filters) => void`, `lastRefresh: string`, `onRefresh: () => void`. Renders checkboxes for data sources, select for signal strength, theme filter dropdown, asset type toggles.

**Step 2: Create SummaryMetrics.tsx**

Props: `totalMarkets`, `themedMarkets`, `strongSignals`, `kalshiCount`, `polymarketCount`. Renders 5-column grid of metric cards with labels and values.

**Step 3: Create SignalThemes.tsx**

Props: `themeSignals: Record<string, ThemeSignal>`. Renders 3-column grid sorted by magnitude descending. Each card shows: label, signal strength badge (color-coded), probability %, market count, 24h volume. Collapsible section for top 3 markets with links.

Signal badges: strong = red-500, moderate = yellow-500, weak = green-500, none = gray-500.

**Step 4: Create Recommendations.tsx**

Props: `recommendations: Recommendation[]`. Three tabs: All, Bullish, Bearish. Table columns: Ticker, Name, Type, Score, Direction (with icon), Themes, Rationale. Direction icons: bullish = green arrow up, bearish = red arrow down.

**Step 5: Create SignalChart.tsx**

Props: `themeSignals: Record<string, ThemeSignal>`. Horizontal bar chart using Recharts `BarChart` with `Bar` component. X-axis: magnitude. Y-axis: theme labels. Dark theme colors.

**Step 6: Create RawDataExplorer.tsx**

Props: `markets: NormalizedMarket[]`. Collapsible section with search input filtering by title. Table shows: source, title, yes_price (as %), volume_24h, themes (joined), url (as link).

**Step 7: Verify build**

```bash
cd dashboards/market_signals/static && npm run build
```

**Step 8: Commit**

```bash
git add dashboards/market_signals/static/src/components/
git commit -m "feat: add all dashboard UI components"
```

---

### Task 6: Wire up App.tsx with data loading and filters

**Files:**
- Modify: `dashboards/market_signals/static/src/App.tsx`

**Step 1: Implement App.tsx**

Wire everything together:
1. State: `filters`, `markets`, `loading`, `error`, `dataSource` ("live" | "fallback")
2. On mount: call `fetchAndClassifyAll()`. On failure, call `loadFallbackData()`.
3. Derive: `themedMarkets`, `themeSignals` (via `aggregateThemeSignals`), filtered `themeSignals`, `recommendations` (via `generateRecommendations`), `portfolioSummary`.
4. Apply filters from sidebar state.
5. Render: header, Sidebar, SummaryMetrics, SignalThemes, Recommendations, SignalChart, RawDataExplorer.
6. Add CSV download button using `Blob` + `URL.createObjectURL`.
7. Show a banner indicating "Live data" or "Cached data (APIs unavailable)".

**Step 2: Verify build**

```bash
cd dashboards/market_signals/static && npm run build
```

**Step 3: Commit**

```bash
git add dashboards/market_signals/static/src/App.tsx
git commit -m "feat: wire App with data loading, filters, and all sections"
```

---

### Task 7: Add static fallback data and GitHub Actions

**Files:**
- Create: `dashboards/market_signals/static/public/data/markets.json`
- Create: `.github/workflows/deploy-dashboard.yml`

**Step 1: Create sample fallback JSON**

Generate a representative `markets.json` with 10-15 sample markets covering several themes. This serves as demo data when APIs are unreachable. Use realistic but clearly marked sample data.

**Step 2: Create GitHub Actions deploy workflow**

```yaml
name: Deploy Market Signals Dashboard

on:
  push:
    branches: [main]
    paths:
      - "dashboards/market_signals/static/**"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: dashboards/market_signals/static/package-lock.json
      - run: npm ci
        working-directory: dashboards/market_signals/static
      - run: npm run build
        working-directory: dashboards/market_signals/static
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dashboards/market_signals/static/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Step 3: Commit**

```bash
git add dashboards/market_signals/static/public/data/markets.json .github/workflows/deploy-dashboard.yml
git commit -m "feat: add fallback data and GitHub Actions deploy workflow"
```

---

### Task 8: Final build verification and push

**Step 1: Run all tests**

```bash
cd dashboards/market_signals/static && npx vitest run
```

Expected: All tests pass.

**Step 2: Run production build**

```bash
cd dashboards/market_signals/static && npm run build
```

Expected: Clean build with no errors.

**Step 3: Preview locally**

```bash
cd dashboards/market_signals/static && npx vite preview --port 8503
```

Verify the page loads and shows the dashboard (with fallback data if APIs blocked).

**Step 4: Push branch**

```bash
git push -u origin claude/market-signals-dashboard-sYToP
```

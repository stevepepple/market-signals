# Market Signals Data Sources Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add FRED economic data, Finnhub news/calendar, and sentiment indicators (Fear & Greed, VIX) to the market signals dashboard, with confirmation/divergence badges on signal cards.

**Architecture:** Four new fetcher modules (FRED, Finnhub, sentiment, confidence) feed four new JSON data files. A unified `fetch-all.ts` script orchestrates all fetchers including the existing market fetcher. Five new React components display the data. Confidence logic compares FRED indicators against prediction market signals to show confirmation/divergence badges.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, Recharts, Tailwind CSS 4, Node fetch API, FRED REST API, Finnhub REST API

**Spec:** `docs/superpowers/specs/2026-03-10-market-signals-data-sources-design.md`

---

## File Structure

All paths relative to `dashboards/market_signals/static/`. All git commands should be run from the repo root (`/home/user/Vibemap-Analysis`), so prefix file paths with `dashboards/market_signals/static/` in git add commands.

### New Files
| File | Responsibility |
|------|---------------|
| `src/types/economic.ts` | Types for EconomicIndicator, CalendarEvent, SentimentReading, NewsItem, ThemeConfidence |
| `src/api/fred.ts` | FRED API fetcher — fetches series observations, normalizes to EconomicIndicator[] |
| `src/api/__tests__/fred.test.ts` | Tests for FRED fetcher |
| `src/api/finnhub.ts` | Finnhub API fetcher — news, earnings calendar, economic calendar |
| `src/api/__tests__/finnhub.test.ts` | Tests for Finnhub fetcher |
| `src/api/sentiment.ts` | Sentiment fetcher — CNN Fear & Greed, Crypto Fear & Greed |
| `src/api/__tests__/sentiment.test.ts` | Tests for sentiment fetcher |
| `src/lib/confidence.ts` | Confidence logic — compares FRED data vs prediction market signals |
| `src/lib/__tests__/confidence.test.ts` | Tests for confidence logic |
| `src/api/loaders.ts` | Frontend data loaders — loadEconomicData, loadCalendarData, etc. |
| `src/api/__tests__/loaders.test.ts` | Tests for frontend loaders |
| `scripts/fetch-economic.ts` | Script to fetch FRED data and write economic.json |
| `scripts/fetch-finnhub.ts` | Script to fetch Finnhub data and write calendar.json + news.json |
| `scripts/fetch-sentiment.ts` | Script to fetch sentiment data and write sentiment.json |
| `scripts/fetch-all.ts` | Unified orchestrator that runs all fetch scripts |
| `src/components/EconomicPulse.tsx` | Economic indicators grid component |
| `src/components/SentimentGauge.tsx` | Fear & Greed + VIX gauge component |
| `src/components/EventsTimeline.tsx` | Upcoming events timeline component |
| `src/components/NewsFeed.tsx` | Theme-grouped news headlines component |
| `src/components/ConfidenceBadge.tsx` | Confirmation/divergence badge for signal cards |
| `public/data/economic.json` | FRED indicator data (written by fetch script) |
| `public/data/calendar.json` | Calendar events (written by fetch script) |
| `public/data/sentiment.json` | Sentiment readings (written by fetch script) |
| `public/data/news.json` | News headlines (written by fetch script) |

### Modified Files
| File | Changes |
|------|---------|
| `src/types.ts` | Export ThemeSignal with optional `confidence` field |
| `src/App.tsx` | Load new data, pass to new components, add them to layout |
| `src/components/SignalThemes.tsx` | Add ConfidenceBadge to each theme card |
| `src/components/Sidebar.tsx` | Add toggle for economic data overlay |
| `package.json` | Add `fetch-all` script |
| `../../.github/workflows/refresh-market-data.yml` | Add env vars, run fetch-all, commit new JSON files |

---

## Chunk 1: Types and FRED Fetcher

### Task 1: Add new TypeScript types

**Files:**
- Create: `src/types/economic.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Create the economic types file**

```typescript
// src/types/economic.ts

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
```

- [ ] **Step 2: Add confidence field to ThemeSignal**

In `src/types.ts`, add to the `ThemeSignal` interface:

```typescript
confidence?: ThemeConfidence;
```

And add the import at the top:

```typescript
import type { ThemeConfidence } from "./types/economic";
```

- [ ] **Step 3: Commit**

```bash
git add dashboards/market_signals/static/src/types/economic.ts dashboards/market_signals/static/src/types.ts
git commit -m "feat: add TypeScript types for economic, calendar, sentiment, and news data"
```

---

### Task 2: FRED series config

**Files:**
- Create: `src/api/fred.ts`

- [ ] **Step 1: Write the FRED config and fetcher**

```typescript
// src/api/fred.ts

import type { EconomicIndicator } from "../types/economic";

export const FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations";

export const FRED_SERIES: Record<string, { theme: string; label: string }> = {
  FEDFUNDS: { theme: "fed_rate", label: "Fed Funds Rate" },
  DGS2: { theme: "fed_rate", label: "2-Year Treasury Yield" },
  DGS10: { theme: "fed_rate", label: "10-Year Treasury Yield" },
  DGS30: { theme: "fed_rate", label: "30-Year Treasury Yield" },
  CPIAUCSL: { theme: "inflation", label: "CPI All Urban Consumers" },
  CPILFESL: { theme: "inflation", label: "Core CPI" },
  T5YIE: { theme: "inflation", label: "5-Year Breakeven Inflation" },
  T10YIE: { theme: "inflation", label: "10-Year Breakeven Inflation" },
  GDPC1: { theme: "recession", label: "Real GDP" },
  T10Y2Y: { theme: "recession", label: "10Y-2Y Spread" },
  SAHM: { theme: "recession", label: "Sahm Rule Indicator" },
  USREC: { theme: "recession", label: "NBER Recession Indicator" },
  UNRATE: { theme: "employment", label: "Unemployment Rate" },
  PAYEMS: { theme: "employment", label: "Nonfarm Payrolls" },
  ICSA: { theme: "employment", label: "Initial Jobless Claims" },
  MORTGAGE30US: { theme: "housing", label: "30-Year Mortgage Rate" },
  CSUSHPINSA: { theme: "housing", label: "Case-Shiller Home Price Index" },
  HOUST: { theme: "housing", label: "Housing Starts" },
  DCOILWTICO: { theme: "energy_climate", label: "Crude Oil WTI" },
  GASREGW: { theme: "energy_climate", label: "Regular Gas Price" },
  VIXCLS: { theme: "_sentiment", label: "VIX" },
};

export async function fetchFredSeries(
  seriesId: string,
  apiKey: string,
  limit = 2,
): Promise<{ date: string; value: number }[]> {
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: "json",
    sort_order: "desc",
    limit: String(limit),
  });

  const resp = await fetch(`${FRED_BASE_URL}?${params}`);
  if (!resp.ok) throw new Error(`FRED API error: ${resp.status}`);

  const data = await resp.json();
  const observations = data.observations ?? [];

  return observations
    .filter((o: { value: string }) => o.value !== ".")
    .map((o: { date: string; value: string }) => ({
      date: o.date,
      value: parseFloat(o.value),
    }));
}

export async function fetchAllFredIndicators(
  apiKey: string,
): Promise<EconomicIndicator[]> {
  const results: EconomicIndicator[] = [];

  for (const [seriesId, config] of Object.entries(FRED_SERIES)) {
    try {
      const obs = await fetchFredSeries(seriesId, apiKey, 2);
      if (obs.length === 0) continue;

      const current = obs[0];
      const previous = obs.length > 1 ? obs[1] : null;
      const changePct = previous && previous.value !== 0
        ? ((current.value - previous.value) / Math.abs(previous.value)) * 100
        : 0;

      results.push({
        series_id: seriesId,
        theme: config.theme,
        label: config.label,
        value: current.value,
        date: current.date,
        previous_value: previous?.value ?? current.value,
        change_pct: Math.round(changePct * 100) / 100,
      });
    } catch (e) {
      console.error(`FRED fetch error for ${seriesId}:`, e);
    }
  }

  return results;
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboards/market_signals/static/src/api/fred.ts
git commit -m "feat: add FRED API fetcher with series config for all themes"
```

---

### Task 3: FRED fetcher tests

**Files:**
- Create: `src/api/__tests__/fred.test.ts`

- [ ] **Step 1: Write tests for FRED fetcher**

```typescript
// src/api/__tests__/fred.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchFredSeries, fetchAllFredIndicators, FRED_SERIES } from "../fred";

describe("FRED_SERIES config", () => {
  it("maps all series to a theme", () => {
    for (const [id, config] of Object.entries(FRED_SERIES)) {
      expect(config.theme).toBeTruthy();
      expect(config.label).toBeTruthy();
    }
  });

  it("covers expected themes", () => {
    const themes = new Set(Object.values(FRED_SERIES).map((c) => c.theme));
    expect(themes).toContain("fed_rate");
    expect(themes).toContain("inflation");
    expect(themes).toContain("recession");
    expect(themes).toContain("employment");
    expect(themes).toContain("housing");
    expect(themes).toContain("energy_climate");
  });
});

describe("fetchFredSeries", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses FRED API response correctly", async () => {
    const mockResponse = {
      observations: [
        { date: "2026-03-07", value: "4.25" },
        { date: "2026-03-06", value: "4.30" },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await fetchFredSeries("DGS10", "test-key");
    expect(result).toEqual([
      { date: "2026-03-07", value: 4.25 },
      { date: "2026-03-06", value: 4.30 },
    ]);
  });

  it("filters out missing values (dot notation)", async () => {
    const mockResponse = {
      observations: [
        { date: "2026-03-07", value: "." },
        { date: "2026-03-06", value: "4.30" },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await fetchFredSeries("DGS10", "test-key");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(4.30);
  });

  it("throws on API error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
    } as Response);

    await expect(fetchFredSeries("DGS10", "test-key")).rejects.toThrow("FRED API error: 429");
  });
});

describe("fetchAllFredIndicators", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("computes change_pct correctly", async () => {
    const mockResponse = {
      observations: [
        { date: "2026-03-07", value: "4.25" },
        { date: "2026-03-06", value: "4.00" },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const results = await fetchAllFredIndicators("test-key");
    const dgs10 = results.find((r) => r.series_id === "DGS10");
    expect(dgs10).toBeDefined();
    expect(dgs10!.value).toBe(4.25);
    expect(dgs10!.previous_value).toBe(4.00);
    expect(dgs10!.change_pct).toBe(6.25);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd dashboards/market_signals/static && npx vitest run src/api/__tests__/fred.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add dashboards/market_signals/static/src/api/__tests__/fred.test.ts
git commit -m "test: add FRED fetcher tests"
```

---

### Task 4: FRED fetch script

**Files:**
- Create: `scripts/fetch-economic.ts`

- [ ] **Step 1: Write the FRED fetch script**

```typescript
// scripts/fetch-economic.ts

import { writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchAllFredIndicators } from "../src/api/fred";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../public/data/economic.json");

export async function fetchEconomicData() {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    console.error("FRED_API_KEY not set — skipping economic data fetch");
    return;
  }

  console.log("Fetching FRED economic data...");
  const indicators = await fetchAllFredIndicators(apiKey);
  console.log(`Fetched ${indicators.length} indicators`);

  let existing = "";
  try { existing = readFileSync(OUTPUT_PATH, "utf-8"); } catch {}

  const newData = JSON.stringify(indicators, null, 2);
  if (existing === newData) {
    console.log("No economic data changes — skipping write.");
    return;
  }

  writeFileSync(OUTPUT_PATH, newData);
  console.log(`Wrote economic data to ${OUTPUT_PATH}`);
}

// Run directly
if (process.argv[1]?.includes("fetch-economic")) {
  fetchEconomicData().catch((e) => {
    console.error("Economic fetch error:", e);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Create empty economic.json placeholder**

```bash
echo '[]' > public/data/economic.json
```

- [ ] **Step 3: Commit**

```bash
git add dashboards/market_signals/static/scripts/fetch-economic.ts dashboards/market_signals/static/public/data/economic.json
git commit -m "feat: add FRED economic data fetch script"
```

---

## Chunk 2: Finnhub and Sentiment Fetchers

### Task 5: Finnhub fetcher

**Files:**
- Create: `src/api/finnhub.ts`

- [ ] **Step 1: Write the Finnhub fetcher**

```typescript
// src/api/finnhub.ts

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
```

- [ ] **Step 2: Commit**

```bash
git add dashboards/market_signals/static/src/api/finnhub.ts
git commit -m "feat: add Finnhub fetcher for news, earnings, and economic calendar"
```

---

### Task 6: Finnhub tests

**Files:**
- Create: `src/api/__tests__/finnhub.test.ts`

- [ ] **Step 1: Write Finnhub fetcher tests**

```typescript
// src/api/__tests__/finnhub.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchEconomicCalendar, fetchMarketNews } from "../finnhub";

describe("fetchEconomicCalendar", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("parses and filters US events", async () => {
    const mock = {
      economicCalendar: [
        { country: "US", date: "2026-03-12", event: "CPI Release", impact: "high", actual: null, estimate: 3.1, prev: 3.0 },
        { country: "CA", date: "2026-03-12", event: "Canada Jobs", impact: "medium" },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mock,
    } as Response);

    const events = await fetchEconomicCalendar("key", "2026-03-01", "2026-03-31");
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("CPI Release");
    expect(events[0].themes).toContain("inflation");
    expect(events[0].source).toBe("finnhub");
  });
});

describe("fetchMarketNews", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("maps articles to NewsItem with theme classification", async () => {
    const mock = [
      { headline: "Fed signals rate cut", source: "Reuters", url: "https://example.com", datetime: 1741824000, summary: "FOMC meeting" },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mock,
    } as Response);

    const news = await fetchMarketNews("key");
    expect(news).toHaveLength(1);
    expect(news[0].themes).toContain("fed_rate");
    expect(news[0].headline).toBe("Fed signals rate cut");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd dashboards/market_signals/static && npx vitest run src/api/__tests__/finnhub.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add dashboards/market_signals/static/src/api/__tests__/finnhub.test.ts
git commit -m "test: add Finnhub fetcher tests"
```

---

### Task 7: Sentiment fetcher

**Files:**
- Create: `src/api/sentiment.ts`

- [ ] **Step 1: Write the sentiment fetcher**

```typescript
// src/api/sentiment.ts

import type { SentimentReading } from "../types/economic";

const CNN_FEAR_GREED_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";
const CRYPTO_FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=1&format=json";

export async function fetchFearAndGreed(): Promise<SentimentReading | null> {
  try {
    const resp = await fetch(CNN_FEAR_GREED_URL);
    if (!resp.ok) return null;
    const data = await resp.json();
    const fg = data.fear_and_greed;
    if (!fg) return null;

    return {
      source: "cnn_fear_greed",
      score: Math.round(fg.score),
      label: fg.rating ?? classifyScore(fg.score),
      timestamp: new Date(fg.timestamp * 1000).toISOString(),
      sub_indicators: {
        market_momentum: data.market_momentum?.score,
        stock_price_strength: data.stock_price_strength?.score,
        stock_price_breadth: data.stock_price_breadth?.score,
        put_call_options: data.put_call_options?.score,
        market_volatility: data.market_volatility?.score,
        safe_haven_demand: data.safe_haven_demand?.score,
        junk_bond_demand: data.junk_bond_demand?.score,
      },
    };
  } catch {
    return null;
  }
}

export async function fetchCryptoFearAndGreed(): Promise<SentimentReading | null> {
  try {
    const resp = await fetch(CRYPTO_FEAR_GREED_URL);
    if (!resp.ok) return null;
    const data = await resp.json();
    const entry = data.data?.[0];
    if (!entry) return null;

    return {
      source: "crypto_fear_greed",
      score: parseInt(entry.value, 10),
      label: entry.value_classification,
      timestamp: new Date(parseInt(entry.timestamp, 10) * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

function classifyScore(score: number): string {
  if (score <= 25) return "Extreme Fear";
  if (score <= 45) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 75) return "Greed";
  return "Extreme Greed";
}

export async function fetchAllSentiment(
  vixValue?: number,
  vixDate?: string,
): Promise<SentimentReading[]> {
  const readings: SentimentReading[] = [];

  const fg = await fetchFearAndGreed();
  if (fg) readings.push(fg);

  const crypto = await fetchCryptoFearAndGreed();
  if (crypto) readings.push(crypto);

  if (vixValue !== undefined) {
    readings.push({
      source: "vix",
      score: vixValue,
      label: vixValue < 15 ? "Low Volatility" : vixValue < 25 ? "Moderate" : vixValue < 35 ? "High" : "Extreme",
      timestamp: vixDate ?? new Date().toISOString(),
    });
  }

  return readings;
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboards/market_signals/static/src/api/sentiment.ts
git commit -m "feat: add sentiment fetcher for Fear & Greed and VIX"
```

---

### Task 8: Sentiment tests

**Files:**
- Create: `src/api/__tests__/sentiment.test.ts`

- [ ] **Step 1: Write sentiment fetcher tests**

```typescript
// src/api/__tests__/sentiment.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchFearAndGreed, fetchCryptoFearAndGreed, fetchAllSentiment } from "../sentiment";

describe("fetchFearAndGreed", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("parses CNN Fear & Greed response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        fear_and_greed: { score: 35, rating: "Fear", timestamp: 1741824000 },
        market_momentum: { score: 40 },
      }),
    } as Response);

    const result = await fetchFearAndGreed();
    expect(result).not.toBeNull();
    expect(result!.score).toBe(35);
    expect(result!.label).toBe("Fear");
    expect(result!.source).toBe("cnn_fear_greed");
  });

  it("returns null on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false } as Response);
    expect(await fetchFearAndGreed()).toBeNull();
  });
});

describe("fetchCryptoFearAndGreed", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("parses alternative.me response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ value: "25", value_classification: "Extreme Fear", timestamp: "1741824000" }],
      }),
    } as Response);

    const result = await fetchCryptoFearAndGreed();
    expect(result!.score).toBe(25);
    expect(result!.label).toBe("Extreme Fear");
    expect(result!.source).toBe("crypto_fear_greed");
  });
});

describe("fetchAllSentiment", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("includes VIX when provided", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false } as Response);
    const results = await fetchAllSentiment(22.5, "2026-03-10");
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe("vix");
    expect(results[0].score).toBe(22.5);
    expect(results[0].label).toBe("Moderate");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd dashboards/market_signals/static && npx vitest run src/api/__tests__/sentiment.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add dashboards/market_signals/static/src/api/__tests__/sentiment.test.ts
git commit -m "test: add sentiment fetcher tests"
```

---

### Task 9: Finnhub and sentiment fetch scripts

**Files:**
- Create: `scripts/fetch-finnhub.ts`
- Create: `scripts/fetch-sentiment.ts`

- [ ] **Step 1: Write the Finnhub fetch script**

```typescript
// scripts/fetch-finnhub.ts

import { writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchEconomicCalendar, fetchEarningsCalendar, fetchMarketNews } from "../src/api/finnhub";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CALENDAR_PATH = resolve(__dirname, "../public/data/calendar.json");
const NEWS_PATH = resolve(__dirname, "../public/data/news.json");

function writeIfChanged(path: string, data: unknown) {
  const newJson = JSON.stringify(data, null, 2);
  let existing = "";
  try { existing = readFileSync(path, "utf-8"); } catch {}
  if (existing !== newJson) {
    writeFileSync(path, newJson);
    console.log(`Wrote ${path}`);
  } else {
    console.log(`No changes for ${path}`);
  }
}

export async function fetchFinnhubData() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.error("FINNHUB_API_KEY not set — skipping Finnhub fetch");
    return;
  }

  const today = new Date();
  const fromDate = today.toISOString().slice(0, 10);
  const toDate = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  console.log("Fetching Finnhub data...");

  const [economic, earnings, news] = await Promise.all([
    fetchEconomicCalendar(apiKey, fromDate, toDate).catch((e) => { console.error("Economic calendar:", e); return []; }),
    fetchEarningsCalendar(apiKey, fromDate, toDate).catch((e) => { console.error("Earnings calendar:", e); return []; }),
    fetchMarketNews(apiKey).catch((e) => { console.error("Market news:", e); return []; }),
  ]);

  const calendar = [...economic, ...earnings].sort((a, b) => a.date.localeCompare(b.date));
  console.log(`Fetched ${calendar.length} calendar events, ${news.length} news items`);

  writeIfChanged(CALENDAR_PATH, calendar);
  writeIfChanged(NEWS_PATH, news);
}

if (process.argv[1]?.includes("fetch-finnhub")) {
  fetchFinnhubData().catch((e) => {
    console.error("Finnhub fetch error:", e);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Write the sentiment fetch script**

```typescript
// scripts/fetch-sentiment.ts

import { writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchAllSentiment } from "../src/api/sentiment";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../public/data/sentiment.json");

export async function fetchSentimentData(vixValue?: number, vixDate?: string) {
  console.log("Fetching sentiment data...");
  const readings = await fetchAllSentiment(vixValue, vixDate);
  console.log(`Fetched ${readings.length} sentiment readings`);

  const newJson = JSON.stringify(readings, null, 2);
  let existing = "";
  try { existing = readFileSync(OUTPUT_PATH, "utf-8"); } catch {}

  if (existing !== newJson) {
    writeFileSync(OUTPUT_PATH, newJson);
    console.log(`Wrote sentiment data to ${OUTPUT_PATH}`);
  } else {
    console.log("No sentiment changes — skipping write.");
  }
}

if (process.argv[1]?.includes("fetch-sentiment")) {
  fetchSentimentData().catch((e) => {
    console.error("Sentiment fetch error:", e);
    process.exit(1);
  });
}
```

- [ ] **Step 3: Create empty JSON placeholders**

```bash
echo '[]' > public/data/calendar.json
echo '[]' > public/data/news.json
echo '[]' > public/data/sentiment.json
```

- [ ] **Step 4: Commit**

```bash
git add dashboards/market_signals/static/scripts/fetch-finnhub.ts dashboards/market_signals/static/scripts/fetch-sentiment.ts dashboards/market_signals/static/public/data/calendar.json dashboards/market_signals/static/public/data/news.json dashboards/market_signals/static/public/data/sentiment.json
git commit -m "feat: add Finnhub and sentiment fetch scripts with JSON placeholders"
```

---

## Chunk 3: Unified Fetch Script, Confidence Logic, Frontend Loaders

### Task 10: Unified fetch-all script

**Files:**
- Create: `scripts/fetch-all.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the unified fetch-all script**

```typescript
// scripts/fetch-all.ts

import { fetchEconomicData } from "./fetch-economic";
import { fetchFinnhubData } from "./fetch-finnhub";
import { fetchSentimentData } from "./fetch-sentiment";

async function main() {
  console.log("=== Fetching all market signals data ===\n");

  // Fetch markets first (existing script logic inlined or imported)
  console.log("--- Markets ---");
  const { execSync } = await import("child_process");
  const scriptDir = new URL(".", import.meta.url).pathname;
  try {
    execSync(`npx tsx ${scriptDir}fetch-markets.ts`, { stdio: "inherit" });
  } catch (e) {
    console.error("Market fetch failed (non-fatal):", e);
  }

  // Fetch FRED economic data
  console.log("\n--- Economic Data ---");
  await fetchEconomicData().catch((e) => console.error("Economic fetch failed (non-fatal):", e));

  // Extract VIX value from economic data for sentiment
  let vixValue: number | undefined;
  let vixDate: string | undefined;
  try {
    const { readFileSync } = await import("fs");
    const { resolve } = await import("path");
    const economicPath = resolve(scriptDir, "../public/data/economic.json");
    const data = JSON.parse(readFileSync(economicPath, "utf-8"));
    const vix = data.find((d: { series_id: string }) => d.series_id === "VIXCLS");
    if (vix) { vixValue = vix.value; vixDate = vix.date; }
  } catch {}

  // Fetch sentiment (with VIX value from FRED)
  console.log("\n--- Sentiment ---");
  await fetchSentimentData(vixValue, vixDate).catch((e) => console.error("Sentiment fetch failed (non-fatal):", e));

  // Fetch Finnhub news + calendar
  console.log("\n--- Finnhub ---");
  await fetchFinnhubData().catch((e) => console.error("Finnhub fetch failed (non-fatal):", e));

  console.log("\n=== Done ===");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Add fetch-all script to package.json**

In `package.json`, add to `"scripts"`:

```json
"fetch-all": "tsx scripts/fetch-all.ts"
```

- [ ] **Step 3: Commit**

```bash
git add dashboards/market_signals/static/scripts/fetch-all.ts dashboards/market_signals/static/package.json
git commit -m "feat: add unified fetch-all script orchestrating all data sources"
```

---

### Task 11: Confidence logic

**Files:**
- Create: `src/lib/confidence.ts`
- Create: `src/lib/__tests__/confidence.test.ts`

- [ ] **Step 1: Write failing confidence tests**

```typescript
// src/lib/__tests__/confidence.test.ts

import { describe, it, expect } from "vitest";
import { computeConfidence } from "../confidence";
import type { EconomicIndicator } from "../../types/economic";
import type { ThemeSignal } from "../../types";

function makeSignal(overrides: Partial<ThemeSignal>): ThemeSignal {
  return {
    label: "Test",
    avg_yes_price: 0.5,
    market_count: 1,
    total_volume_24h: 1000,
    strength: "moderate",
    magnitude: 0.5,
    direction: "yes",
    top_markets: [],
    ...overrides,
  };
}

function makeIndicator(overrides: Partial<EconomicIndicator>): EconomicIndicator {
  return {
    series_id: "TEST",
    theme: "fed_rate",
    label: "Test",
    value: 4.0,
    date: "2026-03-10",
    previous_value: 4.0,
    change_pct: 0,
    ...overrides,
  };
}

describe("computeConfidence", () => {
  it("returns neutral for themes without FRED data", () => {
    const result = computeConfidence("ai_tech", makeSignal({}), []);
    expect(result.status).toBe("neutral");
  });

  it("detects confirmation for fed_rate when yields falling and signal says rate cut", () => {
    const signal = makeSignal({ avg_yes_price: 0.75, direction: "yes" });
    const indicators = [
      makeIndicator({ series_id: "DGS2", theme: "fed_rate", value: 3.8, previous_value: 4.2, change_pct: -9.52 }),
    ];
    const result = computeConfidence("fed_rate", signal, indicators);
    expect(result.status).toBe("confirmed");
  });

  it("detects divergence for recession when Sahm triggered but market says no recession", () => {
    const signal = makeSignal({ avg_yes_price: 0.25, direction: "no" });
    const indicators = [
      makeIndicator({ series_id: "SAHM", theme: "recession", value: 0.6, previous_value: 0.3, change_pct: 100 }),
    ];
    const result = computeConfidence("recession", signal, indicators);
    expect(result.status).toBe("divergent");
  });

  it("returns neutral when data is inconclusive", () => {
    const signal = makeSignal({ avg_yes_price: 0.5, direction: "neutral" });
    const indicators = [
      makeIndicator({ series_id: "DGS10", theme: "fed_rate", value: 4.0, previous_value: 4.0, change_pct: 0 }),
    ];
    const result = computeConfidence("fed_rate", signal, indicators);
    expect(result.status).toBe("neutral");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboards/market_signals/static && npx vitest run src/lib/__tests__/confidence.test.ts`
Expected: FAIL — `computeConfidence` not found

- [ ] **Step 3: Implement confidence logic**

```typescript
// src/lib/confidence.ts

import type { ThemeConfidence, EconomicIndicator } from "../types/economic";
import type { ThemeSignal } from "../types";

const FRED_BACKED_THEMES = ["fed_rate", "inflation", "recession", "employment", "housing", "energy_climate"];

export function computeConfidence(
  theme: string,
  signal: ThemeSignal,
  indicators: EconomicIndicator[],
): ThemeConfidence {
  if (!FRED_BACKED_THEMES.includes(theme)) {
    return { status: "neutral", reason: "No economic data available for this theme" };
  }

  const themeIndicators = indicators.filter((i) => i.theme === theme);
  if (themeIndicators.length === 0) {
    return { status: "neutral", reason: "No economic data available for this theme" };
  }

  switch (theme) {
    case "fed_rate":
      return fedRateConfidence(signal, themeIndicators);
    case "inflation":
      return inflationConfidence(signal, themeIndicators);
    case "recession":
      return recessionConfidence(signal, themeIndicators);
    case "employment":
      return employmentConfidence(signal, themeIndicators);
    case "housing":
      return housingConfidence(signal, themeIndicators);
    case "energy_climate":
      return energyConfidence(signal, themeIndicators);
    default:
      return { status: "neutral", reason: "" };
  }
}

function fedRateConfidence(signal: ThemeSignal, indicators: EconomicIndicator[]): ThemeConfidence {
  const dgs2 = indicators.find((i) => i.series_id === "DGS2");
  const marketSaysRateCut = signal.avg_yes_price > 0.6;

  if (dgs2) {
    const yieldFalling = dgs2.change_pct < -2;
    const yieldRising = dgs2.change_pct > 2;

    if (marketSaysRateCut && yieldFalling) {
      return { status: "confirmed", reason: "Treasury yields falling, consistent with rate cut expectations" };
    }
    if (marketSaysRateCut && yieldRising) {
      return { status: "divergent", reason: "Treasury yields rising despite rate cut expectations" };
    }
  }
  return { status: "neutral", reason: "Inconclusive rate data" };
}

function inflationConfidence(signal: ThemeSignal, indicators: EconomicIndicator[]): ThemeConfidence {
  const breakeven = indicators.find((i) => i.series_id === "T5YIE" || i.series_id === "T10YIE");
  const marketSaysHighInflation = signal.avg_yes_price > 0.6;

  if (breakeven) {
    const rising = breakeven.change_pct > 2;
    const falling = breakeven.change_pct < -2;

    if (marketSaysHighInflation && rising) {
      return { status: "confirmed", reason: "Breakeven inflation rising, confirming inflation expectations" };
    }
    if (marketSaysHighInflation && falling) {
      return { status: "divergent", reason: "Breakeven inflation falling despite high inflation expectations" };
    }
  }
  return { status: "neutral", reason: "Inconclusive inflation data" };
}

function recessionConfidence(signal: ThemeSignal, indicators: EconomicIndicator[]): ThemeConfidence {
  const sahm = indicators.find((i) => i.series_id === "SAHM");
  const yieldCurve = indicators.find((i) => i.series_id === "T10Y2Y");
  const marketSaysRecession = signal.avg_yes_price > 0.5;

  if (sahm && sahm.value > 0.5 && !marketSaysRecession) {
    return { status: "divergent", reason: "Sahm Rule triggered but market discounts recession" };
  }
  if (yieldCurve && yieldCurve.value < 0 && marketSaysRecession) {
    return { status: "confirmed", reason: "Yield curve inverted, consistent with recession signal" };
  }
  if (sahm && sahm.value > 0.5 && marketSaysRecession) {
    return { status: "confirmed", reason: "Sahm Rule and market both signal recession risk" };
  }
  return { status: "neutral", reason: "Inconclusive recession data" };
}

function employmentConfidence(signal: ThemeSignal, indicators: EconomicIndicator[]): ThemeConfidence {
  const icsa = indicators.find((i) => i.series_id === "ICSA");
  const marketSaysStrongJobs = signal.avg_yes_price > 0.6;

  if (icsa) {
    const claimsSpiking = icsa.change_pct > 10;
    const claimsFalling = icsa.change_pct < -5;

    if (marketSaysStrongJobs && claimsFalling) {
      return { status: "confirmed", reason: "Jobless claims falling, confirming strong labor market" };
    }
    if (marketSaysStrongJobs && claimsSpiking) {
      return { status: "divergent", reason: "Jobless claims spiking despite strong jobs expectations" };
    }
  }
  return { status: "neutral", reason: "Inconclusive employment data" };
}

function housingConfidence(signal: ThemeSignal, indicators: EconomicIndicator[]): ThemeConfidence {
  const mortgage = indicators.find((i) => i.series_id === "MORTGAGE30US");
  const marketSaysHousingStrong = signal.avg_yes_price > 0.6;

  if (mortgage && mortgage.value > 7.5 && marketSaysHousingStrong) {
    return { status: "divergent", reason: "Mortgage rates above 7.5% despite bullish housing expectations" };
  }
  const houst = indicators.find((i) => i.series_id === "HOUST");
  if (houst && houst.change_pct > 5 && marketSaysHousingStrong) {
    return { status: "confirmed", reason: "Housing starts rising, confirming bullish housing signal" };
  }
  return { status: "neutral", reason: "Inconclusive housing data" };
}

function energyConfidence(signal: ThemeSignal, indicators: EconomicIndicator[]): ThemeConfidence {
  const oil = indicators.find((i) => i.series_id === "DCOILWTICO");
  const marketSaysEnergyBullish = signal.avg_yes_price > 0.6;

  if (oil) {
    if (marketSaysEnergyBullish && oil.change_pct > 5) {
      return { status: "confirmed", reason: "Oil prices rising, confirming energy bullish signal" };
    }
    if (marketSaysEnergyBullish && oil.change_pct < -5) {
      return { status: "divergent", reason: "Oil prices falling despite energy bullish expectations" };
    }
  }
  return { status: "neutral", reason: "Inconclusive energy data" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboards/market_signals/static && npx vitest run src/lib/__tests__/confidence.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add dashboards/market_signals/static/src/lib/confidence.ts dashboards/market_signals/static/src/lib/__tests__/confidence.test.ts
git commit -m "feat: add confidence logic comparing FRED data vs prediction market signals"
```

---

### Task 12: Frontend data loaders

**Files:**
- Create: `src/api/loaders.ts`
- Create: `src/api/__tests__/loaders.test.ts`

- [ ] **Step 1: Write data loader tests**

```typescript
// src/api/__tests__/loaders.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadEconomicData, loadCalendarData, loadSentimentData, loadNewsData } from "../loaders";

describe("data loaders", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("loadEconomicData returns array from JSON", async () => {
    const mockData = [{ series_id: "DGS10", theme: "fed_rate", value: 4.25 }];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const result = await loadEconomicData();
    expect(result).toEqual(mockData);
  });

  it("loadEconomicData returns empty array on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false } as Response);
    expect(await loadEconomicData()).toEqual([]);
  });

  it("loadCalendarData returns array from JSON", async () => {
    const mockData = [{ date: "2026-03-15", event: "CPI Release" }];
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const result = await loadCalendarData();
    expect(result).toEqual(mockData);
  });

  it("loadSentimentData returns empty array on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false } as Response);
    expect(await loadSentimentData()).toEqual([]);
  });

  it("loadNewsData returns empty array on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false } as Response);
    expect(await loadNewsData()).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement loaders**

```typescript
// src/api/loaders.ts

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
```

- [ ] **Step 3: Run tests**

Run: `cd dashboards/market_signals/static && npx vitest run src/api/__tests__/loaders.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add dashboards/market_signals/static/src/api/loaders.ts dashboards/market_signals/static/src/api/__tests__/loaders.test.ts
git commit -m "feat: add frontend data loaders for economic, calendar, sentiment, and news data"
```

---

## Chunk 4: Dashboard UI Components

### Task 13: ConfidenceBadge component

**Files:**
- Create: `src/components/ConfidenceBadge.tsx`
- Modify: `src/components/SignalThemes.tsx`

- [ ] **Step 1: Create the ConfidenceBadge component**

```tsx
// src/components/ConfidenceBadge.tsx

import type { ThemeConfidence } from "../types/economic";

export default function ConfidenceBadge({ confidence }: { confidence?: ThemeConfidence }) {
  if (!confidence || confidence.status === "neutral") return null;

  const isConfirmed = confidence.status === "confirmed";
  const bgColor = isConfirmed ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30";
  const textColor = isConfirmed ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400";
  const label = isConfirmed ? "Confirmed" : "Divergence";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${bgColor} ${textColor}`}
      title={confidence.reason}
    >
      <span>{isConfirmed ? "\u2713" : "\u26A0"}</span>
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Refactor SignalThemes to pass theme keys through**

The current `SignalThemes` uses `Object.values()` which drops the theme key. Refactor to use `Object.entries()` so we can pass the key to `ThemeCard` for confidence lookup.

In `src/components/SignalThemes.tsx`:

1. Add imports:
```typescript
import ConfidenceBadge from "./ConfidenceBadge";
import type { ThemeConfidence } from "../types/economic";
```

2. Update the props interface:
```typescript
interface SignalThemesProps {
  themeSignals: Record<string, ThemeSignal>;
  confidenceMap?: Record<string, ThemeConfidence>;
}
```

3. Update `ThemeCard` to accept a `themeKey` and optional `confidence`:
```typescript
function ThemeCard({ themeKey, signal, confidence }: { themeKey: string; signal: ThemeSignal; confidence?: ThemeConfidence }) {
```

4. Add `<ConfidenceBadge confidence={confidence} />` after the `<h3>` label in ThemeCard.

5. Change the `SignalThemes` render from `Object.values()` to `Object.entries()`:
```typescript
export default function SignalThemes({ themeSignals, confidenceMap }: SignalThemesProps) {
  const sorted = Object.entries(themeSignals)
    .sort(([, a], [, b]) => b.magnitude - a.magnitude);

  if (sorted.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">No theme signals available.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sorted.map(([key, s]) => (
        <ThemeCard key={key} themeKey={key} signal={s} confidence={confidenceMap?.[key]} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboards/market_signals/static/src/components/ConfidenceBadge.tsx dashboards/market_signals/static/src/components/SignalThemes.tsx
git commit -m "feat: add ConfidenceBadge component and integrate into signal theme cards"
```

---

### Task 14: SentimentGauge component

**Files:**
- Create: `src/components/SentimentGauge.tsx`

- [ ] **Step 1: Create the SentimentGauge component**

```tsx
// src/components/SentimentGauge.tsx

import type { SentimentReading } from "../types/economic";

function getGaugeColor(score: number): string {
  if (score <= 25) return "bg-red-500";
  if (score <= 45) return "bg-orange-400";
  if (score <= 55) return "bg-yellow-400";
  if (score <= 75) return "bg-lime-400";
  return "bg-green-500";
}

function GaugeBar({ reading }: { reading: SentimentReading }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {reading.source === "cnn_fear_greed" ? "Fear & Greed" : reading.source === "crypto_fear_greed" ? "Crypto F&G" : "VIX"}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          {reading.source === "vix" ? reading.score.toFixed(1) : `${reading.score}/100`}
          {reading.stale && " (stale)"}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={`h-2 rounded-full transition-all ${getGaugeColor(reading.source === "vix" ? 100 - Math.min(reading.score * 2, 100) : reading.score)}`}
          style={{ width: `${reading.source === "vix" ? Math.min(reading.score * 2, 100) : reading.score}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400">{reading.label}</span>
    </div>
  );
}

export default function SentimentGauge({ readings }: { readings: SentimentReading[] }) {
  if (readings.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Market Sentiment</h3>
      <div className="flex flex-col gap-3">
        {readings.map((r) => (
          <GaugeBar key={r.source} reading={r} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboards/market_signals/static/src/components/SentimentGauge.tsx
git commit -m "feat: add SentimentGauge component with Fear & Greed and VIX bars"
```

---

### Task 15: EconomicPulse component

**Files:**
- Create: `src/components/EconomicPulse.tsx`

- [ ] **Step 1: Create the EconomicPulse component**

```tsx
// src/components/EconomicPulse.tsx

import type { EconomicIndicator } from "../types/economic";

function TrendArrow({ changePct }: { changePct: number }) {
  if (Math.abs(changePct) < 0.5) return <span className="text-gray-400">—</span>;
  return changePct > 0
    ? <span className="text-red-500" title={`+${changePct}%`}>▲</span>
    : <span className="text-green-500" title={`${changePct}%`}>▼</span>;
}

export default function EconomicPulse({ indicators }: { indicators: EconomicIndicator[] }) {
  if (indicators.length === 0) return null;

  // Group by theme, pick the most recent indicator per series
  const grouped = new Map<string, EconomicIndicator[]>();
  for (const ind of indicators) {
    if (ind.theme === "_sentiment") continue; // VIX shown in SentimentGauge
    const group = grouped.get(ind.theme) ?? [];
    group.push(ind);
    grouped.set(ind.theme, group);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Economic Pulse</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3 lg:grid-cols-4">
        {indicators
          .filter((i) => i.theme !== "_sentiment")
          .map((ind) => (
            <div key={ind.series_id} className="flex items-center justify-between gap-1 rounded px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <span className="truncate text-gray-600 dark:text-gray-400" title={ind.label}>
                {ind.label}
              </span>
              <span className="flex items-center gap-1 font-mono text-gray-900 dark:text-gray-100">
                {typeof ind.value === "number" ? ind.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ind.value}
                <TrendArrow changePct={ind.change_pct} />
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboards/market_signals/static/src/components/EconomicPulse.tsx
git commit -m "feat: add EconomicPulse component with indicator grid and trend arrows"
```

---

### Task 16: EventsTimeline component

**Files:**
- Create: `src/components/EventsTimeline.tsx`

- [ ] **Step 1: Create the EventsTimeline component**

```tsx
// src/components/EventsTimeline.tsx

import type { CalendarEvent } from "../types/economic";

function ImpactDot({ impact }: { impact: string }) {
  const color = impact === "high" ? "bg-red-500" : impact === "medium" ? "bg-yellow-400" : "bg-gray-300";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={impact} />;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export default function EventsTimeline({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;

  const upcoming = events
    .filter((e) => daysUntil(e.date) >= 0)
    .slice(0, 7);

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Upcoming Events</h3>
      <div className="flex flex-col gap-2">
        {upcoming.map((event, i) => {
          const days = daysUntil(event.date);
          return (
            <div key={`${event.date}-${i}`} className="flex items-center gap-2 text-xs">
              <ImpactDot impact={event.impact} />
              <span className="min-w-[4rem] text-gray-500 dark:text-gray-400">
                {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
              </span>
              <span className="flex-1 text-gray-700 dark:text-gray-300">{event.event}</span>
              <span className="text-gray-400">{event.date}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboards/market_signals/static/src/components/EventsTimeline.tsx
git commit -m "feat: add EventsTimeline component with countdown and impact indicators"
```

---

### Task 17: NewsFeed component

**Files:**
- Create: `src/components/NewsFeed.tsx`

- [ ] **Step 1: Create the NewsFeed component**

```tsx
// src/components/NewsFeed.tsx

import { useState } from "react";
import type { NewsItem } from "../types/economic";

export default function NewsFeed({ news }: { news: NewsItem[] }) {
  const [expanded, setExpanded] = useState(false);

  if (news.length === 0) return null;

  // Only show news that matched at least one theme
  const themed = news.filter((n) => n.themes.length > 0);
  const displayed = expanded ? themed : themed.slice(0, 5);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">News</h3>
        {themed.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            {expanded ? "Show less" : `Show all (${themed.length})`}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {displayed.map((item, i) => (
          <a
            key={`${item.url}-${i}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-0.5 rounded px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          >
            <span className="text-xs text-gray-800 group-hover:text-blue-600 dark:text-gray-200 dark:group-hover:text-blue-400">
              {item.headline}
            </span>
            <span className="flex items-center gap-2 text-[10px] text-gray-400">
              <span>{item.source}</span>
              <span>{new Date(item.datetime).toLocaleDateString()}</span>
              {item.themes.length > 0 && (
                <span className="rounded bg-gray-100 px-1 dark:bg-gray-700">{item.themes.join(", ")}</span>
              )}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboards/market_signals/static/src/components/NewsFeed.tsx
git commit -m "feat: add NewsFeed component with collapsible themed headlines"
```

---

## Chunk 5: App Integration and Workflow

### Task 18: Integrate new components into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Read current App.tsx carefully**

Read `src/App.tsx` to understand the current layout, state management, and data loading pattern.

- [ ] **Step 2: Add imports and state**

Add at the top of `App.tsx`:

```typescript
import { loadEconomicData, loadCalendarData, loadSentimentData, loadNewsData } from "./api/loaders";
import { computeConfidence } from "./lib/confidence";
import type { EconomicIndicator, CalendarEvent, SentimentReading, NewsItem, ThemeConfidence } from "./types/economic";
import SentimentGauge from "./components/SentimentGauge";
import EconomicPulse from "./components/EconomicPulse";
import EventsTimeline from "./components/EventsTimeline";
import NewsFeed from "./components/NewsFeed";
```

Add state variables inside the App component:

```typescript
const [economic, setEconomic] = useState<EconomicIndicator[]>([]);
const [calendar, setCalendar] = useState<CalendarEvent[]>([]);
const [sentiment, setSentiment] = useState<SentimentReading[]>([]);
const [news, setNews] = useState<NewsItem[]>([]);
```

- [ ] **Step 3: Add data loading in the existing useEffect or loadData function**

Alongside the existing market data load, add:

```typescript
const [econ, cal, sent, newsItems] = await Promise.all([
  loadEconomicData(),
  loadCalendarData(),
  loadSentimentData(),
  loadNewsData(),
]);
setEconomic(econ);
setCalendar(cal);
setSentiment(sent);
setNews(newsItems);
```

- [ ] **Step 4: Compute confidence map**

Add a `useMemo` after the existing `filteredThemeSignals` memo (around line 116 in App.tsx). The variable name for theme signals is `filteredThemeSignals`:

```typescript
const confidenceMap = useMemo(() => {
  const map: Record<string, ThemeConfidence> = {};
  for (const [theme, signal] of Object.entries(filteredThemeSignals)) {
    map[theme] = computeConfidence(theme, signal, economic);
  }
  return map;
}, [filteredThemeSignals, economic]);
```

- [ ] **Step 5: Add new components to layout**

In the JSX (inside the `<>` fragment after the loading/error check), add components between existing sections. Reference the exact JSX structure in App.tsx:

After `<SummaryMetrics>` and its `<hr>`, before the "Signal Themes" `<h2>`:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
  <div className="lg:col-span-2">
    <EconomicPulse indicators={economic} />
  </div>
  <SentimentGauge readings={sentiment} />
</div>

<EventsTimeline events={calendar} />

<hr className="border-gray-200 dark:border-gray-800 my-8" />
```

Update the existing `<SignalThemes>` call to pass `confidenceMap`:

```tsx
<SignalThemes themeSignals={filteredThemeSignals} confidenceMap={confidenceMap} />
```

After the `<SignalChart>` section, before `<RawDataExplorer>`:

```tsx
<NewsFeed news={news} />
```

- [ ] **Step 6: Run all tests**

Run: `cd dashboards/market_signals/static && npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Run build**

Run: `cd dashboards/market_signals/static && npm run build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 8: Commit**

```bash
git add dashboards/market_signals/static/src/App.tsx
git commit -m "feat: integrate economic, sentiment, calendar, and news components into dashboard"
```

---

### Task 19: Update GitHub Actions workflow

**Files:**
- Modify: `.github/workflows/refresh-market-data.yml`

- [ ] **Step 1: Update the workflow to use fetch-all and commit new JSON files**

```yaml
name: Refresh Market Data

on:
  schedule:
    - cron: "0 6 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  fetch:
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

      - name: Fetch all market signals data
        working-directory: dashboards/market_signals/static
        env:
          FRED_API_KEY: ${{ secrets.FRED_API_KEY }}
          FINNHUB_API_KEY: ${{ secrets.FINNHUB_API_KEY }}
        run: npm run fetch-all

      - name: Commit and push if changed
        working-directory: dashboards/market_signals/static
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/data/markets.json public/data/economic.json public/data/calendar.json public/data/sentiment.json public/data/news.json
          if git diff --cached --quiet; then
            echo "No data changes — skipping commit."
          else
            git commit -m "chore: refresh market signals data $(date -u +%Y-%m-%d)"
            git push
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/refresh-market-data.yml
git commit -m "feat: update workflow to fetch all data sources with FRED and Finnhub API keys"
```

---

### Task 20: Sync Python config (5 missing themes)

**Files:**
- Modify: `dashboards/market_signals/config.py`

- [ ] **Step 1: Add 5 missing themes to Python SIGNAL_THEMES**

Add to `SIGNAL_THEMES` dict in `config.py`:

```python
"healthcare_biotech": {
    "label": "Healthcare & Biotech",
    "keywords": ["drug approval", "fda", "medicare", "biotech", "pharmaceutical", "vaccine", "clinical trial", "medicaid"],
    "kalshi_series": [],
},
"financials_banking": {
    "label": "Financials & Banking",
    "keywords": ["bank regulation", "fdic", "fintech", "credit", "banking crisis", "bank failure", "dodd-frank", "basel"],
    "kalshi_series": [],
},
"commodities_agriculture": {
    "label": "Commodities & Agriculture",
    "keywords": ["gold price", "silver", "wheat", "crop", "commodity", "corn", "soybean", "copper", "mining"],
    "kalshi_series": [],
},
"defense_aerospace": {
    "label": "Defense & Aerospace",
    "keywords": ["defense spending", "military", "nato budget", "space", "pentagon", "arms deal", "missile", "drone"],
    "kalshi_series": [],
},
"consumer_retail": {
    "label": "Consumer & Retail",
    "keywords": ["consumer spending", "retail sales", "consumer confidence", "holiday spending", "e-commerce", "consumer sentiment"],
    "kalshi_series": [],
},
```

Also add corresponding `THEME_INVESTMENTS` entries to match the TypeScript config.

- [ ] **Step 2: Commit**

```bash
git add dashboards/market_signals/config.py
git commit -m "feat: sync Python config with TypeScript — add 5 missing themes and investments"
```

---

### Task 21: Run full test suite and verify build

- [ ] **Step 1: Run all tests**

Run: `cd dashboards/market_signals/static && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run TypeScript build**

Run: `cd dashboards/market_signals/static && npm run build`
Expected: Clean build with no errors

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues found during final verification"
```

- [ ] **Step 4: Push to branch**

```bash
git push -u origin claude/market-signals-dashboard-sYToP
```

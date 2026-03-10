# Market Signals Dashboard: Additional Data Sources

## Overview

Extend the market signals dashboard beyond Kalshi/Polymarket prediction markets to include economic fundamentals (FRED), news/calendar events (Finnhub), and market sentiment (Fear & Greed, VIX). This creates a multi-signal system where prediction market signals are confirmed or challenged by real economic data.

## Approach

**FRED + Finnhub Core** — Two API keys covering ~80% of the value, with lightweight no-auth sentiment overlays. Architected so additional sources (Reddit sentiment, SEC EDGAR, congressional trading) can be added later as new fetcher modules.

## New Data Sources

### 1. FRED (Federal Reserve Economic Data)
- **Auth**: Free API key (120 req/min), env var `FRED_API_KEY`
- **Role**: Economic data backbone — maps indicators to themes that have quantitative fundamentals

| Theme | FRED Series | Description | Update Freq |
|-------|-------------|-------------|-------------|
| fed_rate | `FEDFUNDS` | Effective Fed Funds Rate | Daily |
| fed_rate | `DGS2` | 2-Year Treasury Yield | Daily |
| fed_rate | `DGS10` | 10-Year Treasury Yield | Daily |
| fed_rate | `DGS30` | 30-Year Treasury Yield | Daily |
| inflation | `CPIAUCSL` | CPI All Urban Consumers | Monthly |
| inflation | `CPILFESL` | Core CPI (less food & energy) | Monthly |
| inflation | `T5YIE` | 5-Year Breakeven Inflation | Daily |
| inflation | `T10YIE` | 10-Year Breakeven Inflation | Daily |
| recession | `GDPC1` | Real GDP | Quarterly |
| recession | `T10Y2Y` | 10Y-2Y Spread (yield curve) | Daily |
| recession | `SAHM` | Sahm Rule Recession Indicator | Monthly |
| recession | `USREC` | NBER Recession Indicator | Monthly |
| employment | `UNRATE` | Unemployment Rate | Monthly |
| employment | `PAYEMS` | Nonfarm Payrolls | Monthly |
| employment | `ICSA` | Initial Jobless Claims | Weekly |
| housing | `MORTGAGE30US` | 30-Year Mortgage Rate | Weekly |
| housing | `CSUSHPINSA` | Case-Shiller Home Price Index | Monthly |
| housing | `HOUST` | Housing Starts | Monthly |
| energy_climate | `DCOILWTICO` | Crude Oil WTI | Daily |
| energy_climate | `GASREGW` | Regular Gas Price | Weekly |
| (all themes) | `VIXCLS` | VIX Daily Close | Daily |

**Themes without FRED backing**: `tariffs_trade`, `tech_regulation`, `crypto`, `geopolitical`, `ai_tech`, `government_shutdown`, `healthcare_biotech`, `financials_banking`, `commodities_agriculture`, `defense_aerospace`, `consumer_retail`. These remain prediction-market-only. The confidence modifier is not computed for these themes.

### 2. Finnhub (News + Calendar)
- **Auth**: Free API key (60 req/min), env var `FINNHUB_API_KEY`
- **Role**: News headlines, earnings calendar, economic calendar

Endpoints:
- **Market news**: `GET https://finnhub.io/api/v1/news?category=general&token=KEY` — returns `[{category, datetime, headline, id, image, related, source, summary, url}]`
- **Earnings calendar**: `GET https://finnhub.io/api/v1/calendar/earnings?from=YYYY-MM-DD&to=YYYY-MM-DD&token=KEY` — returns `{earningsCalendar: [{date, epsActual, epsEstimate, hour, quarter, revenueActual, revenueEstimate, symbol, year}]}`. Ticker list derived from unique tickers in `THEME_INVESTMENTS` config.
- **Economic calendar**: `GET https://finnhub.io/api/v1/calendar/economic?from=YYYY-MM-DD&to=YYYY-MM-DD&token=KEY` — returns `{economicCalendar: [{country, date, event, impact, actual, estimate, prev, unit}]}`

### 3. CNN Fear & Greed Index (Unofficial)
- **Auth**: None
- **Endpoint**: `GET https://production.dataviz.cnn.io/index/fearandgreed/graphdata`
- **Data**: Score 0-100 with sub-indicators (market momentum, put/call, VIX, etc.)
- **Fallback**: If endpoint fails, write `sentiment.json` without the Fear & Greed entry. Preserve the previous reading if available (stale data with a `stale: true` flag).

### 4. Crypto Fear & Greed (alternative.me)
- **Auth**: None
- **Endpoint**: `GET https://api.alternative.me/fng/?limit=10&format=json`
- **Data**: Score 0-100 for crypto market sentiment
- **Maps to**: `crypto` theme specifically

## Data Flow

### Storage: Multi-file JSON Model

```
public/data/
├── markets.json       (existing — Kalshi + Polymarket prediction markets)
├── economic.json      (NEW — FRED indicators grouped by theme)
├── calendar.json      (NEW — upcoming earnings, FOMC, data releases)
├── sentiment.json     (NEW — Fear & Greed, VIX, crypto F&G)
└── news.json          (NEW — recent headlines per theme)
```

### Fetch Pipeline

A unified `scripts/fetch-all.ts` script orchestrates all fetchers. It imports the existing market fetcher logic and adds the new sources. Each data type writes to its own JSON file. Runs on the same daily cron via the existing GitHub Actions workflow.

Required env vars: `FRED_API_KEY`, `FINNHUB_API_KEY` (added to GitHub Actions secrets).

**Error handling**: Each fetcher catches errors independently. If FRED fails, `economic.json` is not updated (previous file preserved). If Finnhub fails, `calendar.json` and `news.json` are not updated. If CNN Fear & Greed fails, the entry is omitted from `sentiment.json` or marked `stale: true`. The fetch script always succeeds overall — partial data is acceptable.

### New TypeScript Types

```typescript
interface EconomicIndicator {
  series_id: string;
  theme: string;
  label: string;
  value: number;
  date: string;
  previous_value: number;
  change_pct: number;
}

interface CalendarEvent {
  date: string;
  event: string;
  impact: "low" | "medium" | "high";
  themes: string[];       // mapped to signal themes via keyword matching
  actual?: number;
  estimate?: number;
  previous?: number;
  source: "finnhub" | "fred";
}

interface SentimentReading {
  source: string;
  score: number;
  label: string;
  timestamp: string;
  stale?: boolean;
  sub_indicators?: Record<string, number>;
}

interface NewsItem {
  headline: string;
  source: string;
  url: string;
  datetime: string;
  themes: string[];       // mapped via keyword matching against SIGNAL_THEMES
  sentiment?: number;
}
```

### Frontend Data Loaders

New functions in `src/api/fetchers.ts` following the existing `loadMarketData()` pattern:

```typescript
async function loadEconomicData(): Promise<EconomicIndicator[]>
async function loadCalendarData(): Promise<CalendarEvent[]>
async function loadSentimentData(): Promise<SentimentReading[]>
async function loadNewsData(): Promise<NewsItem[]>
```

Each loads from the corresponding JSON file under `data/`.

## Scoring Enhancement

### Confirmation / Divergence Signals

The existing scoring is purely prediction-market-driven. New data creates a `confidence` field (display-only, does not modify the numerical score) on each `ThemeSignal`:

```typescript
interface ThemeConfidence {
  status: "confirmed" | "divergent" | "neutral";
  reason: string;  // e.g., "Yield curve inverted, consistent with rate cut signal"
}
```

The confidence status is determined per FRED-backed theme using these rules:

| Theme | Confirmation condition | Divergence condition |
|-------|----------------------|---------------------|
| fed_rate | Market says rate cut likely AND `DGS2` falling or `T10Y2Y` narrowing | Market says rate cut BUT `DGS2` rising sharply |
| inflation | Market says high inflation AND `T5YIE`/`T10YIE` rising | Market says low inflation BUT breakevens rising |
| recession | Market says recession likely AND `T10Y2Y` < 0 or `SAHM` > 0.5 | Market says no recession BUT `SAHM` triggered |
| employment | Market says strong jobs AND `ICSA` falling, `PAYEMS` rising | Market says strong jobs BUT `ICSA` spiking |
| housing | Market says housing strong AND `HOUST` rising | Market says housing strong BUT `MORTGAGE30US` > 7.5% |
| energy_climate | Market says energy bullish AND `DCOILWTICO` rising | Market says energy bullish BUT oil falling |

Themes without FRED backing always show `"neutral"` confidence.

This is **display-only** in v1 — shown as badges on signal cards. It does not change the portfolio recommendation scores. A future iteration could add a numerical `confidence_modifier` that adjusts scores.

## Dashboard UI

All new content lives on the existing single-page dashboard. No routing changes.

### New Components

1. **Economic Pulse Panel** — Compact grid of key indicators per theme with trend arrows (up/down/flat) and most recent values.

2. **Market Sentiment Gauge** — Visual gauge showing Fear & Greed (0-100) + VIX level with color coding (green/yellow/red). Always visible.

3. **Upcoming Events Timeline** — Next 5-7 calendar events (FOMC, CPI, earnings) sorted by date with impact level and countdown.

4. **News Feed** — Collapsible section of recent headlines grouped by theme, with source, time, and sentiment score. Links to full articles.

5. **Signal Confidence Badges** — On existing signal cards: "Confirmed" (green) or "Divergence" (amber) badge when economic data agrees/disagrees with prediction market signals. Shows `"neutral"` (no badge) for themes without FRED backing.

## Config Sync Note

The Python `config.py` has 12 themes; the TypeScript `config.ts` has 17 (5 additional: `healthcare_biotech`, `financials_banking`, `commodities_agriculture`, `defense_aerospace`, `consumer_retail`). The TypeScript config is authoritative. The Python config should be updated to match as part of this work, adding the 5 missing themes and their `THEME_INVESTMENTS`.

## Future Extension Path

This architecture supports adding more sources later as new fetcher modules:
- Reddit sentiment (PRAW + FinBERT NLP)
- Stocktwits social sentiment
- SEC EDGAR insider trading (Form 4)
- Congressional trading (Capitol Trades)
- AAII Investor Sentiment Survey
- BLS granular employment/CPI breakdowns
- Numerical `confidence_modifier` that adjusts portfolio scores (upgrade from display-only)

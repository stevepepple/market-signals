# Market Signals Dashboard

**Live:** [stevepepple.github.io/market-signals](https://stevepepple.github.io/market-signals/)

Prediction market signals mapped to ETF & stock recommendations, plus insider trade tracking from SEC filings.

## Data Sources

- **Polymarket** — prediction markets (500+ active markets)
- **Kalshi** — economics, stocks, and event markets
- **OpenInsider** — SEC Form 4 insider purchases and sales

## Signal Themes

Markets are classified into 20 investable themes:

| Category | Themes |
|----------|--------|
| Macro | Fed Rate, Inflation, Recession, Employment, Gov Shutdown |
| Markets | Stock Market & Indices, Treasury & Bonds, Dollar & Forex |
| Sectors | Energy, Crypto, AI & Tech, Healthcare, Financials, Defense, Consumer |
| Policy | Tariffs & Trade, Tech Regulation |
| Other | Geopolitical Risk, Housing, Commodities |

Each theme maps to specific ETFs and stocks with directional signals (bullish/bearish) based on prediction market probabilities.

## How It Works

1. **Fetch** — Daily cron job pulls markets from Kalshi, Polymarket, and OpenInsider
2. **Classify** — Keyword matching assigns markets to investable themes
3. **Score** — Volume-weighted average probabilities determine signal strength
4. **Recommend** — Theme signals map to ETF/stock recommendations with diversification scoring

## Development

```bash
npm install
npm run dev          # Start dev server
npm run build        # Production build
npm run fetch-data   # Fetch fresh market data
npx vitest run       # Run tests
```

## Architecture

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + Recharts
- **Data pipeline:** `scripts/fetch-markets.ts` (runs via GitHub Actions cron)
- **Deployment:** GitHub Pages (auto-deploys on push to main)

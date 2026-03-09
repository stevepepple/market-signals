# Market Signals Dashboard — GitHub Pages Static Deploy

## Summary

Convert the Streamlit-based Market Signals Dashboard to a React 19 + Vite SPA deployed to GitHub Pages. Hybrid data strategy: live client-side API fetch with static JSON fallback.

## Architecture

### Tech Stack
- React 19, TypeScript, Vite
- Recharts (charts)
- Tailwind CSS via PostCSS
- GitHub Actions for build + deploy

### Directory Structure
```
dashboards/market_signals/static/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── public/
│   └── data/
│       └── markets.json          # Static fallback data
├── src/
│   ├── main.tsx
│   ├── App.tsx                   # Layout, sidebar, data orchestration
│   ├── components/
│   │   ├── SummaryMetrics.tsx    # Top-row metric cards
│   │   ├── SignalThemes.tsx      # 3-col theme signal cards
│   │   ├── Recommendations.tsx   # Tabbed recommendations table
│   │   ├── SignalChart.tsx       # Bar chart (Recharts)
│   │   ├── RawDataExplorer.tsx   # Searchable market table
│   │   └── Sidebar.tsx           # Filter controls
│   ├── api/
│   │   └── fetchers.ts          # Kalshi + Polymarket fetch, normalize, classify
│   ├── lib/
│   │   ├── config.ts            # Themes, investment mappings, thresholds
│   │   └── portfolio.ts         # Signal aggregation, scoring, recommendations
│   ├── types.ts                 # Shared TypeScript interfaces
│   └── index.css                # Tailwind directives
└── dist/                        # Build output (gitignored)
```

### Data Flow
```
Page Load
  → Try live fetch from Kalshi + Polymarket APIs (parallel)
  → On CORS block / network error / timeout (5s)
    → Load /data/markets.json (static fallback)
  → Classify markets by theme keywords
  → Aggregate signals per theme
  → Score and generate investment recommendations
  → Render dashboard
```

### API Endpoints (no auth required)
- Kalshi: `https://api.elections.kalshi.com/trade-api/v2/markets`
- Polymarket: `https://gamma-api.polymarket.com/markets`

### Components

| Component | Port of | Key behavior |
|---|---|---|
| `App.tsx` | `app.py:main()` | State management, filter logic, data loading |
| `Sidebar.tsx` | Sidebar controls in app.py | Source toggles, signal/theme/type filters |
| `SummaryMetrics.tsx` | Summary metrics section | 5 metric cards |
| `SignalThemes.tsx` | Signal Themes section | 3-col grid, sorted by magnitude, expandable top markets |
| `Recommendations.tsx` | Portfolio Recommendations | Tabs (All/Bullish/Bearish), styled table |
| `SignalChart.tsx` | Signal Strength chart | Horizontal bar chart via Recharts |
| `RawDataExplorer.tsx` | Raw Data Explorer | Collapsible, searchable table |
| `fetchers.ts` | `fetchers.py` | fetch + normalize + classify |
| `portfolio.ts` | `portfolio.py` | aggregate + score + recommend |
| `config.ts` | `config.py` | All 12 themes, 100+ investment mappings |

### GitHub Actions

**`.github/workflows/deploy-dashboard.yml`** — on push to main:
1. `npm ci && npm run build` in `dashboards/market_signals/static/`
2. Deploy `dist/` to `gh-pages` branch via `actions/deploy-pages`

**Optional cron** (every 6h):
1. Run Python fetchers, save JSON to `public/data/markets.json`
2. Commit + rebuild

### What's preserved from Streamlit version
- All 12 signal themes with keyword matching
- 100+ ETF/stock investment mappings with weights and directions
- Signal strength thresholds (75% strong, 60% moderate)
- Volume filters (Kalshi: 1000, Polymarket: 5000)
- Scoring: magnitude x weight x direction_factor
- All UI sections: metrics, theme cards, recommendations, chart, raw explorer, CSV download

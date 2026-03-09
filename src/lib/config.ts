import type { ThemeConfig, Investment } from "../types";

export const KALSHI_BASE_URL = "https://trading-api.kalshi.com/trade-api/v2";
export const POLYMARKET_GAMMA_URL = "https://gamma-api.polymarket.com";

export const STRONG_SIGNAL_THRESHOLD = 0.75;
export const MODERATE_SIGNAL_THRESHOLD = 0.60;

export const MIN_VOLUME_KALSHI = 1000;
export const MIN_VOLUME_POLYMARKET = 5000;

export const REQUEST_TIMEOUT_MS = 5000;

/** Cap any single theme's contribution to prevent crypto/AI from dominating. */
export const MAX_THEME_WEIGHT = 0.3;

/** Bonus multiplier for recommendations appearing across multiple themes. */
export const DIVERSIFICATION_BONUS = 0.1;

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
    keywords: ["recession", "gdp", "economic contraction", "nber", "economic growth", "gdp growth"],
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
    keywords: ["oil price", "energy", "climate", "renewable", "ev mandate", "drilling", "crude oil", "natural gas", "opec", "oil production"],
    kalshi_series: [],
  },
  geopolitical: {
    label: "Geopolitical Risk",
    keywords: ["war", "conflict", "sanctions", "nato", "china", "taiwan", "russia", "ukraine", "iran", "strike", "ceasefire", "regime", "invasion", "military", "troops", "forces enter"],
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
    keywords: ["jobs", "unemployment", "nonfarm", "payroll", "labor", "employment", "jobless claims", "jobs report", "job growth"],
    kalshi_series: ["JOBS", "UNRATE"],
  },
  government_shutdown: {
    label: "Government Shutdown / Debt Ceiling",
    keywords: ["shutdown", "debt ceiling", "government funding", "default"],
    kalshi_series: [],
  },
  healthcare_biotech: {
    label: "Healthcare & Biotech",
    keywords: ["drug approval", "fda", "medicare", "biotech", "pharmaceutical", "vaccine", "clinical trial", "medicaid"],
    kalshi_series: [],
  },
  financials_banking: {
    label: "Financials & Banking",
    keywords: ["bank regulation", "fdic", "fintech", "credit", "banking crisis", "bank failure", "dodd-frank", "basel"],
    kalshi_series: [],
  },
  commodities_agriculture: {
    label: "Commodities & Agriculture",
    keywords: ["gold price", "silver", "wheat", "crop", "commodity", "corn", "soybean", "copper", "mining"],
    kalshi_series: [],
  },
  defense_aerospace: {
    label: "Defense & Aerospace",
    keywords: ["defense spending", "military", "nato budget", "space", "pentagon", "arms deal", "missile", "drone"],
    kalshi_series: [],
  },
  consumer_retail: {
    label: "Consumer & Retail",
    keywords: ["consumer spending", "retail sales", "consumer confidence", "holiday spending", "e-commerce", "consumer sentiment"],
    kalshi_series: [],
  },
  stock_market: {
    label: "Stock Market & Indices",
    keywords: ["s&p 500", "s&p500", "sp500", "spy", "nasdaq", "dow jones", "djia", "stock market", "russell 2000", "market crash", "bear market", "bull market", "equity market", "stock index"],
    kalshi_series: ["INX", "NASDAQ", "SPY"],
  },
  treasury_bonds: {
    label: "Treasury & Bond Yields",
    keywords: ["treasury yield", "10-year yield", "bond yield", "treasury bond", "2-year yield", "yield curve", "10 year treasury", "30-year bond", "t-bill", "treasury rate"],
    kalshi_series: [],
  },
  dollar_forex: {
    label: "US Dollar & Forex",
    keywords: ["us dollar", "dollar index", "dxy", "forex", "euro dollar", "eur/usd", "usd/jpy", "currency", "dollar strength", "dollar weakness", "exchange rate"],
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
  healthcare_biotech: {
    biotech_bullish: [
      { ticker: "XBI", name: "SPDR S&P Biotech ETF", direction: "positive", weight: 0.9 },
      { ticker: "IBB", name: "iShares Biotechnology ETF", direction: "positive", weight: 0.8 },
      { ticker: "JNJ", name: "Johnson & Johnson", direction: "positive", weight: 0.5, type: "stock" },
      { ticker: "PFE", name: "Pfizer", direction: "positive", weight: 0.5, type: "stock" },
      { ticker: "XLV", name: "Health Care Select Sector SPDR", direction: "positive", weight: 0.7 },
    ],
  },
  financials_banking: {
    banking_bullish: [
      { ticker: "XLF", name: "Financial Select Sector SPDR", direction: "positive", weight: 0.9 },
      { ticker: "KRE", name: "SPDR S&P Regional Banking ETF", direction: "positive", weight: 0.8 },
      { ticker: "JPM", name: "JPMorgan Chase", direction: "positive", weight: 0.6, type: "stock" },
      { ticker: "GS", name: "Goldman Sachs", direction: "positive", weight: 0.6, type: "stock" },
    ],
    banking_crisis: [
      { ticker: "XLF", name: "Financial Select Sector SPDR", direction: "negative", weight: 0.9 },
      { ticker: "KRE", name: "SPDR S&P Regional Banking ETF", direction: "negative", weight: 0.9 },
      { ticker: "GLD", name: "SPDR Gold Shares", direction: "positive", weight: 0.5 },
      { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", direction: "positive", weight: 0.6 },
    ],
  },
  commodities_agriculture: {
    commodities_bullish: [
      { ticker: "GLD", name: "SPDR Gold Shares", direction: "positive", weight: 0.9 },
      { ticker: "SLV", name: "iShares Silver Trust", direction: "positive", weight: 0.8 },
      { ticker: "DBA", name: "Invesco DB Agriculture Fund", direction: "positive", weight: 0.8 },
      { ticker: "FCX", name: "Freeport-McMoRan", direction: "positive", weight: 0.6, type: "stock" },
      { ticker: "DBC", name: "Invesco DB Commodity Index", direction: "positive", weight: 0.7 },
    ],
  },
  defense_aerospace: {
    defense_increase: [
      { ticker: "ITA", name: "iShares U.S. Aerospace & Defense ETF", direction: "positive", weight: 0.9 },
      { ticker: "LMT", name: "Lockheed Martin", direction: "positive", weight: 0.8, type: "stock" },
      { ticker: "RTX", name: "RTX Corporation", direction: "positive", weight: 0.7, type: "stock" },
      { ticker: "BA", name: "Boeing", direction: "positive", weight: 0.5, type: "stock" },
      { ticker: "XAR", name: "SPDR S&P Aerospace & Defense ETF", direction: "positive", weight: 0.8 },
    ],
  },
  consumer_retail: {
    consumer_strong: [
      { ticker: "XRT", name: "SPDR S&P Retail ETF", direction: "positive", weight: 0.9 },
      { ticker: "XLY", name: "Consumer Discretionary Select Sector SPDR", direction: "positive", weight: 0.8 },
      { ticker: "AMZN", name: "Amazon", direction: "positive", weight: 0.6, type: "stock" },
      { ticker: "WMT", name: "Walmart", direction: "positive", weight: 0.5, type: "stock" },
    ],
    consumer_weak: [
      { ticker: "XRT", name: "SPDR S&P Retail ETF", direction: "negative", weight: 0.8 },
      { ticker: "XLY", name: "Consumer Discretionary Select Sector SPDR", direction: "negative", weight: 0.7 },
      { ticker: "XLP", name: "Consumer Staples Select Sector SPDR", direction: "positive", weight: 0.6 },
    ],
  },
  stock_market: {
    market_bullish: [
      { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", direction: "positive", weight: 0.9 },
      { ticker: "QQQ", name: "Invesco QQQ Trust", direction: "positive", weight: 0.8 },
      { ticker: "IWM", name: "iShares Russell 2000 ETF", direction: "positive", weight: 0.7 },
      { ticker: "DIA", name: "SPDR Dow Jones Industrial Average ETF", direction: "positive", weight: 0.7 },
      { ticker: "VTI", name: "Vanguard Total Stock Market ETF", direction: "positive", weight: 0.6 },
    ],
    market_downturn: [
      { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", direction: "negative", weight: 0.9 },
      { ticker: "QQQ", name: "Invesco QQQ Trust", direction: "negative", weight: 0.8 },
      { ticker: "IWM", name: "iShares Russell 2000 ETF", direction: "negative", weight: 0.9 },
      { ticker: "GLD", name: "SPDR Gold Shares", direction: "positive", weight: 0.6 },
      { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", direction: "positive", weight: 0.5 },
      { ticker: "VXX", name: "iPath Series B S&P 500 VIX Short-Term Futures ETN", direction: "positive", weight: 0.7 },
    ],
  },
  treasury_bonds: {
    yields_increase: [
      { ticker: "TBT", name: "ProShares UltraShort 20+ Year Treasury", direction: "positive", weight: 0.9 },
      { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", direction: "negative", weight: 0.9 },
      { ticker: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", direction: "negative", weight: 0.7 },
      { ticker: "KRE", name: "SPDR S&P Regional Banking ETF", direction: "positive", weight: 0.5 },
    ],
    yields_decrease: [
      { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", direction: "positive", weight: 0.9 },
      { ticker: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", direction: "positive", weight: 0.7 },
      { ticker: "VNQ", name: "Vanguard Real Estate ETF", direction: "positive", weight: 0.5 },
      { ticker: "XLU", name: "Utilities Select Sector SPDR", direction: "positive", weight: 0.5 },
    ],
  },
  dollar_forex: {
    dollar_strong: [
      { ticker: "UUP", name: "Invesco DB US Dollar Index Bullish Fund", direction: "positive", weight: 0.9 },
      { ticker: "EEM", name: "iShares MSCI Emerging Markets ETF", direction: "negative", weight: 0.7 },
      { ticker: "GLD", name: "SPDR Gold Shares", direction: "negative", weight: 0.5 },
      { ticker: "FXE", name: "Invesco CurrencyShares Euro Trust", direction: "negative", weight: 0.6 },
    ],
    dollar_weak: [
      { ticker: "UUP", name: "Invesco DB US Dollar Index Bullish Fund", direction: "negative", weight: 0.8 },
      { ticker: "EEM", name: "iShares MSCI Emerging Markets ETF", direction: "positive", weight: 0.7 },
      { ticker: "GLD", name: "SPDR Gold Shares", direction: "positive", weight: 0.6 },
      { ticker: "FXE", name: "Invesco CurrencyShares Euro Trust", direction: "positive", weight: 0.6 },
    ],
  },
};

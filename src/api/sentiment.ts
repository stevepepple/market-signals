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

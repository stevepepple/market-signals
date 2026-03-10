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

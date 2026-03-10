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

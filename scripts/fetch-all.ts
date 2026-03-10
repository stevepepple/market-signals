import { fetchEconomicData } from "./fetch-economic";
import { fetchFinnhubData } from "./fetch-finnhub";
import { fetchSentimentData } from "./fetch-sentiment";

async function main() {
  console.log("=== Fetching all market signals data ===\n");

  // Fetch markets first (existing script)
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

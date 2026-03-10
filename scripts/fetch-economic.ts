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

if (process.argv[1]?.includes("fetch-economic")) {
  fetchEconomicData().catch((e) => {
    console.error("Economic fetch error:", e);
    process.exit(1);
  });
}

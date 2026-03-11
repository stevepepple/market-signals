import { writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchAllValuations } from "../src/api/valuation";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../public/data/valuation.json");

export async function fetchValuationData() {
  console.log("Fetching valuation & momentum data...");
  const indicators = await fetchAllValuations();
  console.log(`Fetched ${indicators.length} valuation indicators`);

  const newJson = JSON.stringify(indicators, null, 2);
  let existing = "";
  try { existing = readFileSync(OUTPUT_PATH, "utf-8"); } catch {}

  if (existing !== newJson) {
    writeFileSync(OUTPUT_PATH, newJson);
    console.log(`Wrote valuation data to ${OUTPUT_PATH}`);
  } else {
    console.log("No valuation changes — skipping write.");
  }
}

if (process.argv[1]?.includes("fetch-valuation")) {
  fetchValuationData().catch((e) => {
    console.error("Valuation fetch error:", e);
    process.exit(1);
  });
}

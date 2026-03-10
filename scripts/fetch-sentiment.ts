import { writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { fetchAllSentiment } from "../src/api/sentiment";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../public/data/sentiment.json");

export async function fetchSentimentData(vixValue?: number, vixDate?: string) {
  console.log("Fetching sentiment data...");
  const readings = await fetchAllSentiment(vixValue, vixDate);
  console.log(`Fetched ${readings.length} sentiment readings`);

  const newJson = JSON.stringify(readings, null, 2);
  let existing = "";
  try { existing = readFileSync(OUTPUT_PATH, "utf-8"); } catch {}

  if (existing !== newJson) {
    writeFileSync(OUTPUT_PATH, newJson);
    console.log(`Wrote sentiment data to ${OUTPUT_PATH}`);
  } else {
    console.log("No sentiment changes — skipping write.");
  }
}

if (process.argv[1]?.includes("fetch-sentiment")) {
  fetchSentimentData().catch((e) => {
    console.error("Sentiment fetch error:", e);
    process.exit(1);
  });
}

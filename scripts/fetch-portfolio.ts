import { writeFileSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { Holding, PortfolioAccount } from "./portfolio-types";
import { loadRobinhoodMcpConfig, fetchRobinhoodMcpHoldings } from "./robinhood-mcp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../public/data/portfolio.json");

const PLAID_BASE_URL = "https://production.plaid.com";

interface PlaidSecurity {
  security_id: string;
  ticker_symbol: string | null;
  name: string | null;
  type: string | null;
}

interface PlaidHolding {
  security_id: string;
  institution_price: number;
  quantity: number;
  cost_basis: number | null;
}

interface PlaidAccount {
  account_id: string;
  name: string;
}

interface PlaidInvestmentsResponse {
  accounts: PlaidAccount[];
  holdings: PlaidHolding[];
  securities: PlaidSecurity[];
}

async function fetchPlaidHoldings(
  clientId: string,
  secret: string,
  accessToken: string
): Promise<PlaidInvestmentsResponse> {
  const resp = await fetch(`${PLAID_BASE_URL}/investments/holdings/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      secret,
      access_token: accessToken,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Plaid API error ${resp.status}: ${body.slice(0, 300)}`);
  }

  return resp.json();
}

function mapToHoldings(data: PlaidInvestmentsResponse): Holding[] {
  const securityMap = new Map(
    data.securities.map((s) => [s.security_id, s])
  );

  const holdings: Holding[] = [];

  for (const h of data.holdings) {
    const sec = securityMap.get(h.security_id);
    if (!sec) continue;

    // Skip cash, money market, and positions without tickers
    if (!sec.ticker_symbol) continue;
    if (sec.type === "cash" || sec.type === "money market") continue;
    if (h.quantity <= 0) continue;

    const price = h.institution_price;
    const avgCost = h.cost_basis != null && h.quantity > 0
      ? Math.round((h.cost_basis / h.quantity) * 100) / 100
      : price;
    const equity = Math.round(price * h.quantity * 100) / 100;
    const totalReturn = Math.round((price - avgCost) * h.quantity * 100) / 100;

    const type: "ETF" | "stock" = sec.type?.toLowerCase() === "etf" ? "ETF" : "stock";

    holdings.push({
      name: sec.name ?? sec.ticker_symbol,
      symbol: sec.ticker_symbol,
      shares: Math.round(h.quantity * 1000) / 1000,
      price,
      avg_cost: avgCost,
      total_return: totalReturn,
      equity,
      type,
    });
  }

  // Sort by total_return descending (matching existing portfolio.json order)
  return holdings.sort((a, b) => b.total_return - a.total_return);
}

export async function fetchPortfolioData() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  const today = new Date().toISOString().slice(0, 10);
  const accounts: PortfolioAccount[] = [];
  const warnings: string[] = [];

  // Robinhood: prefer the official MCP server (first-party, live prices);
  // fall back to the Plaid connection if MCP isn't configured or fails.
  let robinhoodFetched = false;
  const mcpConfig = loadRobinhoodMcpConfig();
  if (mcpConfig) {
    try {
      console.log("Fetching Robinhood holdings via official MCP server...");
      const holdings = await fetchRobinhoodMcpHoldings(mcpConfig);
      console.log(`  → ${holdings.length} holdings`);
      accounts.push({ brokerage: "Robinhood", last_updated: today, holdings });
      robinhoodFetched = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`Robinhood MCP: ${msg}`);
      console.warn(`  ⚠ Robinhood MCP fetch failed, will try Plaid fallback:`, msg);
    }
  }

  const tokens: { name: string; token: string }[] = [];
  if (process.env.PLAID_ACCESS_TOKEN_ROBINHOOD && !robinhoodFetched) {
    tokens.push({ name: "Robinhood", token: process.env.PLAID_ACCESS_TOKEN_ROBINHOOD });
  }
  if (process.env.PLAID_ACCESS_TOKEN_WEALTHFRONT) {
    tokens.push({ name: "Wealthfront", token: process.env.PLAID_ACCESS_TOKEN_WEALTHFRONT });
  }

  if (tokens.length > 0 && (!clientId || !secret)) {
    console.log("PLAID_CLIENT_ID or PLAID_SECRET not set — skipping Plaid accounts");
    tokens.length = 0;
  }

  if (accounts.length === 0 && tokens.length === 0) {
    if (warnings.length > 0) {
      console.warn("No accounts fetched successfully. Keeping existing portfolio.json.");
      console.warn("Warnings:", warnings.join("; "));
    } else {
      console.log("No portfolio sources configured — skipping portfolio fetch");
    }
    return;
  }

  for (const { name, token } of tokens) {
    try {
      console.log(`Fetching holdings from ${name} via Plaid...`);
      const data = await fetchPlaidHoldings(clientId!, secret!, token);
      const holdings = mapToHoldings(data);
      console.log(`  → ${holdings.length} holdings`);
      accounts.push({
        brokerage: name,
        last_updated: today,
        holdings,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Handle Plaid ITEM_LOGIN_REQUIRED gracefully
      if (msg.includes("ITEM_LOGIN_REQUIRED")) {
        warnings.push(`${name}: re-authentication required. Run 'npm run plaid-setup' to re-link.`);
        console.warn(`  ⚠ ${name}: re-authentication required`);
      } else {
        warnings.push(`${name}: ${msg}`);
        console.error(`  ✗ ${name} fetch failed:`, msg);
      }
    }
  }

  if (accounts.length === 0) {
    console.warn("No accounts fetched successfully. Keeping existing portfolio.json.");
    if (warnings.length > 0) {
      console.warn("Warnings:", warnings.join("; "));
    }
    return;
  }

  const portfolioData = { accounts };
  const newJson = JSON.stringify(portfolioData, null, 2) + "\n";

  // Write-if-changed pattern
  let existing = "";
  try { existing = readFileSync(OUTPUT_PATH, "utf-8"); } catch {}

  if (existing === newJson) {
    console.log("No portfolio changes — skipping write.");
    return;
  }

  writeFileSync(OUTPUT_PATH, newJson);
  console.log(`Wrote portfolio data to ${OUTPUT_PATH} (${accounts.length} accounts)`);

  if (warnings.length > 0) {
    console.warn("Partial fetch warnings:", warnings.join("; "));
  }
}

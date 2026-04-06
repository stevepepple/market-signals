import { createServer } from "http";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 8484;
const PLAID_BASE_URL = "https://production.plaid.com";

async function plaidPost(endpoint: string, body: Record<string, unknown>) {
  const resp = await fetch(`${PLAID_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Plaid ${endpoint} failed (${resp.status}): ${text.slice(0, 300)}`);
  }
  return resp.json();
}

async function main() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  if (!clientId || !secret) {
    console.error("Set PLAID_CLIENT_ID and PLAID_SECRET environment variables.");
    console.error("  Example: PLAID_CLIENT_ID=xxx PLAID_SECRET=yyy npm run plaid-setup");
    process.exit(1);
  }

  console.log("Creating Plaid link token...");
  const linkResp = await plaidPost("/link/token/create", {
    client_id: clientId,
    secret,
    user: { client_user_id: "market-signals-setup" },
    client_name: "Market Signals",
    products: ["investments"],
    country_codes: ["US"],
    language: "en",
  });

  const linkToken = linkResp.link_token;
  console.log("Link token created.");

  // Read and inject the HTML template
  const htmlTemplate = readFileSync(resolve(__dirname, "plaid-link.html"), "utf-8");
  const html = htmlTemplate.replace("__LINK_TOKEN__", linkToken);

  // Start local server
  const server = createServer(async (req, res) => {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
      return;
    }

    if (req.method === "POST" && req.url === "/callback") {
      let body = "";
      for await (const chunk of req) body += chunk;

      try {
        const { public_token, institution } = JSON.parse(body);

        console.log(`\nExchanging token for ${institution}...`);
        const exchangeResp = await plaidPost("/item/public_token/exchange", {
          client_id: clientId,
          secret,
          public_token,
        });

        const accessToken = exchangeResp.access_token;
        const secretName = `PLAID_ACCESS_TOKEN_${institution.toUpperCase().replace(/\s+/g, "_")}`;

        console.log("\n========================================");
        console.log(`  Institution: ${institution}`);
        console.log(`  Access Token: ${accessToken}`);
        console.log(`  GitHub Secret Name: ${secretName}`);
        console.log("========================================");
        console.log(`\nAdd this secret to your GitHub repo:`);
        console.log(`  gh secret set ${secretName} --body "${accessToken}"`);
        console.log("");

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, access_token: accessToken, institution }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Token exchange failed:", msg);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: msg }));
      }
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(PORT, () => {
    console.log(`\nOpen http://localhost:${PORT} in your browser to connect your brokerage.`);
    console.log("Press Ctrl+C when done.\n");
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

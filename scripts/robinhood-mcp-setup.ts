/**
 * One-time OAuth setup for the official Robinhood Trading MCP server
 * (https://agent.robinhood.com/mcp/trading, "Agentic Trading").
 *
 * Discovers the OAuth endpoints, registers a client (RFC 7591), runs the
 * PKCE authorization-code flow through your browser, then saves tokens to
 * .robinhood-tokens.json and prints the GitHub secrets to configure CI.
 *
 * Usage: npm run robinhood-setup
 */
import { createServer } from "http";
import { createHash, randomBytes } from "crypto";
import { writeFileSync } from "fs";
import { DEFAULT_MCP_URL, TOKENS_PATH, discoverOAuthEndpoints } from "./robinhood-mcp";

const PORT = 8485;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;

const base64url = (buf: Buffer) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function registerClient(registrationEndpoint: string): Promise<{
  client_id: string;
  client_secret?: string;
}> {
  const resp = await fetch(registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "Market Signals",
      redirect_uris: [REDIRECT_URI],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Client registration failed (${resp.status}): ${text.slice(0, 300)}`);
  }
  const json = await resp.json();
  if (typeof json.client_id !== "string") {
    throw new Error("Registration response missing client_id");
  }
  return { client_id: json.client_id, client_secret: json.client_secret };
}

async function main() {
  const mcpUrl = process.env.ROBINHOOD_MCP_URL || DEFAULT_MCP_URL;

  console.log(`Discovering OAuth endpoints for ${mcpUrl}...`);
  const endpoints = await discoverOAuthEndpoints(mcpUrl);
  if (!endpoints.authorization_endpoint) {
    throw new Error("Authorization endpoint not found in server metadata");
  }

  // Reuse a pre-registered client if provided, otherwise register dynamically.
  let clientId = process.env.ROBINHOOD_MCP_CLIENT_ID;
  let clientSecret = process.env.ROBINHOOD_MCP_CLIENT_SECRET;
  if (!clientId) {
    if (!endpoints.registration_endpoint) {
      throw new Error(
        "Server does not support dynamic client registration. " +
          "Set ROBINHOOD_MCP_CLIENT_ID (and ROBINHOOD_MCP_CLIENT_SECRET if applicable) and re-run."
      );
    }
    console.log("Registering OAuth client...");
    const reg = await registerClient(endpoints.registration_endpoint);
    clientId = reg.client_id;
    clientSecret = reg.client_secret;
  }

  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));

  const authUrl = new URL(endpoints.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("state", state);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    if (url.pathname !== "/callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    try {
      if (url.searchParams.get("state") !== state) throw new Error("State mismatch");
      const error = url.searchParams.get("error");
      if (error) throw new Error(`Authorization failed: ${error}`);
      const code = url.searchParams.get("code");
      if (!code) throw new Error("Missing authorization code");

      console.log("\nExchanging authorization code for tokens...");
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientId!,
        code_verifier: verifier,
      });
      if (clientSecret) body.set("client_secret", clientSecret);

      const tokenResp = await fetch(endpoints.token_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body,
      });
      if (!tokenResp.ok) {
        const text = await tokenResp.text();
        throw new Error(`Token exchange failed (${tokenResp.status}): ${text.slice(0, 300)}`);
      }
      const tokens = await tokenResp.json();
      if (!tokens.refresh_token) {
        throw new Error(
          "No refresh_token in response — cannot run headlessly. " +
            "Check that the connection was approved with offline access."
        );
      }

      writeFileSync(
        TOKENS_PATH,
        JSON.stringify(
          {
            url: mcpUrl,
            client_id: clientId,
            ...(clientSecret ? { client_secret: clientSecret } : {}),
            refresh_token: tokens.refresh_token,
          },
          null,
          2
        ) + "\n"
      );

      console.log("\n========================================");
      console.log("  Robinhood MCP connected!");
      console.log(`  Tokens saved to ${TOKENS_PATH} (gitignored)`);
      console.log("========================================");
      console.log("\nAdd these secrets to your GitHub repo for the daily refresh:");
      console.log(`  gh secret set ROBINHOOD_MCP_CLIENT_ID --body "${clientId}"`);
      if (clientSecret) {
        console.log(`  gh secret set ROBINHOOD_MCP_CLIENT_SECRET --body "${clientSecret}"`);
      }
      console.log(`  gh secret set ROBINHOOD_MCP_REFRESH_TOKEN --body "${tokens.refresh_token}"`);
      console.log(
        "\nNote: if Robinhood rotates refresh tokens, also set SECRETS_ADMIN_PAT (a fine-grained"
      );
      console.log(
        "PAT with secrets write access) so the workflow can keep the secret up to date."
      );

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h2>Robinhood MCP connected — you can close this tab.</h2>");
      setTimeout(() => process.exit(0), 100);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("Setup failed:", msg);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(`Setup failed: ${msg}`);
      setTimeout(() => process.exit(1), 100);
    }
  });

  server.listen(PORT, () => {
    console.log("\nOpen this URL in your browser to authorize (log in to Robinhood):\n");
    console.log(`  ${authUrl.toString()}\n`);
    console.log("Waiting for the OAuth callback... (Ctrl+C to abort)");
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

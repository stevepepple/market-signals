import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { Holding } from "./portfolio-types";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_MCP_URL = "https://agent.robinhood.com/mcp/trading";
export const TOKENS_PATH = resolve(__dirname, "../.robinhood-tokens.json");
const PROTOCOL_VERSION = "2025-06-18";

// ---------------------------------------------------------------------------
// OAuth discovery & token refresh (MCP authorization spec: RFC 9728 + RFC 8414)
// ---------------------------------------------------------------------------

export interface OAuthEndpoints {
  authorization_endpoint?: string;
  token_endpoint: string;
  registration_endpoint?: string;
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

/**
 * Resolve the OAuth endpoints for an MCP server. Tries the protected-resource
 * metadata (path-suffix form first, then root) to find the authorization
 * server, then reads its RFC 8414 / OIDC metadata.
 */
export async function discoverOAuthEndpoints(mcpUrl: string): Promise<OAuthEndpoints> {
  const u = new URL(mcpUrl);

  let authServer = u.origin;
  const prCandidates = [
    `${u.origin}/.well-known/oauth-protected-resource${u.pathname}`,
    `${u.origin}/.well-known/oauth-protected-resource`,
  ];
  for (const candidate of prCandidates) {
    const meta = await getJson(candidate);
    const servers = meta?.authorization_servers;
    if (Array.isArray(servers) && typeof servers[0] === "string") {
      authServer = servers[0];
      break;
    }
  }

  const as = new URL(authServer);
  const asPath = as.pathname === "/" ? "" : as.pathname;
  const asCandidates = [
    `${as.origin}/.well-known/oauth-authorization-server${asPath}`,
    `${as.origin}${asPath}/.well-known/oauth-authorization-server`,
    `${as.origin}/.well-known/openid-configuration${asPath}`,
    `${as.origin}${asPath}/.well-known/openid-configuration`,
  ];
  for (const candidate of asCandidates) {
    const meta = await getJson(candidate);
    if (meta && typeof meta.token_endpoint === "string") {
      return {
        authorization_endpoint:
          typeof meta.authorization_endpoint === "string" ? meta.authorization_endpoint : undefined,
        token_endpoint: meta.token_endpoint,
        registration_endpoint:
          typeof meta.registration_endpoint === "string" ? meta.registration_endpoint : undefined,
      };
    }
  }

  throw new Error(`Could not discover OAuth endpoints for ${mcpUrl}`);
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

export async function refreshAccessToken(
  tokenEndpoint: string,
  clientId: string,
  refreshToken: string,
  clientSecret?: string
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  if (clientSecret) body.set("client_secret", clientSecret);

  const resp = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token refresh failed (${resp.status}): ${text.slice(0, 300)}`);
  }

  const json = await resp.json();
  if (typeof json.access_token !== "string") {
    throw new Error("Token refresh response missing access_token");
  }
  return {
    access_token: json.access_token,
    // Servers that rotate refresh tokens return a new one; otherwise keep ours.
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : refreshToken,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : undefined,
  };
}

// ---------------------------------------------------------------------------
// Minimal MCP client over streamable HTTP
// ---------------------------------------------------------------------------

interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

/** Extract the JSON-RPC response with the given id from an SSE body. */
export function parseSseResponse(body: string, id: number): JsonRpcMessage | null {
  for (const event of body.split(/\r?\n\r?\n/)) {
    const data = event
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("\n");
    if (!data) continue;
    try {
      const msg = JSON.parse(data);
      if (msg && msg.id === id && ("result" in msg || "error" in msg)) return msg;
    } catch {
      // Ignore non-JSON keep-alives
    }
  }
  return null;
}

export interface ToolResult {
  content?: { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}

/** Unwrap an MCP tool result into plain data (structuredContent or parsed text). */
export function toolResultToData(result: ToolResult): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const text = (result.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n");
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class McpHttpClient {
  private nextId = 1;
  private sessionId: string | null = null;

  constructor(private url: string, private accessToken: string) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
    };
    if (this.sessionId) h["Mcp-Session-Id"] = this.sessionId;
    return h;
  }

  private async request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const resp = await fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });

    const sid = resp.headers.get("mcp-session-id");
    if (sid) this.sessionId = sid;

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`MCP ${method} HTTP ${resp.status}: ${text.slice(0, 300)}`);
    }

    const contentType = resp.headers.get("content-type") ?? "";
    let msg: JsonRpcMessage | null;
    if (contentType.includes("text/event-stream")) {
      msg = parseSseResponse(await resp.text(), id);
    } else {
      msg = await resp.json();
    }

    if (!msg) throw new Error(`MCP ${method}: no response for request ${id}`);
    if (msg.error) throw new Error(`MCP ${method} error ${msg.error.code}: ${msg.error.message}`);
    return msg.result;
  }

  private async notify(method: string): Promise<void> {
    await fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: "2.0", method }),
    });
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "market-signals", version: "0.1.0" },
    });
    await this.notify("notifications/initialized");
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    const result = (await this.request("tools/call", { name, arguments: args })) as ToolResult;
    if (result?.isError) {
      const data = toolResultToData(result);
      throw new Error(`Tool ${name} returned an error: ${JSON.stringify(data).slice(0, 300)}`);
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Position parsing (tolerant of field-name variations in the beta API)
// ---------------------------------------------------------------------------

export interface ParsedPosition {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number | null;
  price: number | null;
  equity: number | null;
  type: "ETF" | "stock";
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[$,]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  if (v && typeof v === "object" && "amount" in v) {
    return asNumber((v as { amount: unknown }).amount);
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    if (k in obj) {
      const n = asNumber(obj[k]);
      if (n != null) return n;
    }
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Find the array of positions inside whatever envelope the server uses. */
function extractPositionArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["positions", "equity_positions", "results", "holdings", "data", "items"]) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
    // Some envelopes nest one level deeper (e.g. { portfolio: { positions: [...] } })
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const nested = extractPositionArray(value);
        if (nested.length) return nested;
      }
    }
  }
  return [];
}

export function parsePositions(data: unknown): ParsedPosition[] {
  const rows = extractPositionArray(data);
  const positions: ParsedPosition[] = [];

  for (const row of rows) {
    const symbol = pickString(row, ["symbol", "ticker", "ticker_symbol", "instrument_symbol"]);
    if (!symbol) continue;

    const shares = pickNumber(row, ["quantity", "shares", "units"]);
    if (shares == null || shares <= 0) continue;

    const name =
      pickString(row, ["name", "instrument_name", "company_name", "simple_name", "description"]) ??
      symbol;

    let avgCost = pickNumber(row, ["average_buy_price", "average_cost", "avg_cost", "average_price"]);
    if (avgCost == null) {
      // cost_basis-style fields are totals, not per-share
      const totalCost = pickNumber(row, ["cost_basis", "total_cost"]);
      if (totalCost != null) avgCost = totalCost / shares;
    }

    const price = pickNumber(row, [
      "price",
      "last_price",
      "last_trade_price",
      "market_price",
      "current_price",
    ]);
    const equity = pickNumber(row, ["equity", "market_value", "value"]);

    const typeStr = pickString(row, ["type", "instrument_type", "security_type", "asset_type"]) ?? "";
    const type: "ETF" | "stock" = /etf|fund/i.test(typeStr) ? "ETF" : "stock";

    positions.push({ symbol, name, shares, avgCost, price, equity, type });
  }

  return positions;
}

/** Extract { SYMBOL: price } pairs from a get_equity_quotes result. */
export function parseQuotes(data: unknown): Record<string, number> {
  const quotes: Record<string, number> = {};
  const rows = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : extractPositionArray(data);

  for (const row of rows) {
    const symbol = pickString(row, ["symbol", "ticker", "ticker_symbol"]);
    const price = pickNumber(row, [
      "price",
      "last_trade_price",
      "last_price",
      "ask_price",
      "bid_price",
      "mark_price",
    ]);
    if (symbol && price != null) quotes[symbol.toUpperCase()] = price;
  }

  // Also accept a flat { "AAPL": 123.45 } map
  if (!rows.length && data && typeof data === "object") {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      const n = asNumber(v);
      if (n != null && /^[A-Z.]{1,6}$/.test(k)) quotes[k] = n;
    }
  }

  return quotes;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function toHoldings(
  positions: ParsedPosition[],
  quotes: Record<string, number> = {}
): Holding[] {
  const holdings: Holding[] = [];

  for (const p of positions) {
    let price = p.price ?? quotes[p.symbol.toUpperCase()] ?? null;
    if (price == null && p.equity != null) price = p.equity / p.shares;
    if (price == null) continue;

    const avgCost = p.avgCost ?? price;
    const equity = p.equity ?? price * p.shares;

    holdings.push({
      name: p.name,
      symbol: p.symbol,
      shares: Math.round(p.shares * 1000) / 1000,
      price: round2(price),
      avg_cost: round2(avgCost),
      total_return: round2((price - avgCost) * p.shares),
      equity: round2(equity),
      type: p.type,
    });
  }

  return holdings.sort((a, b) => b.total_return - a.total_return);
}

// ---------------------------------------------------------------------------
// Config + top-level fetch
// ---------------------------------------------------------------------------

export interface RobinhoodMcpConfig {
  url: string;
  client_id: string;
  client_secret?: string;
  refresh_token: string;
}

/**
 * Load MCP credentials from env vars (CI) or .robinhood-tokens.json
 * (written by `npm run robinhood-setup`). Returns null if not configured.
 */
export function loadRobinhoodMcpConfig(): RobinhoodMcpConfig | null {
  const url = process.env.ROBINHOOD_MCP_URL || DEFAULT_MCP_URL;

  if (process.env.ROBINHOOD_MCP_CLIENT_ID && process.env.ROBINHOOD_MCP_REFRESH_TOKEN) {
    return {
      url,
      client_id: process.env.ROBINHOOD_MCP_CLIENT_ID,
      client_secret: process.env.ROBINHOOD_MCP_CLIENT_SECRET || undefined,
      refresh_token: process.env.ROBINHOOD_MCP_REFRESH_TOKEN,
    };
  }

  try {
    const file = JSON.parse(readFileSync(TOKENS_PATH, "utf-8"));
    if (file.client_id && file.refresh_token) {
      return {
        url: file.url || url,
        client_id: file.client_id,
        client_secret: file.client_secret || undefined,
        refresh_token: file.refresh_token,
      };
    }
  } catch {}

  return null;
}

/** Persist a rotated refresh token so the next run keeps working. */
function persistRotatedToken(cfg: RobinhoodMcpConfig, newRefreshToken: string) {
  // Local runs: update the tokens file if it exists.
  try {
    const file = JSON.parse(readFileSync(TOKENS_PATH, "utf-8"));
    file.refresh_token = newRefreshToken;
    writeFileSync(TOKENS_PATH, JSON.stringify(file, null, 2) + "\n");
    console.log("  Updated .robinhood-tokens.json with rotated refresh token.");
  } catch {}

  // CI runs: emit the rotated token to a file so the workflow can update the
  // ROBINHOOD_MCP_REFRESH_TOKEN secret (see refresh-market-data.yml).
  const rotationFile = process.env.ROBINHOOD_ROTATED_TOKEN_FILE;
  if (rotationFile) {
    try {
      writeFileSync(rotationFile, newRefreshToken);
      console.log("  Refresh token was rotated — wrote new token for secret update.");
    } catch (e) {
      console.warn("  Could not write rotated token file:", e);
    }
  }
}

export async function fetchRobinhoodMcpHoldings(cfg: RobinhoodMcpConfig): Promise<Holding[]> {
  const endpoints = await discoverOAuthEndpoints(cfg.url);
  const tokens = await refreshAccessToken(
    endpoints.token_endpoint,
    cfg.client_id,
    cfg.refresh_token,
    cfg.client_secret
  );
  if (tokens.refresh_token !== cfg.refresh_token) {
    persistRotatedToken(cfg, tokens.refresh_token);
  }

  const client = new McpHttpClient(cfg.url, tokens.access_token);
  await client.initialize();

  const positionsResult = await client.callTool("get_equity_positions");
  const positions = parsePositions(toolResultToData(positionsResult));
  if (!positions.length) {
    throw new Error("get_equity_positions returned no parseable positions");
  }

  // Fill in live prices for any positions that came back without one.
  let quotes: Record<string, number> = {};
  const missing = positions.filter((p) => p.price == null && p.equity == null).map((p) => p.symbol);
  if (missing.length) {
    try {
      const quotesResult = await client.callTool("get_equity_quotes", { symbols: missing });
      quotes = parseQuotes(toolResultToData(quotesResult));
    } catch (e) {
      console.warn("  Quote lookup failed (positions without prices will be skipped):", e);
    }
  }

  return toHoldings(positions, quotes);
}

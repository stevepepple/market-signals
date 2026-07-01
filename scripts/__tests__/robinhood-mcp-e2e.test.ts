import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "http";
import { readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { fetchRobinhoodMcpHoldings } from "../robinhood-mcp";

/**
 * Full-flow test against a mock Robinhood MCP server: OAuth discovery,
 * refresh-token exchange (with rotation), MCP initialize over streamable
 * HTTP, and tool calls returning SSE + plain JSON responses.
 */
describe("fetchRobinhoodMcpHoldings (mock server)", () => {
  let server: Server;
  let origin: string;
  const rotationFile = join(tmpdir(), `rh-rotated-${process.pid}`);
  const seenAuth: string[] = [];

  beforeAll(async () => {
    server = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      let body = "";
      for await (const chunk of req) body += chunk;

      if (url.pathname === "/.well-known/oauth-protected-resource/mcp/trading") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ authorization_servers: [origin] }));
        return;
      }
      if (url.pathname === "/.well-known/oauth-authorization-server") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            authorization_endpoint: `${origin}/authorize`,
            token_endpoint: `${origin}/token`,
          })
        );
        return;
      }
      if (url.pathname === "/token") {
        const params = new URLSearchParams(body);
        if (
          params.get("grant_type") !== "refresh_token" ||
          params.get("refresh_token") !== "rt-old" ||
          params.get("client_id") !== "client-1"
        ) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_grant" }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        // Rotate the refresh token to exercise persistence.
        res.end(
          JSON.stringify({ access_token: "at-1", refresh_token: "rt-new", expires_in: 3600 })
        );
        return;
      }
      if (url.pathname === "/mcp/trading" && req.method === "POST") {
        seenAuth.push(req.headers.authorization ?? "");
        const msg = JSON.parse(body);

        if (msg.method === "initialize") {
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Mcp-Session-Id": "sess-1",
          });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: msg.id,
              result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "mock" } },
            })
          );
          return;
        }
        if (msg.method === "notifications/initialized") {
          res.writeHead(202);
          res.end();
          return;
        }
        if (msg.method === "tools/call" && msg.params.name === "get_equity_positions") {
          if (req.headers["mcp-session-id"] !== "sess-1") {
            res.writeHead(400);
            res.end("missing session");
            return;
          }
          const positions = {
            positions: [
              {
                symbol: "AAPL",
                instrument_name: "Apple",
                quantity: "2",
                average_buy_price: "150.00",
                last_trade_price: "200.00",
                instrument_type: "stock",
              },
              {
                symbol: "VTI",
                instrument_name: "Vanguard Total Stock Market ETF",
                quantity: "1",
                average_buy_price: "220.00",
                instrument_type: "etf", // no price → resolved via get_equity_quotes
              },
            ],
          };
          const result = {
            jsonrpc: "2.0",
            id: msg.id,
            result: { content: [{ type: "text", text: JSON.stringify(positions) }] },
          };
          res.writeHead(200, { "Content-Type": "text/event-stream" });
          res.end(`event: message\ndata: ${JSON.stringify(result)}\n\n`);
          return;
        }
        if (msg.method === "tools/call" && msg.params.name === "get_equity_quotes") {
          expect(msg.params.arguments.symbols).toEqual(["VTI"]);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: msg.id,
              result: {
                content: [
                  { type: "text", text: JSON.stringify([{ symbol: "VTI", last_trade_price: "260.00" }]) },
                ],
              },
            })
          );
          return;
        }
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no address");
    origin = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(() => {
    server.close();
    delete process.env.ROBINHOOD_ROTATED_TOKEN_FILE;
    rmSync(rotationFile, { force: true });
  });

  it("authenticates, fetches positions, fills quotes, and persists rotation", async () => {
    process.env.ROBINHOOD_ROTATED_TOKEN_FILE = rotationFile;

    const holdings = await fetchRobinhoodMcpHoldings({
      url: `${origin}/mcp/trading`,
      client_id: "client-1",
      refresh_token: "rt-old",
    });

    expect(holdings).toEqual([
      {
        name: "Apple",
        symbol: "AAPL",
        shares: 2,
        price: 200,
        avg_cost: 150,
        total_return: 100,
        equity: 400,
        type: "stock",
      },
      {
        name: "Vanguard Total Stock Market ETF",
        symbol: "VTI",
        shares: 1,
        price: 260,
        avg_cost: 220,
        total_return: 40,
        equity: 260,
        type: "ETF",
      },
    ]);

    // Every MCP request carried the fresh access token
    expect(seenAuth.every((h) => h === "Bearer at-1")).toBe(true);
    // Rotated refresh token was written for the workflow to persist
    expect(readFileSync(rotationFile, "utf-8")).toBe("rt-new");
  });
});

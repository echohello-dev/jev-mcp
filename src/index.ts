// MCP stdio server — JSON-RPC over stdin/stdout, one message per line.
// Implements: initialize, tools/list, tools/call. Nothing else.

import { TOOLS, findTool } from "./tools.js";
import { resolveProvider } from "./provider.js";
import * as handlers from "./handlers.js";

const SERVER_INFO = { name: "jev-mcp", version: "0.1.0" };
const PROTOCOL_VERSION = "2024-11-05";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const encoder = new TextEncoder();

let buffer = "";
let provider = resolveProvider();
const pending: Promise<void>[] = [];
if (!provider) {
  process.stderr.write("jevmcp: no TYPESAFE_API_KEY or OPENROUTER_API_KEY set\n");
}

async function main(): Promise<void> {
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const p = handleLine(line).catch((err) => {
        process.stderr.write(`jevmcp: handler error: ${(err as Error).message}\n`);
      });
      pending.push(p);
    }
  });
  process.stdin.on("end", async () => {
    await Promise.all(pending);
    process.exit(0);
  });
}

async function handleLine(line: string): Promise<void> {
  let req: JsonRpcRequest;
  try {
    req = JSON.parse(line) as JsonRpcRequest;
  } catch {
    return;
  }
  const id = req.id ?? null;
  let resp: JsonRpcResponse;
  try {
    switch (req.method) {
      case "initialize":
        resp = { jsonrpc: "2.0", id, result: { protocolVersion: PROTOCOL_VERSION, serverInfo: SERVER_INFO, capabilities: { tools: {} } } };
        break;
      case "notifications/initialized":
        return; // no response
      case "tools/list":
        resp = { jsonrpc: "2.0", id, result: { tools: TOOLS } };
        break;
      case "tools/call":
        resp = await handleToolCall(id, req.params);
        break;
      case "ping":
        resp = { jsonrpc: "2.0", id, result: {} };
        break;
      default:
        resp = { jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${req.method}` } };
    }
  } catch (e) {
    resp = { jsonrpc: "2.0", id, error: { code: -32603, message: (e as Error).message } };
  }
  write(resp);
}

async function handleToolCall(id: number | string | null, params: unknown): Promise<JsonRpcResponse> {
  const p = params as { name?: string; arguments?: Record<string, unknown> } | undefined;
  const name = p?.name;
  const args = (p?.arguments ?? {}) as Record<string, unknown>;
  const tool = name ? findTool(name) : undefined;
  if (!tool) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: `unknown tool: ${name}` } };
  }
  if (!provider) provider = resolveProvider();
  if (!provider) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: "no API key configured — set TYPESAFE_API_KEY or OPENROUTER_API_KEY in the server environment",
      },
    };
  }
  switch (name) {
    case "jev_verify":
      return { jsonrpc: "2.0", id, result: await handlers.jev_verify(provider, args as Parameters<typeof handlers.jev_verify>[1]) };
    case "jev_classify":
      return { jsonrpc: "2.0", id, result: await handlers.jev_classify(provider, args as Parameters<typeof handlers.jev_classify>[1]) };
    case "jev_screen":
      return { jsonrpc: "2.0", id, result: await handlers.jev_screen(provider, args as Parameters<typeof handlers.jev_screen>[1]) };
    case "jev_decide":
      return { jsonrpc: "2.0", id, result: await handlers.jev_decide(provider, args as Parameters<typeof handlers.jev_decide>[1]) };
    case "jev_extract":
      return { jsonrpc: "2.0", id, result: await handlers.jev_extract(provider, args as Parameters<typeof handlers.jev_extract>[1]) };
    default:
      return { jsonrpc: "2.0", id, error: { code: -32602, message: `no handler for tool: ${name}` } };
  }
}

function write(obj: JsonRpcResponse): void {
  process.stdout.write(encoder.encode(JSON.stringify(obj) + "\n"));
}

main().catch((err) => {
  process.stderr.write(`jevmcp: fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
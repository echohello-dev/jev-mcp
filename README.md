# jev-mcp

Minimal MCP server exposing TypeSafe/OpenRouter `/api/alpha/decisions` as
five judgment tools for coding agents.

## Tools

| Tool | Purpose | Returns |
|---|---|---|
| `jev_verify` | Does the evidence support the claim? | noul (0..1) + confidence |
| `jev_classify` | Which label fits the state? | choice + probabilities + confidence |
| `jev_screen` | Relevance + risk for fetched content | choice + score |
| `jev_decide` | Pick from rich options with criteria | choice + probabilities |
| `jev_extract` | Detect named fields in a state | per-field noul |

## Install (run)

```bash
bun install
bun run build
```

## Register with an MCP client

OpenCode / Claude Code:

```json
{
  "mcpServers": {
    "jev": {
      "command": "node",
      "args": ["/path/to/jev-mcp/dist/index.js"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-..."
      }
    }
  }
}
```

Or use `TYPESAFE_API_KEY` (TypeSafe direct, cheaper) instead of `OPENROUTER_API_KEY`.

The MCP client passes tool inputs as JSON; the server returns JSON text content
plus `isError: true` when `fail_on` predicates match.

## Wire example

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "jev_classify",
    "arguments": {
      "state": "I want to wash my car, the wash is 50m away",
      "choices": ["question", "command", "smalltalk", "info"]
    }
  }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"type\":\"choice\",\"choice\":\"info\",\"probabilities\":{\"info\":0.96,...},\"confidence\":0.94}"
      }
    ]
  }
}
```

## Tool input contracts

See `src/tools.ts` for the JSON Schema for each tool. Highlights:

- `jev_verify` — `{ claim, evidence, instructions?, fail_on?: "true"|"false", timeout_ms? }`
- `jev_classify` — `{ state, choices: string[], criteria?, instructions?, fail_on?, timeout_ms? }`
- `jev_screen` — `{ text, relevance_labels?, fail_on?: { relevance?, min_risk? }, timeout_ms? }`
- `jev_decide` — `{ state, options: Record<key, description>, instructions?, fail_on?, timeout_ms? }`
- `jev_extract` — `{ state, fields: string[], timeout_ms? }`

`fail_on` predicates return `isError: true` (rather than silently passing) when
matched, so agents see the warning and decide whether to proceed.

## Design notes

- Single-binary, zero runtime deps. Pure Bun stdlib + `node:fs/promises`.
- Provider abstraction at the wire level (TypeSafe direct or OpenRouter via the
  `/api/alpha/decisions` endpoint). Routing picks TYPESAFE if set, otherwise OR.
- No telemetry, no state across calls. Each tool call is independent.
- Original implementation. Design intent informed only by the public MCP
  protocol and the public TypeSafe/OpenRouter API contracts.

## License

MIT
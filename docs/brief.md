# jevmcp — behavioural spec

Target observed: an MCP server that exposes TypeSafe Jev judgment primitives as tools a coding agent can call. Built from the public MCP protocol spec + the public /api/alpha/decisions contract.

## Behavioural spec (numbered)

1. Server runs as `npx -y @echohello/jevmcp` (or `bunx`), speaks stdio MCP transport.
2. Exposes 5 tools (chosen recreation scope): `jev_verify`, `jev_classify`, `jev_screen`, `jev_decide`, `jev_extract`.
3. Each tool accepts the same question schema the upstream API expects, plus a `state` payload.
4. Server reads `TYPESAFE_API_KEY` or `OPENROUTER_API_KEY` from env (TYPESAFE wins, cheaper).
5. Server has no state across calls — every tool call is independent.
7. Errors return MCP tool-error responses, not silent passes.
8. No telemetry, no network calls other than to the provider.

## Design choices that differ from upstream

- 5 tools vs ~10. Focused on the highest-utility primitives.
- Provider abstraction (TypeSafe + OpenRouter) at the wire level, not hard-coded to one API.
- Single Bun file, zero deps. Most of the upstream MCP servers are 50+ files of TypeScript plumbing.
- Tool input schemas expressed as plain JSON Schema (no Zod runtime overhead).
- Server identifies itself in MCP `initialize` handshake with name + version from package.json.

## Out of scope

- Server-side rate limiting / queueing
- Caching layer
- Per-tool provider override
- MCP resources / prompts (only tools)
- Authentication / OAuth dance (stdio transport = local trust boundary)

## Tool definitions (recreation's chosen surface)

| Tool | Purpose | Upstream primitives |
|---|---|---|
| `jev_verify` | Does the evidence support the claim? | one noul |
| `jev_classify` | Which label fits this state? | one choice |
| `jev_screen` | Is this content relevant / safe? | one choice + one score |
| `jev_decide` | Pick between options with criteria | one choice with structured criteria |
| `jev_extract` | Pull a verbatim field from text | one choice over candidate spans |

## Wire contract (per tool)

```
{
  state: string | object,
  question?: string,             // optional override of default instructions
  choices?: string[],             // for classify / decide
  criteria?: object | string[],  // for decide (rich criteria)
  options?: object,               // for screen (relevance + risk thresholds)
  fail_on?: string,               // optional: throw MCP error if matching
}
```

Output:
```
{
  choice: string,
  probabilities: { [label: string]: number },
  confidence: number,
  raw: <full upstream response>,
}
```

or for noul / score:

```
{ noul: number } or { score: number, legend: { ... } }
```
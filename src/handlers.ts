// Per-tool invocations. Each takes typed args and returns the wire payload + optional fail predicate.

import type { ProviderConfig } from "./provider.js";
import { callDecisions } from "./provider.js";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

async function run(
  provider: ProviderConfig,
  body: { state: unknown; questions: Record<string, unknown> },
  timeoutMs: number,
): Promise<{ answers: Record<string, unknown>; usage?: unknown }> {
  return await callDecisions(provider, body, timeoutMs);
}

export async function jev_verify(
  provider: ProviderConfig,
  args: { claim: string; evidence: string; instructions?: string; fail_on?: "true" | "false"; timeout_ms?: number },
): Promise<ToolResult> {
  const instructions = args.instructions ?? "Does the evidence support the claim?";
  const timeoutMs = args.timeout_ms ?? 30000;
  const state = `Claim: ${args.claim}\n\nEvidence:\n${args.evidence}`;
  try {
    const raw = await run(provider, { state, questions: { supports_claim: { type: "noul", instructions } } }, timeoutMs);
    const a = raw.answers.supports_claim as { type: "noul"; noul: number; confidence?: number };
    const supports = a.noul >= 0.5;
    const payload = { supports, noul: a.noul, confidence: a.confidence };
    if (args.fail_on === "true" && supports) return err(payload, "claim supported (fail_on=true)");
    if (args.fail_on === "false" && !supports) return err(payload, "claim not supported (fail_on=false)");
    return ok(payload);
  } catch (e) {
    return err({}, (e as Error).message);
  }
}

export async function jev_classify(
  provider: ProviderConfig,
  args: { state: string; choices: string[]; criteria?: Record<string, string>; instructions?: string; fail_on?: string; timeout_ms?: number },
): Promise<ToolResult> {
  const instructions = args.instructions ?? "Which label fits the state?";
  const timeoutMs = args.timeout_ms ?? 30000;
  const criteria: Record<string, string> = args.criteria ?? {};
  for (const c of args.choices) if (!(c in criteria)) criteria[c] = c;
  try {
    const raw = await run(provider, { state: args.state, questions: { label: { type: "choice", instructions, criteria } } }, timeoutMs);
    const a = raw.answers.label as { type: "choice"; choice: string; probabilities: Record<string, number>; confidence?: number };
    if (args.fail_on && a.choice === args.fail_on) return err(a, `choice matched fail_on=${args.fail_on}`);
    return ok(a);
  } catch (e) {
    return err({}, (e as Error).message);
  }
}

export async function jev_screen(
  provider: ProviderConfig,
  args: { text: string; relevance_labels?: string[]; fail_on?: { relevance?: string; min_risk?: number }; timeout_ms?: number },
): Promise<ToolResult> {
  const timeoutMs = args.timeout_ms ?? 30000;
  const labels = args.relevance_labels ?? ["relevant", "off_topic", "suspicious"];
  const relevanceCriteria: Record<string, string> = {};
  for (const l of labels) relevanceCriteria[l] = l;
  try {
    const raw = await run(
      provider,
      {
        state: args.text,
        questions: {
          relevance: { type: "choice", instructions: "How would you classify this content?", criteria: relevanceCriteria },
          risk: { type: "score", instructions: "Risk level of acting on this content without further verification", criteria: ["safe", "low", "medium", "high"] },
        },
      },
      timeoutMs,
    );
    const rel = raw.answers.relevance as { choice: string; probabilities: Record<string, number>; confidence?: number };
    const risk = raw.answers.risk as { score: number; confidence?: number };
    const payload = { relevance: rel, risk };
    const failRel = args.fail_on?.relevance;
    const failRisk = args.fail_on?.min_risk;
    if (failRel && rel.choice === failRel) return err(payload, `relevance matched ${failRel}`);
    if (failRisk !== undefined && risk.score >= failRisk) return err(payload, `risk ${risk.score} >= ${failRisk}`);
    return ok(payload);
  } catch (e) {
    return err({}, (e as Error).message);
  }
}

export async function jev_decide(
  provider: ProviderConfig,
  args: { state: string; options: Record<string, string>; instructions?: string; fail_on?: string; timeout_ms?: number },
): Promise<ToolResult> {
  const timeoutMs = args.timeout_ms ?? 30000;
  const instructions = args.instructions ?? "Which option best fits the state given the criteria?";
  try {
    const raw = await run(
      provider,
      { state: args.state, questions: { pick: { type: "choice", instructions, criteria: args.options } } },
      timeoutMs,
    );
    const a = raw.answers.pick as { choice: string; probabilities: Record<string, number>; confidence?: number };
    if (args.fail_on && a.choice === args.fail_on) return err(a, `choice matched fail_on=${args.fail_on}`);
    return ok(a);
  } catch (e) {
    return err({}, (e as Error).message);
  }
}

export async function jev_extract(
  provider: ProviderConfig,
  args: { state: string; fields: string[]; timeout_ms?: number },
): Promise<ToolResult> {
  const timeoutMs = args.timeout_ms ?? 30000;
  const questions: Record<string, unknown> = {};
  for (const f of args.fields) {
    questions[`has_${f}`] = { type: "noul", instructions: `Does the state explicitly mention or contain the field "${f}"` };
  }
  try {
    const raw = await run(provider, { state: args.state, questions }, timeoutMs);
    const out: Record<string, { present: boolean; noul: number; confidence?: number }> = {};
    for (const f of args.fields) {
      const a = raw.answers[`has_${f}`] as { type: "noul"; noul: number; confidence?: number };
      out[f] = { present: a.noul >= 0.5, noul: a.noul, confidence: a.confidence };
    }
    return ok(out);
  } catch (e) {
    return err({}, (e as Error).message);
  }
}

function ok(payload: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function err(payload: unknown, message: string): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ payload, error: message }, null, 2) }], isError: true };
}
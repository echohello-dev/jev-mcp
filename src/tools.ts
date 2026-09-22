// MCP tool definitions and handlers. Five tools, original schema design.

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOLS: ToolDef[] = [
  {
    name: "jev_verify",
    description:
      "Decide whether the evidence supports the claim. Returns a noul (yes probability 0..1) and confidence.",
    inputSchema: {
      type: "object",
      properties: {
        claim: { type: "string", description: "The statement to verify." },
        evidence: { type: "string", description: "Source text that should support or refute the claim." },
        instructions: { type: "string", description: "Optional override of the question phrasing." },
        fail_on: {
          type: "string",
          enum: ["true", "false"],
          description: "If set, throw an MCP tool error when the noul crosses 0.5 in this direction.",
        },
        timeout_ms: { type: "integer", minimum: 1000, maximum: 120000, default: 30000 },
      },
      required: ["claim", "evidence"],
    },
  },
  {
    name: "jev_classify",
    description:
      "Pick the best label for the state. Returns the chosen label, full probability distribution, and confidence.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "string", description: "Text or JSON-stringified object to classify." },
        choices: { type: "array", items: { type: "string" }, minItems: 2, description: "Candidate labels." },
        criteria: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Optional per-label definition; defaults to label-as-criteria.",
        },
        instructions: { type: "string" },
        fail_on: { type: "string", description: "Label that triggers an MCP tool error." },
        timeout_ms: { type: "integer", minimum: 1000, maximum: 120000, default: 30000 },
      },
      required: ["state", "choices"],
    },
  },
  {
    name: "jev_screen",
    description:
      "Judge fetched content for relevance (choice) and risk (score 0..2). Returns both primitives plus confidence.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Content to screen." },
        relevance_labels: {
          type: "array",
          items: { type: "string" },
          default: ["relevant", "off_topic", "suspicious"],
          description: "Override the default relevance labels.",
        },
        fail_on: {
          type: "object",
          properties: {
            relevance: { type: "string" },
            min_risk: { type: "number", minimum: 0, maximum: 2 },
          },
          description: "Throw MCP tool error if relevance matches or risk >= min_risk.",
        },
        timeout_ms: { type: "integer", minimum: 1000, maximum: 120000, default: 30000 },
      },
      required: ["text"],
    },
  },
  {
    name: "jev_decide",
    description:
      "Pick one option from a structured criteria map. Use when choices need richer descriptions than plain labels.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "string" },
        options: {
          type: "object",
          additionalProperties: { type: "string" },
          minProperties: 2,
          description: "Map of option_key -> description. Minimum 2 options.",
        },
        instructions: { type: "string" },
        fail_on: { type: "string" },
        timeout_ms: { type: "integer", minimum: 1000, maximum: 120000, default: 30000 },
      },
      required: ["state", "options"],
    },
  },
  {
    name: "jev_extract",
    description:
      "Decide whether the state explicitly contains the named field, and return a yes/no probability.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "string" },
        fields: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Field names to check for.",
        },
        timeout_ms: { type: "integer", minimum: 1000, maximum: 120000, default: 30000 },
      },
      required: ["state", "fields"],
    },
  },
];

export function findTool(name: string): ToolDef | undefined {
  return TOOLS.find((t) => t.name === name);
}
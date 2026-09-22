// Provider routing — TypeSafe direct wins if both keys present, else OpenRouter.

export type ProviderName = "typesafe" | "openrouter";

export interface ProviderConfig {
  name: ProviderName;
  url: string;
  key: string;
  model: string;
}

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const TYPESAFE_MODEL = "jev-latest";
const OPENROUTER_URL = "https://openrouter.ai/api/alpha/decisions";
const OPENROUTER_MODEL = "~typesafe/jev-latest";

export function resolveProvider(env: Record<string, string | undefined> = process.env): ProviderConfig | null {
  if (env.TYPESAFE_API_KEY) {
    return { name: "typesafe", url: TYPESAFE_URL, key: env.TYPESAFE_API_KEY, model: TYPESAFE_MODEL };
  }
  if (env.OPENROUTER_API_KEY) {
    return { name: "openrouter", url: OPENROUTER_URL, key: env.OPENROUTER_API_KEY, model: OPENROUTER_MODEL };
  }
  return null;
}

export async function callDecisions(
  provider: ProviderConfig,
  body: { state: unknown; questions: Record<string, unknown> },
  timeoutMs: number,
): Promise<{ answers: Record<string, unknown>; usage?: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify({ ...body, model: provider.model }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`provider ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as { answers: Record<string, unknown>; usage?: unknown };
  } finally {
    clearTimeout(timer);
  }
}
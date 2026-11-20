// Gratis taalmodellen via hun OpenAI-compatibele API's. Volgorde = fallback-volgorde.
// Docs:
// - Groq:       https://console.groq.com/docs/openai
// - Gemini:     https://ai.google.dev/gemini-api/docs/openai
// - OpenRouter: https://openrouter.ai/docs/quickstart
// - Ollama:     https://docs.ollama.com/api/openai-compatibility

import OpenAI from "openai";

export interface ProviderConfig {
  name: string;
  baseURL: string;
  apiKey?: string;
  model: string;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export function providerConfigs(): ProviderConfig[] {
  const all: Record<string, ProviderConfig> = {
    groq: {
      name: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: env("GROQ_API_KEY"),
      model: env("GROQ_MODEL") ?? "openai/gpt-oss-120b",
    },
    gemini: {
      name: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: env("GEMINI_API_KEY"),
      model: env("GEMINI_MODEL") ?? "gemini-flash-lite-latest",
    },
    openrouter: {
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: env("OPENROUTER_API_KEY"),
      model: env("OPENROUTER_MODEL") ?? "openrouter/free",
    },
    ollama: {
      name: "ollama",
      baseURL: env("OLLAMA_BASE_URL") ?? "http://localhost:11434/v1",
      apiKey: env("OLLAMA_MODEL") ? "ollama" : undefined, // alleen actief als OLLAMA_MODEL gezet is
      model: env("OLLAMA_MODEL") ?? "gpt-oss:20b",
    },
  };
  const order = (env("COACH_PROVIDERS") ?? "groq,gemini")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return order.map((n) => all[n]).filter((p): p is ProviderConfig => !!p && !!p.apiKey);
}

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export async function complete(
  p: ProviderConfig,
  messages: LlmMessage[],
): Promise<string> {
  const client = new OpenAI({ baseURL: p.baseURL, apiKey: p.apiKey, maxRetries: 0, timeout: 60_000 });
  const res = await client.chat.completions.create({
    model: p.model,
    messages,
    temperature: 0.3,
  });
  const text = res.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Leeg antwoord van het model.");
  return text;
}

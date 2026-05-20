export const PROVIDERS = {
  google: {
    label: "Google Gemini",
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    // All 5 verified to exist on the Gemini API. Free-tier quota is per-day;
    // flash-lite has the most generous per-day cap so it's the default.
    models: [
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
    ],
    default: "gemini-2.5-flash-lite",
  },
  groq: {
    label: "Groq (cực nhanh)",
    envKey: "GROQ_API_KEY",
    // Verified active 2026-05-20 against https://api.groq.com/openai/v1/models.
    // Old llama3, mixtral, gemma2 were decommissioned by Groq and removed here.
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "qwen/qwen3-32b",
      "meta-llama/llama-4-scout-17b-16e-instruct",
    ],
    default: "llama-3.3-70b-versatile",
  },
  github: {
    label: "GitHub Models",
    envKey: "GITHUB_TOKEN",
    // Verified active 2026-05-20 against https://models.inference.ai.azure.com/models.
    // Llama-3.1-8B / 405B are listed but DO NOT support function-calling through the
    // Azure inference endpoint (they reply in prose without emitting tool-calls), so
    // they are unusable for an agent UI. Removed 2026-05-20.
    models: [
      "gpt-4o-mini",
      "gpt-4o",
    ],
    default: "gpt-4o-mini",
  },
} as const

export type ProviderKey = keyof typeof PROVIDERS

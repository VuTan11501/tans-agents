import type { ProviderKey } from "@/lib/providers"

/**
 * Free-tier daily request limits per model (best-effort, public docs as of 2026-05).
 * Matched by regex against the model id.
 *
 * `rpd: null` = effectively unlimited (no daily cap, only per-minute throttle).
 * Order matters — first match wins.
 */
type LimitRule = {
  match: RegExp
  /** Requests per day, or null for unlimited / unknown-but-generous. */
  rpd: number | null
  /** Optional human label for tooltip. */
  note?: string
}

const RULES: Record<ProviderKey, LimitRule[]> = {
  google: [
    { match: /gemini-2\.5-pro/i, rpd: 100, note: "Free tier: 100 req/day" },
    { match: /gemini-2\.5-flash-lite/i, rpd: 1000, note: "Free tier: 1000 req/day" },
    { match: /gemini-2\.5-flash/i, rpd: 250, note: "Free tier: 250 req/day" },
    { match: /gemini-2\.0-flash-lite/i, rpd: 200, note: "Free tier: 200 req/day" },
    { match: /gemini-2\.0-flash/i, rpd: 200, note: "Free tier: 200 req/day" },
    { match: /gemini-flash-lite-latest/i, rpd: 1000 },
    { match: /gemini-flash-latest/i, rpd: 250 },
    { match: /gemma-/i, rpd: 14400, note: "Gemma free tier: 14,400 req/day" },
    { match: /.*/, rpd: null, note: "Không rõ giới hạn — coi như không cap" },
  ],
  groq: [
    // Groq free tier: ~14,400 RPD trên hầu hết model (khác nhau theo model nhưng đều rất rộng).
    { match: /llama-3\.3-70b/i, rpd: 1000, note: "Groq free: ~1000 req/day" },
    { match: /llama-3\.1-8b/i, rpd: 14400, note: "Groq free: 14,400 req/day" },
    { match: /llama-4-/i, rpd: 1000 },
    { match: /qwen/i, rpd: 1000 },
    { match: /gpt-oss-120b/i, rpd: 1000 },
    { match: /gpt-oss-20b/i, rpd: 1000 },
    { match: /.*/, rpd: 1000, note: "Groq free: ~1000 req/day mặc định" },
  ],
  github: [
    // GitHub Models free: ~50 req/day cho Low-tier, 150 cho mini/light. Per docs tháng 5/2026.
    { match: /gpt-5/i, rpd: 25 },
    { match: /gpt-4o-mini/i, rpd: 150, note: "GitHub Models: 150 req/day" },
    { match: /gpt-4o/i, rpd: 50, note: "GitHub Models: 50 req/day" },
    { match: /o1-mini/i, rpd: 50 },
    { match: /o1/i, rpd: 25 },
    { match: /phi-/i, rpd: 150 },
    { match: /mistral-/i, rpd: 50 },
    { match: /llama-/i, rpd: 50 },
    { match: /.*/, rpd: 50, note: "GitHub Models free: 50 req/day mặc định" },
  ],
}

export function getModelLimit(provider: ProviderKey, model: string): LimitRule {
  const rules = RULES[provider] ?? []
  for (const r of rules) {
    if (r.match.test(model)) return r
  }
  return { match: /.*/, rpd: null }
}

/** True nếu model không có per-day cap (hiển thị icon ∞). */
export function isUnlimited(provider: ProviderKey, model: string): boolean {
  return getModelLimit(provider, model).rpd === null
}

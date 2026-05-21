import type { ProviderKey } from "@/lib/providers"

/**
 * Free-tier daily request limits per model (best-effort, public docs as of 2026-05).
 * Matched by regex against the model id.
 *
 * `rpd: null` = effectively unlimited (no daily cap, only per-minute throttle).
 * Order matters — first match wins.
 *
 * Sources:
 *  - Google AI Studio rate-limit page (https://aistudio.google.com/rate-limit) — dynamic per account
 *  - Groq console docs (https://console.groq.com/docs/rate-limits)
 *  - GitHub Models docs (free tier ~50 req/day Low, ~150 req/day mini)
 *
 * NOTE: Google không expose rate-limit qua response headers → bảng này là nguồn duy nhất
 * cho Google models. Groq + GitHub có headers thật, sẽ override bảng này khi user gọi
 * (xem lib/usage-tracker.ts + lib/rate-limit-headers.ts).
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
    { match: /gemini-2\.5-pro/i, rpd: 100, note: "Free tier: 100 req/ngày (5 RPM)" },
    { match: /gemini-2\.5-flash-lite/i, rpd: 1000, note: "Free tier: 1000 req/ngày (15 RPM)" },
    { match: /gemini-2\.5-flash/i, rpd: 250, note: "Free tier: 250 req/ngày (10 RPM)" },
    { match: /gemini-2\.0-flash-lite/i, rpd: 200, note: "Free tier: 200 req/ngày (30 RPM)" },
    { match: /gemini-2\.0-flash/i, rpd: 200, note: "Free tier: 200 req/ngày (15 RPM)" },
    { match: /gemini-flash-lite-latest/i, rpd: 1000, note: "Free tier: 1000 req/ngày" },
    { match: /gemini-flash-latest/i, rpd: 250, note: "Free tier: 250 req/ngày" },
    // Gemma trên Google AI Studio chỉ giới hạn RPM/TPM, KHÔNG có cap theo ngày (free tier).
    // Verified từ Google AI Studio rate-limit dashboard (2026-05).
    { match: /gemma-/i, rpd: null, note: "Gemma free: chỉ giới hạn RPM/TPM, không có cap/ngày" },
    { match: /.*/, rpd: null, note: "Không rõ giới hạn — coi như không cap" },
  ],
  groq: [
    // Groq free tier — verified từ console.groq.com/docs/rate-limits (2026-05).
    // Hầu hết model = 1000 RPD; llama-3.1-8b-instant cao hơn = 14,400 RPD.
    // CHÚ Ý: Groq trả rate-limit qua response headers → bảng này chỉ là fallback
    // trước khi user gọi request đầu tiên (xem lib/rate-limit-headers.ts).
    { match: /llama-3\.1-8b-instant/i, rpd: 14400, note: "Groq free: 14,400 req/ngày (30 RPM)" },
    { match: /llama-3\.3-70b/i, rpd: 1000, note: "Groq free: 1000 req/ngày (30 RPM)" },
    { match: /llama-4-/i, rpd: 1000, note: "Groq free: 1000 req/ngày (30 RPM)" },
    { match: /qwen/i, rpd: 1000, note: "Groq free: 1000 req/ngày (60 RPM)" },
    { match: /gpt-oss-/i, rpd: 1000, note: "Groq free: 1000 req/ngày (30 RPM)" },
    { match: /deepseek/i, rpd: 1000, note: "Groq free: 1000 req/ngày" },
    { match: /.*/, rpd: 1000, note: "Groq free: 1000 req/ngày (mặc định)" },
  ],
  github: [
    // GitHub Models — Copilot Free tier (no Copilot subscription).
    // Source: https://docs.github.com/en/github-models/use-github-models/prototyping-with-ai-models#rate-limits
    // CHÚ Ý: Order matters — specific patterns trước generic. GitHub trả headers thật.
    //
    // Reasoning models có cap rất thấp:
    { match: /deepseek-r1|mai-ds-r1/i, rpd: 8, note: "GitHub Free: 8 req/ngày (1 RPM) — reasoning model" },
    { match: /grok-3-mini/i, rpd: 30, note: "GitHub Free: 30 req/ngày (2 RPM)" },
    { match: /grok-3/i, rpd: 15, note: "GitHub Free: 15 req/ngày (1 RPM)" },
    // OpenAI o-series + GPT-5: Copilot Free = không truy cập, Copilot Pro = 8-12 RPD.
    // Dùng Pro tier estimate vì GitHub trả real headers — nếu user là Free, sẽ thấy 401/403
    // (header parsing override sẽ ra số thật khi gọi được).
    { match: /^gpt-5-(mini|nano|chat)|\/gpt-5-(mini|nano|chat)/i, rpd: 12, note: "GitHub: 12 req/ngày (Copilot Pro). Free tier không truy cập được." },
    { match: /^gpt-5|\/gpt-5/i, rpd: 8, note: "GitHub: 8 req/ngày (Copilot Pro). Free tier không truy cập được." },
    { match: /(^|\/)o[134]-mini|(^|\/)o[14]-mini/i, rpd: 12, note: "GitHub: 12 req/ngày (Copilot Pro). Free tier không truy cập được." },
    { match: /(^|\/)o[134](-|$)/i, rpd: 8, note: "GitHub: 8 req/ngày (Copilot Pro). Free tier không truy cập được." },
    // High tier models (large general):
    { match: /gpt-4o(?!-mini)|gpt-4-turbo|llama-3\.1-405b|llama-3\.3-70b|mistral-large/i, rpd: 50, note: "GitHub Free High tier: 50 req/ngày (10 RPM)" },
    // Low tier models (small/efficient — most generous):
    { match: /gpt-4o-mini|phi-|mistral-nemo|mistral-small|llama-3\.1-8b|llama-3-8b/i, rpd: 150, note: "GitHub Free Low tier: 150 req/ngày (15 RPM)" },
    // Embedding models:
    { match: /embedding|cohere-embed|text-embedding/i, rpd: 150, note: "GitHub Free Embedding: 150 req/ngày" },
    // Catch-all: assume Low tier (an toàn cho user vì không under-warn).
    { match: /.*/, rpd: 150, note: "GitHub Free (mặc định Low tier): 150 req/ngày" },
  ],
  openrouter: [
    // OpenRouter free tier — verified từ openrouter.ai/docs/limits (2026-05).
    // Models có suffix `:free` cap theo account: 50 req/ngày nếu chưa từng nạp,
    // 1000 req/ngày nếu đã từng nạp ≥$10. RPM = 20 cho free models.
    // CHÚ Ý: OpenRouter trả headers thật → bảng này chỉ là fallback.
    { match: /:free$/i, rpd: 50, note: "OpenRouter free: 50 req/ngày/model (1000 nếu đã nạp ≥$10). 20 RPM." },
    { match: /.*/, rpd: null, note: "OpenRouter paid model — billing theo token, không cap/ngày" },
  ],
  cerebras: [
    // Cerebras free tier — verified từ cloud.cerebras.ai/limits (2026-05).
    // Đồng đều 14,400 req/ngày + 30 RPM cho mọi model trên free plan.
    // Cerebras trả x-ratelimit-* headers thật.
    { match: /.*/, rpd: 14400, note: "Cerebras free: 14,400 req/ngày (30 RPM, 60K TPM)" },
  ],
  mistral: [
    // Mistral La Plateforme free tier — verified từ docs.mistral.ai/deployment/laplateforme/tier (2026-05).
    // Free tier không có RPD cap riêng, chỉ 1 RPS (60 RPM) + 500K TPM + 1B tokens/THÁNG.
    // Practically unlimited theo ngày cho normal use.
    { match: /codestral/i, rpd: null, note: "Mistral free: 1 RPS, 500K TPM, 1B tokens/tháng" },
    { match: /ministral/i, rpd: null, note: "Mistral free: 1 RPS, 500K TPM, 1B tokens/tháng" },
    { match: /.*/, rpd: null, note: "Mistral free: 1 RPS, 500K TPM, 1B tokens/tháng" },
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

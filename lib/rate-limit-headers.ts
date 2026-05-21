import type { ProviderKey } from "@/lib/providers"

/**
 * Real rate-limit info parsed from provider response headers.
 * Source = "provider" means data came from the provider itself (truth).
 */
export type RateLimitInfo = {
  remaining: number
  limit: number
  /** Seconds until reset. Optional. */
  resetSeconds?: number
  /** Per-minute or per-day window (provider-dependent). */
  window?: "minute" | "day" | "unknown"
  source: "provider"
  /** Unix ms when this snapshot was captured. */
  ts: number
}

function num(h: Headers | Record<string, string | string[] | undefined>, key: string): number | undefined {
  const v = h instanceof Headers ? h.get(key) : Array.isArray(h[key]) ? (h[key] as string[])[0] : (h[key] as string | undefined)
  if (v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function parseResetSeconds(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined
  // Groq format: "2m59.56s" or "59s" or just seconds.
  const trimmed = raw.trim()
  const m = trimmed.match(/^(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/)
  if (m && (m[1] || m[2])) {
    return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)
  }
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Parse provider-specific rate-limit headers.
 * Returns null if the provider doesn't expose this info (e.g. Google Gemini).
 */
export function parseRateLimitHeaders(
  provider: ProviderKey,
  headers: Headers | Record<string, string | string[] | undefined> | undefined,
): RateLimitInfo | null {
  if (!headers) return null
  const get = (k: string): string | null => {
    if (headers instanceof Headers) return headers.get(k)
    const v = (headers as Record<string, string | string[] | undefined>)[k.toLowerCase()]
    return Array.isArray(v) ? v[0] ?? null : (v ?? null)
  }

  if (provider === "groq") {
    const remaining = num(headers, "x-ratelimit-remaining-requests")
    const limit = num(headers, "x-ratelimit-limit-requests")
    const reset = parseResetSeconds(get("x-ratelimit-reset-requests"))
    if (remaining == null || limit == null) return null
    // Groq free tier "limit-requests" is typically per-day for chat models.
    return { remaining, limit, resetSeconds: reset, window: "day", source: "provider", ts: Date.now() }
  }

  if (provider === "github") {
    const remaining = num(headers, "x-ratelimit-remaining")
    const limit = num(headers, "x-ratelimit-limit")
    const resetEpoch = num(headers, "x-ratelimit-reset")
    if (remaining == null || limit == null) return null
    const resetSeconds = resetEpoch != null ? Math.max(0, resetEpoch - Math.floor(Date.now() / 1000)) : undefined
    return { remaining, limit, resetSeconds, window: "day", source: "provider", ts: Date.now() }
  }

  if (provider === "openrouter") {
    // OpenRouter dùng cùng pattern OpenAI-compat: x-ratelimit-remaining + x-ratelimit-limit.
    // Reset là epoch ms (không phải epoch giây như GitHub).
    const remaining = num(headers, "x-ratelimit-remaining")
    const limit = num(headers, "x-ratelimit-limit")
    const resetEpochMs = num(headers, "x-ratelimit-reset")
    if (remaining == null || limit == null) return null
    const resetSeconds =
      resetEpochMs != null ? Math.max(0, Math.floor((resetEpochMs - Date.now()) / 1000)) : undefined
    return { remaining, limit, resetSeconds, window: "day", source: "provider", ts: Date.now() }
  }

  if (provider === "cerebras") {
    // Cerebras dùng pattern Groq-compat (cùng kiểu x-ratelimit-*-requests).
    const remaining = num(headers, "x-ratelimit-remaining-requests-day") ?? num(headers, "x-ratelimit-remaining-requests")
    const limit = num(headers, "x-ratelimit-limit-requests-day") ?? num(headers, "x-ratelimit-limit-requests")
    const reset =
      parseResetSeconds(get("x-ratelimit-reset-requests-day")) ??
      parseResetSeconds(get("x-ratelimit-reset-requests"))
    if (remaining == null || limit == null) return null
    return { remaining, limit, resetSeconds: reset, window: "day", source: "provider", ts: Date.now() }
  }

  // Google / Gemini / Mistral La Plateforme do not expose standard rate-limit headers.
  return null
}

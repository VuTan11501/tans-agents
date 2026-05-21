import { getRedis } from "@/lib/redis"
import type { ProviderKey } from "@/lib/providers"
import type { UserKeys } from "@/lib/user-keys"
import type { RateLimitInfo } from "@/lib/rate-limit-headers"

/**
 * Cross-device rate-limit cache.
 *
 * We store the LATEST RateLimitInfo (parsed from provider response headers) per
 *   (apiKeyHash, provider, model)
 * in Upstash Redis. So any device using the same API key — anonymous shared env
 * key included — sees the SAME real provider-reported `remaining/limit`.
 *
 * - Counter approach was an estimate; this is provider truth (Groq + GitHub).
 * - Google Gemini does NOT expose headers → falls back to local-only estimate.
 *
 * Auto-expires 1h after last write so stale entries don't pile up if a key is rotated.
 */

/** Web Crypto SHA-256 — works in both edge and node runtimes. */
export async function hashApiKey(apiKey: string): Promise<string> {
  const buf = new TextEncoder().encode(apiKey)
  const digest = await crypto.subtle.digest("SHA-256", buf)
  const arr = Array.from(new Uint8Array(digest))
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16)
}

/** Resolve which API key would actually be used for a given provider, mirroring chat route logic. */
export async function resolveApiKeyFingerprint(provider: ProviderKey, userKeys?: UserKeys): Promise<string | null> {
  const userKey =
    provider === "google" ? userKeys?.gemini : provider === "groq" ? userKeys?.groq : userKeys?.github
  if (typeof userKey === "string" && userKey.trim()) return hashApiKey(userKey.trim())
  const envKey =
    provider === "google"
      ? process.env.GOOGLE_GENERATIVE_AI_API_KEY
      : provider === "groq"
      ? process.env.GROQ_API_KEY
      : process.env.GITHUB_TOKEN
  if (envKey) return hashApiKey(envKey)
  return null
}

function quotaKey(fingerprint: string, provider: ProviderKey, model: string) {
  return `quota:${fingerprint}:${provider}:${model}`
}

/**
 * Persist the latest provider-reported rate-limit snapshot for this key+model.
 * Returns true on success, false if Upstash unconfigured / key unresolvable / write failed.
 */
export async function recordProviderRateLimit(
  provider: ProviderKey,
  model: string,
  info: RateLimitInfo,
  userKeys?: UserKeys,
): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return false
  const fp = await resolveApiKeyFingerprint(provider, userKeys)
  if (!fp) return false
  const key = quotaKey(fp, provider, model)
  try {
    await redis.set(key, JSON.stringify(info), { ex: 60 * 60 })
    return true
  } catch {
    return false
  }
}

/**
 * Fetch the latest rate-limit snapshots for a list of (provider, model) tuples.
 * Returns:
 *   - null  → Upstash not configured (caller falls back to local-only).
 *   - {}    → Upstash configured but no entries yet (fresh API key).
 */
export async function getProviderRateLimits(
  items: Array<{ provider: ProviderKey; model: string }>,
  userKeys?: UserKeys,
): Promise<Record<string, RateLimitInfo> | null> {
  const redis = getRedis()
  if (!redis) return null
  if (items.length === 0) return {}
  const map: Array<{ pmKey: string; redisKey: string | null }> = []
  const keys: string[] = []
  for (const { provider, model } of items) {
    const fp = await resolveApiKeyFingerprint(provider, userKeys)
    const pmKey = `${provider}:${model}`
    if (!fp) {
      map.push({ pmKey, redisKey: null })
      continue
    }
    const rk = quotaKey(fp, provider, model)
    keys.push(rk)
    map.push({ pmKey, redisKey: rk })
  }
  const out: Record<string, RateLimitInfo> = {}
  if (keys.length === 0) return out
  try {
    const values = await redis.mget<Array<string | null>>(...keys)
    let i = 0
    for (const entry of map) {
      if (entry.redisKey === null) continue
      const v = values[i++]
      if (!v) continue
      try {
        const parsed = (typeof v === "string" ? JSON.parse(v) : v) as RateLimitInfo
        if (parsed && typeof parsed.remaining === "number" && typeof parsed.limit === "number") {
          out[entry.pmKey] = parsed
        }
      } catch {
        /* ignore malformed entry */
      }
    }
    return out
  } catch {
    return null
  }
}

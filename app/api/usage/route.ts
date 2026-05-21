import { NextResponse } from "next/server"
import { getProviderRateLimits } from "@/lib/usage-tracker"
import type { ProviderKey } from "@/lib/providers"
import type { UserKeys } from "@/lib/user-keys"

export const runtime = "nodejs"

/**
 * POST /api/usage
 * Body: { userKeys?: UserKeys, items: Array<{provider, model}> }
 * Returns: { source: 'provider', limits: Record<"<provider>:<model>", RateLimitInfo> }
 *
 * Data is REAL provider rate-limit info parsed from response headers (Groq, GitHub).
 * Google Gemini does not expose headers — its entries simply won't appear in `limits`.
 *
 * - 200 with { limits: {} } → Upstash configured but no entries yet (fresh key, or only Google used).
 * - 503                      → Upstash not configured at all (caller falls back to local estimate).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userKeys?: UserKeys
      items?: Array<{ provider: ProviderKey; model: string }>
    }
    const items = Array.isArray(body.items) ? body.items : []
    const limits = await getProviderRateLimits(items, body.userKeys)
    if (limits === null) {
      return NextResponse.json(
        { error: "Server-side usage tracking not configured" },
        { status: 503 },
      )
    }
    return NextResponse.json({ source: "provider", limits })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getRedis, syncKey } from "@/lib/redis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const VALID_SCOPES = ["sessions", "settings", "collections"] as const

interface Blob {
  data: Record<string, string>
  updated_at: number
}

async function getUser() {
  const session = await getServerSession(authOptions)
  const ghId = (session as any)?.ghId as string | undefined
  return ghId ?? null
}

export async function GET(req: NextRequest) {
  const ghId = await getUser()
  if (!ghId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const redis = getRedis()
  if (!redis) return NextResponse.json({ error: "sync_not_configured" }, { status: 503 })

  const scope = req.nextUrl.searchParams.get("scope") ?? ""
  if (!VALID_SCOPES.includes(scope as any)) {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 })
  }

  const stored = (await redis.get<Blob>(syncKey(ghId, scope))) ?? { data: {}, updated_at: 0 }
  return NextResponse.json(stored)
}

export async function PUT(req: NextRequest) {
  const ghId = await getUser()
  if (!ghId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 })

  const redis = getRedis()
  if (!redis) return NextResponse.json({ error: "sync_not_configured" }, { status: 503 })

  const scope = req.nextUrl.searchParams.get("scope") ?? ""
  if (!VALID_SCOPES.includes(scope as any)) {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 })
  }

  let body: Blob
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  if (!body || typeof body.updated_at !== "number" || !body.data || typeof body.data !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 })
  }

  // Cap blob size at ~3MB to protect Upstash quota.
  const size = JSON.stringify(body).length
  if (size > 3_000_000) {
    return NextResponse.json({ error: "payload_too_large", size }, { status: 413 })
  }

  // LWW: only overwrite if incoming is newer.
  const stored = (await redis.get<Blob>(syncKey(ghId, scope))) ?? { data: {}, updated_at: 0 }
  if (body.updated_at < stored.updated_at) {
    return NextResponse.json({ accepted: false, server: stored })
  }

  await redis.set(syncKey(ghId, scope), body)
  return NextResponse.json({ accepted: true, updated_at: body.updated_at })
}

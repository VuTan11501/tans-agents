import { NextResponse } from "next/server"
import { redactSessionForShare } from "@/lib/redact"

export const runtime = "edge"

const DEFAULT_TTL_DAYS = 7
const MAX_TTL_DAYS = 90

type ChatSession = {
  id: string
  title: string
  messages: any[]
  provider: string
  model: string
  createdAt: number
  updatedAt: number
  pinned?: boolean
  tags?: string[]
  enabledTools?: string[]
  [key: string]: unknown
}

type ShareEntry = {
  session: ChatSession
  expiresAt: number
  passwordHash?: string
}

declare global {
  // eslint-disable-next-line no-var
  var __shares: Map<string, ShareEntry> | undefined
}

function shareStore() {
  return (globalThis.__shares ??= new Map<string, ShareEntry>())
}

function pruneExpired(now = Date.now()) {
  const store = shareStore()
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) store.delete(id)
  }
}

function notFound() {
  return NextResponse.json({ error: "Share not found" }, { status: 404 })
}

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest("SHA-256", buf)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const session = body?.session as ChatSession | undefined
  const redact = body?.redact !== false
  const password = typeof body?.password === "string" && body.password.trim() ? body.password.trim() : undefined
  const requestedTtl = typeof body?.expiresInDays === "number" ? body.expiresInDays : DEFAULT_TTL_DAYS
  const ttlDays = Math.min(MAX_TTL_DAYS, Math.max(1, Math.floor(requestedTtl)))

  if (!session || typeof session !== "object" || !Array.isArray(session.messages)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 })
  }

  pruneExpired()

  const id = crypto.randomUUID().slice(0, 10)
  const passwordHash = password ? await sha256(password) : undefined
  const safeSession = redact ? redactSessionForShare(session) : session

  shareStore().set(id, {
    session: safeSession,
    expiresAt: Date.now() + ttlDays * 24 * 60 * 60 * 1000,
    passwordHash,
  })

  return NextResponse.json({
    id,
    url: `/share/${id}`,
    expiresInDays: ttlDays,
    protected: Boolean(passwordHash),
  })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get("id")
  if (!id) return notFound()

  const entry = shareStore().get(id)
  if (!entry) return notFound()

  if (entry.expiresAt <= Date.now()) {
    shareStore().delete(id)
    return notFound()
  }

  if (entry.passwordHash) {
    const provided = url.searchParams.get("password") || ""
    if (!provided) {
      return NextResponse.json(
        { requiresPassword: true, title: entry.session.title || "" },
        { status: 401 }
      )
    }
    const hashed = await sha256(provided)
    if (hashed !== entry.passwordHash) {
      return NextResponse.json({ requiresPassword: true, error: "Mật khẩu sai" }, { status: 401 })
    }
  }

  return NextResponse.json({ session: entry.session })
}

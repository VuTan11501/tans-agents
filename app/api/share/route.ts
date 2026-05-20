import { NextResponse } from "next/server"

export const runtime = "edge"

const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000

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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const session = body?.session as ChatSession | undefined

  if (!session || typeof session !== "object" || !Array.isArray(session.messages)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 })
  }

  pruneExpired()

  const id = crypto.randomUUID().slice(0, 10)
  shareStore().set(id, {
    session,
    expiresAt: Date.now() + SHARE_TTL_MS,
  })

  return NextResponse.json({ id, url: `/share/${id}` })
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return notFound()

  const entry = shareStore().get(id)
  if (!entry) return notFound()

  if (entry.expiresAt <= Date.now()) {
    shareStore().delete(id)
    return notFound()
  }

  return NextResponse.json({ session: entry.session })
}

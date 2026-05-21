import { NextResponse } from "next/server"

export const runtime = "edge"

interface MistralModel {
  id: string
  object?: string
  capabilities?: { completion_chat?: boolean }
  owned_by?: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const userKey = typeof body?.userKey === "string" ? body.userKey.trim() : ""
    const apiKey = userKey || process.env.MISTRAL_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu MISTRAL_API_KEY. Cấu hình ở Cài đặt API keys." }, { status: 400 })
    }

    const res = await fetch("https://api.mistral.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Mistral API ${res.status}: ${text.slice(0, 300)}` }, { status: 502 })
    }
    const data = (await res.json()) as { data?: MistralModel[] }
    const all = data.data ?? []

    const EXCLUDE = /(embed|moderation|ocr)/i
    const chat = all
      .filter((m) => !EXCLUDE.test(m.id))
      .filter((m) => m.capabilities?.completion_chat !== false)
      .map((m) => ({ id: m.id, ownedBy: m.owned_by }))
      .sort((a, b) => a.id.localeCompare(b.id))

    return NextResponse.json({ models: chat, totalRaw: all.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

import { NextResponse } from "next/server"

export const runtime = "edge"

interface CerebrasModel {
  id: string
  object?: string
  owned_by?: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const userKey = typeof body?.userKey === "string" ? body.userKey.trim() : ""
    const apiKey = userKey || process.env.CEREBRAS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu CEREBRAS_API_KEY. Cấu hình ở Cài đặt API keys." }, { status: 400 })
    }

    const res = await fetch("https://api.cerebras.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Cerebras API ${res.status}: ${text.slice(0, 300)}` }, { status: 502 })
    }
    const data = (await res.json()) as { data?: CerebrasModel[] }
    const all = data.data ?? []

    const models = all
      .map((m) => ({ id: m.id, ownedBy: m.owned_by }))
      .sort((a, b) => a.id.localeCompare(b.id))

    return NextResponse.json({ models, totalRaw: all.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

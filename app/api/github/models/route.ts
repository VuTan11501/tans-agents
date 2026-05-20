import { NextResponse } from "next/server"

export const runtime = "edge"

interface GitHubModel {
  id: string
  name: string
  friendly_name?: string
  publisher?: string
  task?: string
  summary?: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const userKey = typeof body?.userKey === "string" ? body.userKey.trim() : ""
    const apiKey = userKey || process.env.GITHUB_TOKEN
    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu GITHUB_TOKEN. Cấu hình ở Cài đặt API keys." }, { status: 400 })
    }

    const res = await fetch("https://models.inference.ai.azure.com/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `GitHub Models API ${res.status}: ${text.slice(0, 300)}` }, { status: 502 })
    }
    const all = (await res.json()) as GitHubModel[]

    // Chỉ giữ chat-completion. Bỏ embedding / image / audio / rerank.
    const chatModels = (Array.isArray(all) ? all : [])
      .filter((m) => m.task === "chat-completion")
      .map((m) => ({ id: m.name, friendlyName: m.friendly_name, publisher: m.publisher, summary: m.summary }))
      .sort((a, b) => a.id.localeCompare(b.id))

    return NextResponse.json({ models: chatModels, totalRaw: Array.isArray(all) ? all.length : 0 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

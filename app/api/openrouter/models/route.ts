import { NextResponse } from "next/server"

export const runtime = "edge"

interface ORModel {
  id: string
  name?: string
  context_length?: number
  pricing?: { prompt?: string; completion?: string }
}

/**
 * OpenRouter — OpenAI-compatible /models endpoint at https://openrouter.ai/api/v1/models.
 * Filter to models có suffix `:free` HOẶC pricing prompt+completion = "0" (truly free).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const userKey = typeof body?.userKey === "string" ? body.userKey.trim() : ""
    const apiKey = userKey || process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu OPENROUTER_API_KEY. Cấu hình ở Cài đặt API keys." }, { status: 400 })
    }

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `OpenRouter API ${res.status}: ${text.slice(0, 300)}` }, { status: 502 })
    }
    const data = (await res.json()) as { data?: ORModel[] }
    const all = data.data ?? []

    // Chỉ giữ free models (suffix `:free` hoặc pricing toàn 0).
    const isFree = (m: ORModel) => {
      if (m.id.endsWith(":free")) return true
      const p = m.pricing
      if (!p) return false
      const promptZero = !p.prompt || p.prompt === "0" || Number(p.prompt) === 0
      const compZero = !p.completion || p.completion === "0" || Number(p.completion) === 0
      return promptZero && compZero
    }

    const free = all
      .filter(isFree)
      .map((m) => ({ id: m.id, contextWindow: m.context_length, name: m.name }))
      .sort((a, b) => a.id.localeCompare(b.id))

    return NextResponse.json({ models: free, totalRaw: all.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

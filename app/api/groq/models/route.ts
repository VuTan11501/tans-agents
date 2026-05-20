import { NextResponse } from "next/server"

export const runtime = "edge"

interface GroqModel {
  id: string
  context_window?: number
  active?: boolean
  owned_by?: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const userKey = typeof body?.userKey === "string" ? body.userKey.trim() : ""
    const apiKey = userKey || process.env.GROQ_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu GROQ_API_KEY. Cấu hình ở Cài đặt API keys." }, { status: 400 })
    }

    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Groq API ${res.status}: ${text.slice(0, 300)}` }, { status: 502 })
    }
    const data = (await res.json()) as { data?: GroqModel[] }
    const all = data.data ?? []

    // Loại whisper (speech-to-text), TTS, vision-only, guard models — chỉ giữ chat LLM.
    const EXCLUDE = /(whisper|tts|guard|moderation|prompt-guard)/i
    const chatModels = all
      .filter((m) => m.active !== false)
      .filter((m) => !EXCLUDE.test(m.id))
      .map((m) => ({ id: m.id, contextWindow: m.context_window, ownedBy: m.owned_by }))
      .sort((a, b) => a.id.localeCompare(b.id))

    return NextResponse.json({ models: chatModels, totalRaw: all.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

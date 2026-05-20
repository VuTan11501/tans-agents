import { NextResponse } from "next/server"

export const runtime = "edge"

interface GoogleModel {
  name: string
  supportedGenerationMethods?: string[]
  inputTokenLimit?: number
  outputTokenLimit?: number
  description?: string
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const userKey = typeof body?.userKey === "string" ? body.userKey.trim() : ""
    const apiKey = userKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Thiếu API key Google. Cấu hình ở Cài đặt API keys." }, { status: 400 })
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Google API trả về ${res.status}: ${text.slice(0, 300)}` }, { status: 502 })
    }
    const data = (await res.json()) as { models?: GoogleModel[] }
    const all = data.models ?? []

    const chatModels = all
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => ({
        id: m.name.replace(/^models\//, ""),
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit,
        description: m.description,
        methods: m.supportedGenerationMethods,
      }))
      .sort((a, b) => a.id.localeCompare(b.id))

    return NextResponse.json({ models: chatModels, totalRaw: all.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

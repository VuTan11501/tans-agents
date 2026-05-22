import { NextResponse } from "next/server"

export const runtime = "edge"

const DEFAULT_BASE_URL = "http://localhost:11434"

type OllamaTag = {
  name?: string
  model?: string
}

function normalizeBaseUrl(value: string | null | undefined) {
  return (value?.trim() || process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "")
}

async function listModels(baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/tags`, { cache: "no-store" })
  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Ollama API ${res.status}: ${text.slice(0, 300)}` }, { status: 502 })
  }

  const data = (await res.json()) as { models?: OllamaTag[] }
  const models = (data.models ?? [])
    .map((model) => {
      const id = (model.model || model.name || "").trim()
      const name = (model.name || model.model || id).trim()
      return id ? { id, name } : null
    })
    .filter((model): model is { id: string; name: string } => Boolean(model))
    .sort((a, b) => a.id.localeCompare(b.id))

  return NextResponse.json({ models })
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    return await listModels(normalizeBaseUrl(url.searchParams.get("baseUrl")))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    return await listModels(normalizeBaseUrl(typeof body?.baseUrl === "string" ? body.baseUrl : body?.userKey))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

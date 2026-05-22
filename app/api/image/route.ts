import { NextResponse } from "next/server"
import { generateImageUrl } from "@/lib/image-gen"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { prompt?: unknown }
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""

    if (prompt.length < 3 || prompt.length > 500) {
      return NextResponse.json(
        { error: "Prompt phải dài từ 3 đến 500 ký tự." },
        { status: 400 },
      )
    }

    return NextResponse.json({ url: generateImageUrl(prompt) })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    )
  }
}

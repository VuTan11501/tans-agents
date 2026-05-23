import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      return NextResponse.json({ success: false, error: "GROQ_API_KEY not configured" }, { status: 500 })
    }

    // Prepare FormData for Groq
    const groqFormData = new FormData()
    groqFormData.append("file", file)
    groqFormData.append("model", "whisper-large-v3-turbo")

    // Call Groq Whisper API
    const groqResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: groqFormData,
    })

    if (!groqResponse.ok) {
      const errorData = await groqResponse.text()
      console.error("Groq API error:", errorData)
      return NextResponse.json(
        { success: false, error: `Groq API error: ${groqResponse.statusText}` },
        { status: groqResponse.status }
      )
    }

    const data = await groqResponse.json()

    return NextResponse.json({
      success: true,
      text: data.text || "",
      duration: data.duration || 0,
    })
  } catch (error) {
    console.error("Audio transcribe error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to transcribe audio",
      },
      { status: 500 }
    )
  }
}

import { streamText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { agentTools } from "@/lib/tools"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"
import type { UserKeys } from "@/lib/user-keys"

export const runtime = "edge"
export const maxDuration = 30

const SYSTEM_PROMPT =
  "Bạn là Tan's Agent - AI assistant hữu ích, trả lời súc tích bằng tiếng Việt (trừ khi user dùng ngôn ngữ khác). " +
  "Khi cần thông tin thực tế hãy dùng tool webSearch. Khi cần tính toán dùng calculator. Khi hỏi giờ dùng currentTime. " +
  "Format câu trả lời bằng Markdown khi hữu ích (list, code block, bold)."

function getUserApiKey(provider: ProviderKey, userKeys?: UserKeys) {
  if (!userKeys || typeof userKeys !== "object") return undefined

  const key = provider === "google" ? userKeys.gemini : userKeys[provider]
  return typeof key === "string" && key.trim() ? key.trim() : undefined
}

function getModel(provider: ProviderKey, modelId: string, userKeys?: UserKeys) {
  const userApiKey = getUserApiKey(provider, userKeys)

  if (provider === "google") {
    const apiKey = userApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY")
    return createGoogleGenerativeAI({ apiKey })(modelId)
  }
  if (provider === "groq") {
    const apiKey = userApiKey || process.env.GROQ_API_KEY
    if (!apiKey) throw new Error("Missing GROQ_API_KEY")
    return createGroq({ apiKey })(modelId)
  }
  if (provider === "github") {
    const apiKey = userApiKey || process.env.GITHUB_TOKEN
    if (!apiKey) throw new Error("Missing GITHUB_TOKEN")
    return createOpenAI({ apiKey, baseURL: "https://models.inference.ai.azure.com" })(modelId)
  }
  throw new Error(`Unknown provider: ${provider}`)
}

export async function POST(req: Request) {
  try {
    const { messages, provider, model, enabledTools, userKeys } = await req.json()
    const p = (provider || "google") as ProviderKey
    const m = model || PROVIDERS[p].default
    const tools = Array.isArray(enabledTools)
      ? Object.fromEntries(Object.entries(agentTools).filter(([name]) => enabledTools.includes(name)))
      : agentTools
    const result = streamText({
      model: getModel(p, m, userKeys),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      maxSteps: 5,
      onError({ error }) {
        // surface model/SDK errors to server logs so they're not silently swallowed
        console.error("[chat] streamText error:", error)
      },
      onFinish({ finishReason, usage }) {
        console.log("[chat] streamText finish:", { finishReason, usage })
      },
    })
    return result.toDataStreamResponse({
      sendUsage: true,
      sendReasoning: false,
      // Forward the real error message into the data stream so the client UI
      // shows a useful reason instead of the generic "An error occurred".
      getErrorMessage: (error: unknown) => {
        if (error == null) return "Unknown error"
        if (typeof error === "string") return error
        if (error instanceof Error) return error.message
        try { return JSON.stringify(error) } catch { return String(error) }
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

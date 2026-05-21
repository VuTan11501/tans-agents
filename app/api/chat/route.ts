import { createDataStreamResponse, formatDataStreamPart, streamText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { agentTools } from "@/lib/tools"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"
import { routeModel } from "@/lib/router"
import { compactMessagesIfNeeded } from "@/lib/compactor"
import { selfCritiqueResponse, shouldSelfCritique } from "@/lib/critique"
import { recordProviderRateLimit } from "@/lib/usage-tracker"
import { parseRateLimitHeaders } from "@/lib/rate-limit-headers"
import type { UserKeys } from "@/lib/user-keys"

export const runtime = "edge"
export const maxDuration = 60

const SYSTEM_PROMPT =
  "Bạn là Tan's Agent - AI assistant hữu ích, trả lời súc tích bằng tiếng Việt (trừ khi user dùng ngôn ngữ khác). " +
  "Khi cần thông tin thực tế hãy dùng tool webSearch. Khi cần tính toán dùng calculator. Khi hỏi giờ dùng currentTime. " +
  "Format câu trả lời bằng Markdown khi hữu ích (list, code block, bold)."

function getUserApiKey(provider: ProviderKey, userKeys?: UserKeys) {
  if (!userKeys || typeof userKeys !== "object") return undefined

  const key = provider === "google" ? userKeys.gemini : userKeys[provider]
  return typeof key === "string" && key.trim() ? key.trim() : undefined
}

function providerForModel(modelId: string): ProviderKey | undefined {
  return (Object.entries(PROVIDERS) as Array<[ProviderKey, (typeof PROVIDERS)[ProviderKey]]>).find(([, config]) =>
    (config.models as readonly string[]).includes(modelId)
  )?.[0]
}

function hasApiKey(provider: ProviderKey, userKeys?: UserKeys) {
  if (getUserApiKey(provider, userKeys)) return true
  if (provider === "google") return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY)
  if (provider === "github") return Boolean(process.env.GITHUB_TOKEN)
  return false
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

function getCompactionModel(userKeys?: UserKeys) {
  if (hasApiKey("groq", userKeys)) return getModel("groq", "llama-3.1-8b-instant", userKeys)
  if (hasApiKey("google", userKeys)) return getModel("google", "gemini-2.5-flash-lite", userKeys)
  return undefined
}

export async function POST(req: Request) {
  try {
    const { messages, provider, model, enabledTools, userKeys, auto } = await req.json()
    const autoRoute = model === "auto" || (!model && auto === true) ? routeModel(messages) : undefined
    const requestedProvider = (provider || "google") as ProviderKey
    const p = autoRoute ? providerForModel(autoRoute.modelId) ?? requestedProvider : requestedProvider
    const m = autoRoute?.modelId || model || PROVIDERS[p].default
    const autoCompact = req.headers.get("X-Auto-Compact") === "1"
    const selfCritique = req.headers.get("X-Self-Critique") === "1"
    const compacted = autoCompact
      ? await compactMessagesIfNeeded({ messages, modelId: m, compactModel: getCompactionModel(userKeys) })
      : undefined
    const finalMessages = compacted?.messages ?? messages
    const tools = Array.isArray(enabledTools)
      ? Object.fromEntries(Object.entries(agentTools).filter(([name]) => enabledTools.includes(name)))
      : agentTools
    const modelInstance = getModel(p, m, userKeys)
    const result = streamText({
      model: modelInstance,
      system: SYSTEM_PROMPT,
      messages: finalMessages,
      tools,
      maxSteps: 5,
      onError({ error }) {
        // surface model/SDK errors to server logs so they're not silently swallowed
        console.error("[chat] streamText error:", error)
      },
      onFinish({ finishReason, usage, response }) {
        console.log("[chat] streamText finish:", { finishReason, usage })
        // Read REAL rate-limit info from provider response headers (Groq + GitHub).
        // Google Gemini doesn't expose these headers → returns null, no-op.
        try {
          const headers = (response as { headers?: Headers | Record<string, string> } | undefined)?.headers
          const info = parseRateLimitHeaders(p, headers)
          if (info) {
            void recordProviderRateLimit(p, m, info, userKeys).catch(() => {})
          }
        } catch {
          /* never let telemetry errors propagate */
        }
      },
    })
    const headers = {
      ...(autoRoute
        ? {
            "X-Auto-Model": autoRoute.modelId,
            "X-Auto-Reason": encodeURIComponent(autoRoute.reason),
          }
        : {}),
      ...(compacted?.compacted ? { "X-Auto-Compacted": "1" } : {}),
    }
    const getErrorMessage = (error: unknown) => {
      if (error == null) return "Unknown error"
      if (typeof error === "string") return error
      if (error instanceof Error) return error.message
      try { return JSON.stringify(error) } catch { return String(error) }
    }

    if (!selfCritique) {
      return result.toDataStreamResponse({
        headers,
        sendUsage: true,
        sendReasoning: false,
        getErrorMessage,
      })
    }

    return createDataStreamResponse({
      headers,
      execute: async (dataStream) => {
        result.mergeIntoDataStream(dataStream, {
          sendUsage: true,
          sendReasoning: false,
          experimental_sendFinish: false,
        })
        const [response, finishReason, usage] = await Promise.all([
          result.text,
          result.finishReason,
          result.usage,
        ])
        if (shouldSelfCritique(response)) {
          const improved = await selfCritiqueResponse({
            model: getModel(p, m, userKeys),
            messages: finalMessages,
            response,
          })
          dataStream.write(formatDataStreamPart("text", `\n\n---\n**Đã tự đánh giá:**\n${improved}`))
        }
        dataStream.write(
          formatDataStreamPart("finish_message", {
            finishReason,
            usage: {
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
            },
          })
        )
      },
      onError: getErrorMessage,
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

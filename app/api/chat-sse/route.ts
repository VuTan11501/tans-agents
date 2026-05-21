import { streamText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { createMistral } from "@ai-sdk/mistral"
import { agentTools } from "@/lib/tools"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"
import { routeModel } from "@/lib/router"
import { compactMessagesIfNeeded } from "@/lib/compactor"
import { selfCritiqueResponse, shouldSelfCritique } from "@/lib/critique"
import { recordProviderRateLimit } from "@/lib/usage-tracker"
import { parseRateLimitHeaders } from "@/lib/rate-limit-headers"

export const runtime = "edge"
export const maxDuration = 30

const DEFAULT_SYSTEM_PROMPT =
  "Bạn là Tan's Agent - AI assistant hữu ích, trả lời súc tích bằng tiếng Việt (trừ khi user dùng ngôn ngữ khác). " +
  "Khi cần thông tin thực tế hãy dùng tool webSearch. Khi cần tính toán dùng calculator. Khi hỏi giờ ở bất kỳ thành phố/múi giờ nào hãy gọi currentTime với tham số timezone (vd 'Asia/Tokyo', 'America/New_York'). " +
  "Format câu trả lời bằng Markdown khi hữu ích (list, code block, bold)."

function providerForModel(modelId: string): ProviderKey | undefined {
  return (Object.entries(PROVIDERS) as Array<[ProviderKey, (typeof PROVIDERS)[ProviderKey]]>).find(([, config]) =>
    (config.models as readonly string[]).includes(modelId)
  )?.[0]
}

function hasApiKey(provider: ProviderKey) {
  if (provider === "google") return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY)
  if (provider === "github") return Boolean(process.env.GITHUB_TOKEN)
  if (provider === "openrouter") return Boolean(process.env.OPENROUTER_API_KEY)
  if (provider === "cerebras") return Boolean(process.env.CEREBRAS_API_KEY)
  if (provider === "mistral") return Boolean(process.env.MISTRAL_API_KEY)
  return false
}

function getModel(provider: ProviderKey, modelId: string) {
  if (provider === "google") {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY")
    return createGoogleGenerativeAI({ apiKey })(modelId)
  }
  if (provider === "groq") {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error("Missing GROQ_API_KEY")
    return createGroq({ apiKey })(modelId)
  }
  if (provider === "github") {
    const apiKey = process.env.GITHUB_TOKEN
    if (!apiKey) throw new Error("Missing GITHUB_TOKEN")
    return createOpenAI({ apiKey, baseURL: "https://models.inference.ai.azure.com" })(modelId)
  }
  if (provider === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY")
    return createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      headers: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://tans-agents",
        "X-Title": "Tan's Agents",
      },
    })(modelId)
  }
  if (provider === "cerebras") {
    const apiKey = process.env.CEREBRAS_API_KEY
    if (!apiKey) throw new Error("Missing CEREBRAS_API_KEY")
    return createOpenAI({ apiKey, baseURL: "https://api.cerebras.ai/v1" })(modelId)
  }
  if (provider === "mistral") {
    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) throw new Error("Missing MISTRAL_API_KEY")
    return createMistral({ apiKey })(modelId)
  }
  throw new Error(`Unknown provider: ${provider}`)
}

function getCompactionModel() {
  if (hasApiKey("groq")) return getModel("groq", "llama-3.1-8b-instant")
  if (hasApiKey("google")) return getModel("google", "gemini-2.5-flash-lite")
  return undefined
}

// OpenAI-compatible SSE wrapper. Each delta is emitted as
//   data: {"choices":[{"delta":{"content":"..."},"finish_reason":null}]}\n\n
// followed by a final
//   data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n
//   data: [DONE]\n\n
// Pair with `hooks/use-sse-chat.ts` on the client (or any OpenAI-style SSE
// parser like the reference in `Code/docs/js/ai-agent.js` lines 982-1043).
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messages, provider, model, enabledTools, personaSystemPrompt, auto } = body ?? {}
    const autoRoute = model === "auto" || (!model && auto === true) ? routeModel(messages) : undefined
    const requestedProvider = (provider || "google") as ProviderKey
    const p = autoRoute ? providerForModel(autoRoute.modelId) ?? requestedProvider : requestedProvider
    const m = autoRoute?.modelId || model || PROVIDERS[p].default
    const autoCompact = req.headers.get("X-Auto-Compact") === "1"
    const selfCritique = req.headers.get("X-Self-Critique") === "1"
    const compacted = autoCompact
      ? await compactMessagesIfNeeded({ messages, modelId: m, compactModel: getCompactionModel() })
      : undefined
    const finalMessages = compacted?.messages ?? messages
    const tools = Array.isArray(enabledTools)
      ? Object.fromEntries(
          Object.entries(agentTools).filter(([name]) => enabledTools.includes(name))
        )
      : agentTools

    const hasTools = Object.keys(tools).length > 0
    const googleProviderOptions =
      p === "google" && hasTools
        ? { google: { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } } }
        : undefined

    const result = streamText({
      model: getModel(p, m),
      system:
        typeof personaSystemPrompt === "string" && personaSystemPrompt.length > 0
          ? personaSystemPrompt
          : DEFAULT_SYSTEM_PROMPT,
      messages: finalMessages,
      tools,
      maxSteps: 5,
      ...(googleProviderOptions ? { providerOptions: googleProviderOptions } : {}),
      onError({ error }) {
        console.error("[chat-sse] streamText error:", error)
      },
      onFinish({ finishReason, usage, response }) {
        console.log("[chat-sse] streamText finish:", { finishReason, usage })
        try {
          const headers = (response as { headers?: Headers | Record<string, string> } | undefined)?.headers
          const info = parseRateLimitHeaders(p, headers)
          if (info) void recordProviderRateLimit(p, m, info).catch(() => {})
        } catch {
          /* ignore */
        }
      },
    })

    const encoder = new TextEncoder()
    const send = (controller: ReadableStreamDefaultController, payload: unknown) =>
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`: connected\n\n`))
        let finishReason = "stop"
        let assistantText = ""
        let hadError = false
        try {
          for await (const part of result.fullStream) {
            switch (part.type) {
              case "text-delta":
                assistantText += part.textDelta
                send(controller, {
                  choices: [{ delta: { content: part.textDelta }, finish_reason: null }],
                })
                break
              case "tool-call":
                send(controller, {
                  choices: [
                    {
                      delta: {
                        tool_calls: [
                          {
                            index: 0,
                            id: part.toolCallId,
                            type: "function",
                            function: {
                              name: part.toolName,
                              arguments: JSON.stringify(part.args ?? {}),
                            },
                          },
                        ],
                      },
                      finish_reason: null,
                    },
                  ],
                })
                break
              case "tool-result":
                send(controller, {
                  choices: [
                    {
                      delta: {
                        tool_results: [
                          { id: part.toolCallId, name: part.toolName, result: part.result },
                        ],
                      },
                      finish_reason: null,
                    },
                  ],
                })
                break
              case "finish":
                finishReason = String(part.finishReason ?? "stop")
                break
              case "error":
                hadError = true
                send(controller, {
                  error: {
                    message:
                      (part as any).error?.message ??
                      String((part as any).error ?? "unknown error"),
                  },
                })
                break
              default:
                break
            }
          }
        } catch (err: any) {
          hadError = true
          send(controller, { error: { message: err?.message ?? "stream error" } })
        } finally {
          if (selfCritique && !hadError && shouldSelfCritique(assistantText)) {
            const improved = await selfCritiqueResponse({
              model: getModel(p, m),
              messages: finalMessages,
              response: assistantText,
            })
            send(controller, {
              choices: [
                {
                  delta: { content: `\n\n---\n**Tự đánh giá:**\n${improved}` },
                  finish_reason: null,
                },
              ],
            })
          }
          send(controller, { choices: [{ delta: {}, finish_reason: finishReason }] })
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        ...(autoRoute
          ? {
              "X-Auto-Model": autoRoute.modelId,
              "X-Auto-Reason": encodeURIComponent(autoRoute.reason),
            }
          : {}),
        ...(compacted?.compacted ? { "X-Auto-Compacted": "1" } : {}),
      },
    })
  } catch (e: any) {
    return new Response(
      `data: ${JSON.stringify({ error: { message: e?.message ?? "internal error" } })}\n\ndata: [DONE]\n\n`,
      {
        status: 500,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      }
    )
  }
}

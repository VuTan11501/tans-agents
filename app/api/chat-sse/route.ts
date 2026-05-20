import { streamText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import { createOpenAI } from "@ai-sdk/openai"
import { agentTools } from "@/lib/tools"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"
import { routeModel } from "@/lib/router"
import { compactMessagesIfNeeded } from "@/lib/compactor"

export const runtime = "edge"
export const maxDuration = 30

const DEFAULT_SYSTEM_PROMPT =
  "Bạn là Tan's Agent - AI assistant hữu ích, trả lời súc tích bằng tiếng Việt (trừ khi user dùng ngôn ngữ khác). " +
  "Khi cần thông tin thực tế hãy dùng tool webSearch. Khi cần tính toán dùng calculator. Khi hỏi giờ dùng currentTime. " +
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
    const compacted = autoCompact
      ? await compactMessagesIfNeeded({ messages, modelId: m, compactModel: getCompactionModel() })
      : undefined
    const finalMessages = compacted?.messages ?? messages
    const tools = Array.isArray(enabledTools)
      ? Object.fromEntries(
          Object.entries(agentTools).filter(([name]) => enabledTools.includes(name))
        )
      : agentTools

    const result = streamText({
      model: getModel(p, m),
      system:
        typeof personaSystemPrompt === "string" && personaSystemPrompt.length > 0
          ? personaSystemPrompt
          : DEFAULT_SYSTEM_PROMPT,
      messages: finalMessages,
      tools,
      maxSteps: 5,
      onError({ error }) {
        console.error("[chat-sse] streamText error:", error)
      },
      onFinish({ finishReason, usage }) {
        console.log("[chat-sse] streamText finish:", { finishReason, usage })
      },
    })

    const encoder = new TextEncoder()
    const send = (controller: ReadableStreamDefaultController, payload: unknown) =>
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`: connected\n\n`))
        let finishReason = "stop"
        try {
          for await (const part of result.fullStream) {
            switch (part.type) {
              case "text-delta":
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
          send(controller, { error: { message: err?.message ?? "stream error" } })
        } finally {
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

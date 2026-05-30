import { streamText } from "ai"
import { agentTools } from "@/lib/tools"
import { compactMessagesIfNeeded } from "@/lib/compactor"
import { selfCritiqueResponse, shouldSelfCritique } from "@/lib/critique"
import { recordProviderRateLimit } from "@/lib/usage-tracker"
import { parseRateLimitHeaders } from "@/lib/rate-limit-headers"
import { parseChatRequest } from "@/lib/chat-request"
import { getCompactionModel, getModel, resolveProviderAndModel } from "@/lib/chat-runtime"

export const runtime = "edge"
export const maxDuration = 30

const DEFAULT_SYSTEM_PROMPT =
  "Bạn là Tan's Agent - AI assistant hữu ích, trả lời súc tích bằng tiếng Việt (trừ khi user dùng ngôn ngữ khác). " +
  "Format câu trả lời bằng Markdown khi hữu ích (list, code block, bold).\n\n" +
  "QUY TẮC SỬ DỤNG TOOL (bắt buộc tuân thủ):\n" +
  "- Câu hỏi liên quan thông tin THỜI SỰ / TIN MỚI / GIÁ / TỶ GIÁ / SỰ KIỆN HÔM NAY / TUẦN NÀY / 'mới nhất' / 'hiện tại' / 'bây giờ' / 'tin tức': PHẢI gọi webSearch trước khi trả lời.\n" +
  "- User dán URL hoặc hỏi về 1 bài báo / trang web cụ thể: gọi fetchUrl với URL đó.\n" +
  "- User dán link YouTube hoặc hỏi 'video này nói gì': gọi youtubeTranscript.\n" +
  "- Hỏi giờ ở thành phố/múi giờ nào: gọi currentTime với tham số timezone.\n" +
  "- Cần tính toán: calculator hoặc runJs. Dữ liệu bảng (JSON/CSV) cần aggregate/group/sort: runSql.\n" +
  "- KHÔNG đoán mò khi câu trả lời có thể outdated — luôn dùng tool để xác thực."

function errorText(error: unknown): string {
  if (error == null) return "internal error"
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

// OpenAI-compatible SSE wrapper.
export async function POST(req: Request) {
  try {
    const rawBody = await req.json()
    const body = parseChatRequest(rawBody)
    const { messages, enabledTools, personaSystemPrompt, userKeys, autoProfile } = body
    const resolved = resolveProviderAndModel({
      messages,
      provider: body.provider,
      model: body.model,
      auto: body.auto,
      autoProfile,
      userKeys,
    })
    const p = resolved.provider
    const m = resolved.model

    const autoCompact = req.headers.get("X-Auto-Compact") === "1"
    const selfCritique = req.headers.get("X-Self-Critique") === "1"
    const compacted = autoCompact
      ? await compactMessagesIfNeeded({
          messages,
          modelId: m,
          compactModel: getCompactionModel(userKeys),
        })
      : undefined
    const finalMessages = compacted?.messages ?? messages
    const tools = Array.isArray(enabledTools)
      ? Object.fromEntries(Object.entries(agentTools).filter(([name]) => enabledTools.includes(name)))
      : agentTools

    const hasTools = Object.keys(tools).length > 0
    const googleProviderOptions =
      p === "google" && hasTools
        ? { google: { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } } }
        : undefined

    const result = streamText({
      model: getModel(p, m, userKeys),
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
          if (info) void recordProviderRateLimit(p, m, info, userKeys).catch(() => {})
        } catch {
          // ignore telemetry errors
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
                      (part as any).error?.message ?? String((part as any).error ?? "unknown error"),
                  },
                })
                break
              default:
                break
            }
          }
        } catch (error: unknown) {
          hadError = true
          send(controller, { error: { message: errorText(error) } })
        } finally {
          if (selfCritique && !hadError && shouldSelfCritique(assistantText)) {
            const improved = await selfCritiqueResponse({
              model: getModel(p, m, userKeys),
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
        ...(resolved.autoRoute
          ? {
              "X-Auto-Model": resolved.autoRoute.modelId,
              "X-Auto-Reason": encodeURIComponent(resolved.autoRoute.reason),
              "X-Auto-Profile": resolved.autoRoute.profile,
            }
          : {}),
        ...(resolved.fallback
          ? {
              "X-Fallback-From": resolved.fallback.fromProvider,
              "X-Fallback-To": resolved.fallback.toProvider,
            }
          : {}),
        "X-Resolved-Provider": p,
        "X-Resolved-Model": m,
        ...(compacted?.compacted ? { "X-Auto-Compacted": "1" } : {}),
      },
    })
  } catch (error: unknown) {
    return new Response(
      `data: ${JSON.stringify({ error: { message: errorText(error) } })}\n\ndata: [DONE]\n\n`,
      {
        status: 500,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      }
    )
  }
}

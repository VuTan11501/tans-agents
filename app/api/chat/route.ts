import { createDataStreamResponse, formatDataStreamPart, streamText } from "ai"
import { agentTools } from "@/lib/tools"
import { compactMessagesIfNeeded } from "@/lib/compactor"
import { selfCritiqueResponse, shouldSelfCritique } from "@/lib/critique"
import { recordProviderRateLimit } from "@/lib/usage-tracker"
import { parseRateLimitHeaders } from "@/lib/rate-limit-headers"
import { parseChatRequest } from "@/lib/chat-request"
import { getCompactionModel, getModel, resolveProviderAndModel } from "@/lib/chat-runtime"

export const runtime = "edge"
export const maxDuration = 60

const SYSTEM_PROMPT =
  "Bạn là Tan's Agent - AI assistant hữu ích, trả lời súc tích bằng tiếng Việt (trừ khi user dùng ngôn ngữ khác). " +
  "Format câu trả lời bằng Markdown khi hữu ích (list, code block, bold).\n\n" +
  "QUY TẮC SỬ DỤNG TOOL (bắt buộc tuân thủ):\n" +
  "- Câu hỏi liên quan thông tin THỜI SỰ / TIN MỚI / GIÁ / TỶ GIÁ / SỰ KIỆN HÔM NAY / TUẦN NÀY / 'mới nhất' / 'hiện tại' / 'bây giờ' / 'tin tức': PHẢI gọi webSearch trước khi trả lời.\n" +
  "- User dán URL hoặc hỏi về 1 bài báo / trang web cụ thể: gọi fetchUrl với URL đó.\n" +
  "- User dán link YouTube hoặc hỏi 'video này nói gì': gọi youtubeTranscript.\n" +
  "- Hỏi giờ ở thành phố/múi giờ nào: gọi currentTime với tham số timezone (vd 'Asia/Tokyo').\n" +
  "- Cần tính toán phức tạp: dùng calculator hoặc runJs.\n" +
  "- User có dữ liệu bảng (JSON/CSV) cần phân tích/aggregate/group/sort: dùng runSql.\n" +
  "- User đưa câu hỏi về số liệu lịch sử (lượt xem, dân số, GDP, tiểu sử, định nghĩa khái niệm): có thể dùng wikipedia trước, nếu không đủ thì webSearch.\n" +
  "- Vẽ biểu đồ: chartGen. Vẽ sơ đồ flow/sequence: mermaid.\n" +
  "- KHÔNG đoán mò khi câu trả lời có thể outdated — luôn dùng tool để xác thực."

function errorText(error: unknown): string {
  if (error == null) return "Unknown error"
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

export async function POST(req: Request) {
  try {
    const body = parseChatRequest(await req.json())
    const { messages, enabledTools, userKeys, autoProfile } = body
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

    const modelInstance = getModel(p, m, userKeys)
    // Gemini 2.5 thinking-mode models require `thought_signature` on echoed tool calls.
    // AI SDK cannot preserve it across multi-step tool loops, so disable thinking when tools are on.
    const hasTools = Object.keys(tools).length > 0
    const googleProviderOptions =
      p === "google" && hasTools
        ? { google: { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } } }
        : undefined

    const result = streamText({
      model: modelInstance,
      system: SYSTEM_PROMPT,
      messages: finalMessages,
      tools,
      maxSteps: 5,
      ...(googleProviderOptions ? { providerOptions: googleProviderOptions } : {}),
      onError({ error }) {
        console.error("[chat] streamText error:", error)
      },
      onFinish({ finishReason, usage, response }) {
        console.log("[chat] streamText finish:", { finishReason, usage })
        try {
          const headers = (response as { headers?: Headers | Record<string, string> } | undefined)?.headers
          const info = parseRateLimitHeaders(p, headers)
          if (info) void recordProviderRateLimit(p, m, info, userKeys).catch(() => {})
        } catch {
          // telemetry failure must not affect chat stream
        }
      },
    })

    const headers = {
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
    }

    if (!selfCritique) {
      return result.toDataStreamResponse({
        headers,
        sendUsage: true,
        sendReasoning: false,
        getErrorMessage: errorText,
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
      onError: errorText,
    })
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: errorText(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

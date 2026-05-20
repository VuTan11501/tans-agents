import { generateText, type LanguageModel } from "ai"
import { countTokens } from "@/lib/tokens"

export type CompactableMessage = {
  role: string
  content: unknown
}

const CONTEXT_LIMITS: Record<string, number> = {
  "gpt-4o": 128_000,
  "gemini-2.5-flash": 1_000_000,
  "llama-3.1-8b-instant": 131_000,
  default: 128_000,
}

const COMPACTION_PROMPT =
  "Tóm tắt cuộc trò chuyện sau thành 1 system note ngắn gọn (bullet points). Giữ tên, fact quan trọng, decisions:"

function contentToText(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part
        if (part && typeof part === "object" && "text" in part) return String(part.text ?? "")
        return ""
      })
      .filter(Boolean)
      .join(" ")
  }
  if (content == null) return ""
  try {
    return JSON.stringify(content)
  } catch {
    return String(content)
  }
}

function serializeMessages(messages: CompactableMessage[]) {
  return messages
    .map((message) => `${message.role}: ${contentToText(message.content)}`.trim())
    .join("\n\n")
}

export function getContextLimit(modelId: string) {
  return CONTEXT_LIMITS[modelId] ?? CONTEXT_LIMITS.default
}

export function countConversationTokens(messages: CompactableMessage[]) {
  return countTokens(serializeMessages(messages))
}

export async function compactMessagesIfNeeded({
  messages,
  modelId,
  compactModel,
}: {
  messages: CompactableMessage[]
  modelId: string
  compactModel?: LanguageModel
}): Promise<{ messages: CompactableMessage[]; compacted: boolean; totalTokens: number; limit: number }> {
  const safeMessages = Array.isArray(messages) ? messages : []
  const limit = getContextLimit(modelId)
  const totalTokens = countConversationTokens(safeMessages)

  if (!compactModel || totalTokens <= limit * 0.8 || safeMessages.length <= 4) {
    return { messages: safeMessages, compacted: false, totalTokens, limit }
  }

  const olderMessages = safeMessages.slice(0, -4)
  const recentMessages = safeMessages.slice(-4)
  const transcript = serializeMessages(olderMessages)
  if (!transcript.trim()) return { messages: safeMessages, compacted: false, totalTokens, limit }

  const { text } = await generateText({
    model: compactModel,
    prompt: `${COMPACTION_PROMPT}\n\n${transcript}`,
    maxTokens: 700,
  })

  const summary = text.trim()
  if (!summary) return { messages: safeMessages, compacted: false, totalTokens, limit }

  return {
    messages: [{ role: "system", content: `Tóm tắt context cũ:\n${summary}` }, ...recentMessages],
    compacted: true,
    totalTokens,
    limit,
  }
}

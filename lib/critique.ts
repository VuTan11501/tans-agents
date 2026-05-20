import { generateText, type LanguageModel } from "ai"
import type { CompactableMessage } from "@/lib/compactor"

const CRITIQUE_PROMPT = "Đánh giá và cải thiện câu trả lời sau nếu cần. Nếu đã ổn, trả lại nguyên văn. Không xuất tiến trình suy nghĩ (không dùng thẻ <think>), chỉ trả về câu trả lời cuối cùng:"

export function shouldSelfCritique(response: string) {
  return response.trim().length > 200
}

function stripReasoning(text: string): string {
  // Remove <think>...</think>, <reasoning>...</reasoning>, <reflection>...</reflection> blocks (incl. unclosed)
  return text
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/<reflection\b[^>]*>[\s\S]*?<\/reflection>/gi, "")
    // Drop unclosed leading <think> ... (output truncated mid-think)
    .replace(/^\s*<think\b[^>]*>[\s\S]*$/i, "")
    .trim()
}

export async function selfCritiqueResponse({
  model,
  messages,
  response,
}: {
  model: LanguageModel
  messages: CompactableMessage[]
  response: string
}) {
  if (!shouldSelfCritique(response)) return response
  void messages

  try {
    const { text } = await generateText({
      model,
      prompt: `${CRITIQUE_PROMPT}\n\n${response}`,
      maxTokens: Math.min(1_200, Math.max(300, Math.ceil(response.length / 3))),
    })
    return text.trim() ? (stripReasoning(text) || response) : response
  } catch (error) {
    console.error("[critique] pass-2 failed:", error)
    return response
  }
}

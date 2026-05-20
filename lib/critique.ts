import { generateText, type LanguageModel } from "ai"
import type { CompactableMessage } from "@/lib/compactor"

const CRITIQUE_PROMPT = "Đánh giá và cải thiện câu trả lời sau nếu cần. Nếu đã ổn, trả lại nguyên văn:"

export function shouldSelfCritique(response: string) {
  return response.trim().length > 200
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
    return text.trim() || response
  } catch (error) {
    console.error("[critique] pass-2 failed:", error)
    return response
  }
}

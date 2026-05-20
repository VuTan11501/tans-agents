type ChatMessage = {
  role: string
  content: unknown
}

const MODEL_MAP = {
  coding: "gpt-4o",
  reasoning: "gemini-2.5-pro",
  writing: "gemini-2.5-flash",
  translation: "gemini-2.0-flash-lite",
  fastFact: "llama-3.1-8b-instant",
  default: "gemini-2.5-flash-lite",
} as const

function textContent(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part
        if (part && typeof part === "object" && "text" in part) return String(part.text ?? "")
        return ""
      })
      .join(" ")
  }
  return ""
}

export function routeModel(messages: ChatMessage[]): { modelId: string; reason: string } {
  const safeMessages = Array.isArray(messages) ? messages : []
  const lastUser = [...safeMessages].reverse().find((message) => message?.role === "user")
  const lastText = textContent(lastUser?.content).trim()
  const tailText = safeMessages.slice(-6).map((message) => textContent(message?.content)).join("\n")
  const combined = `${tailText}\n${lastText}`

  if (/```|\b(function|class|def|const|import|select|interface|type|return|async|await)\b|=>/i.test(combined)) {
    return { modelId: MODEL_MAP.coding, reason: "Phát hiện prompt code nên dùng model coding mạnh." }
  }

  if (/\b(calculate|integral|derivative|regex|json|csv|dataset|data analysis|analyze data|compute|solve)\b|\b(tính|tích phân|đạo hàm|phân tích dữ liệu)\b/i.test(combined)) {
    return { modelId: MODEL_MAP.reasoning, reason: "Phát hiện toán/phân tích dữ liệu nên dùng model reasoning mạnh." }
  }

  if (/\b(dịch|translate|translation)\b/i.test(lastText)) {
    return { modelId: MODEL_MAP.translation, reason: "Phát hiện yêu cầu dịch nên dùng model đa ngôn ngữ nhanh." }
  }

  if (/\b(viết|write|essay|blog|story|article|kể)\b/i.test(lastText) || lastText.length > 800) {
    return { modelId: MODEL_MAP.writing, reason: "Phát hiện viết dài nên dùng model cân bằng dung lượng lớn." }
  }

  if (lastText.length > 0 && lastText.length < 60 && /\?$/.test(lastText)) {
    return { modelId: MODEL_MAP.fastFact, reason: "Câu hỏi ngắn nên dùng model nhanh/tiết kiệm." }
  }

  return { modelId: MODEL_MAP.default, reason: "Mặc định dùng model cân bằng." }
}

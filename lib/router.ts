type ChatMessage = {
  role: string
  content: unknown
}

export type AutoRouteProfile = "speed" | "balanced" | "quality"

export const DEFAULT_AUTO_ROUTE_PROFILE: AutoRouteProfile = "balanced"

type RouteReason = "coding" | "reasoning" | "writing" | "translation" | "fastFact" | "default"

const MODEL_MAP_BY_PROFILE: Record<AutoRouteProfile, Record<RouteReason, string>> = {
  speed: {
    coding: "llama-3.1-8b-instant",
    reasoning: "qwen/qwen3-32b",
    writing: "gemini-2.5-flash-lite",
    translation: "llama-3.1-8b-instant",
    fastFact: "llama-3.1-8b-instant",
    default: "llama-3.1-8b-instant",
  },
  balanced: {
    coding: "openai/gpt-oss-120b",
    reasoning: "qwen/qwen3-32b",
    writing: "gemini-2.5-flash",
    translation: "llama-3.3-70b-versatile",
    fastFact: "llama-3.1-8b-instant",
    default: "gemini-2.5-flash",
  },
  quality: {
    coding: "grok-4",
    reasoning: "grok-4",
    writing: "gemini-2.5-flash",
    translation: "llama-3.3-70b-versatile",
    fastFact: "gemini-2.5-flash",
    default: "grok-4",
  },
}

const PROVIDER_FALLBACK_ORDER: Record<AutoRouteProfile, string[]> = {
  speed: ["groq", "google", "github", "openrouter", "cerebras", "mistral", "ollama"],
  balanced: ["google", "groq", "github", "openrouter", "cerebras", "mistral", "ollama"],
  quality: ["github", "google", "openrouter", "groq", "cerebras", "mistral", "ollama"],
}

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

function classifyReason(messages: ChatMessage[]): RouteReason {
  const safeMessages = Array.isArray(messages) ? messages : []
  const lastUser = [...safeMessages].reverse().find((message) => message?.role === "user")
  const lastText = textContent(lastUser?.content).trim()
  const tailText = safeMessages.slice(-6).map((message) => textContent(message?.content)).join("\n")
  const combined = `${tailText}\n${lastText}`

  if (/```|\b(function|class|def|const|import|select|interface|type|return|async|await)\b|=>/i.test(combined)) {
    return "coding"
  }

  if (/\b(calculate|integral|derivative|regex|json|csv|dataset|data analysis|analyze data|compute|solve)\b|\b(tính|tích phân|đạo hàm|phân tích dữ liệu)\b/i.test(combined)) {
    return "reasoning"
  }

  if (/\b(dịch|translate|translation)\b/i.test(lastText)) {
    return "translation"
  }

  if (/\b(viết|write|essay|blog|story|article|kể)\b/i.test(lastText) || lastText.length > 800) {
    return "writing"
  }

  if (lastText.length > 0 && lastText.length < 60 && /\?$/.test(lastText)) {
    return "fastFact"
  }

  return "default"
}

function reasonLabel(reason: RouteReason): string {
  switch (reason) {
    case "coding":
      return "Phát hiện prompt code nên ưu tiên model coding."
    case "reasoning":
      return "Phát hiện toán/phân tích nên ưu tiên model reasoning."
    case "translation":
      return "Phát hiện yêu cầu dịch nên ưu tiên model đa ngôn ngữ."
    case "writing":
      return "Phát hiện viết dài nên ưu tiên model writing."
    case "fastFact":
      return "Câu hỏi ngắn nên ưu tiên model nhanh."
    default:
      return "Mặc định dùng profile cân bằng."
  }
}

export function routeModel(
  messages: ChatMessage[],
  options?: { profile?: AutoRouteProfile }
): { modelId: string; reason: string; profile: AutoRouteProfile } {
  const profile = options?.profile ?? DEFAULT_AUTO_ROUTE_PROFILE
  const reason = classifyReason(messages)
  const map = MODEL_MAP_BY_PROFILE[profile] ?? MODEL_MAP_BY_PROFILE[DEFAULT_AUTO_ROUTE_PROFILE]
  return {
    modelId: map[reason],
    reason: `${reasonLabel(reason)} (profile: ${profile})`,
    profile,
  }
}

export function getProviderFallbackOrder(profile?: AutoRouteProfile): string[] {
  const selected = profile ?? DEFAULT_AUTO_ROUTE_PROFILE
  return PROVIDER_FALLBACK_ORDER[selected] ?? PROVIDER_FALLBACK_ORDER[DEFAULT_AUTO_ROUTE_PROFILE]
}

export function isRetryableError(message: string): boolean {
  const value = message.toLowerCase()
  return (
    value.includes("timeout") ||
    value.includes("timed out") ||
    value.includes("network") ||
    value.includes("429") ||
    value.includes("rate limit") ||
    value.includes("503") ||
    value.includes("overloaded") ||
    value.includes("temporarily unavailable")
  )
}

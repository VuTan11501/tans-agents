// Slash commands for composer input
// Detects /<cmd> [args] at start of input; returns SlashAction or null.

export type SlashAction =
  | { kind: "clear" }
  | { kind: "help" }
  | { kind: "summarize" }
  | { kind: "translate"; lang: "vi" | "en" }
  | { kind: "code"; prompt: string }
  | { kind: "explain"; topic: string }
  | { kind: "rewrite"; style: string }

export interface SlashCommandDef {
  name: string
  aliases?: string[]
  description: string
  example: string
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  { name: "/help", description: "Hiển thị danh sách lệnh", example: "/help" },
  { name: "/clear", description: "Xoá lịch sử hội thoại hiện tại", example: "/clear" },
  { name: "/summarize", aliases: ["/tom"], description: "Tóm tắt cuộc trò chuyện", example: "/summarize" },
  { name: "/translate", aliases: ["/tr"], description: "Dịch tin nhắn cuối: /translate vi hoặc /translate en", example: "/translate vi" },
  { name: "/code", description: "Yêu cầu AI viết code", example: "/code viết hàm fibonacci JS" },
  { name: "/explain", aliases: ["/giai"], description: "Yêu cầu AI giải thích chủ đề", example: "/explain neural network" },
  { name: "/rewrite", aliases: ["/viet-lai"], description: "Viết lại theo phong cách", example: "/rewrite trang trọng" },
]

export function parseSlash(input: string): SlashAction | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith("/")) return null
  const [rawCmd, ...rest] = trimmed.split(/\s+/)
  const cmd = rawCmd.toLowerCase()
  const args = rest.join(" ").trim()

  if (cmd === "/help") return { kind: "help" }
  if (cmd === "/clear") return { kind: "clear" }
  if (cmd === "/summarize" || cmd === "/tom") return { kind: "summarize" }
  if (cmd === "/translate" || cmd === "/tr") {
    const lang = args.toLowerCase().startsWith("en") ? "en" : "vi"
    return { kind: "translate", lang }
  }
  if (cmd === "/code") return { kind: "code", prompt: args || "viết một đoạn code mẫu" }
  if (cmd === "/explain" || cmd === "/giai") return { kind: "explain", topic: args || "AI" }
  if (cmd === "/rewrite" || cmd === "/viet-lai") return { kind: "rewrite", style: args || "rõ ràng và súc tích" }

  return null
}

export function getSuggestions(input: string): SlashCommandDef[] {
  if (!input.startsWith("/")) return []
  const prefix = input.toLowerCase().split(/\s+/)[0]
  return SLASH_COMMANDS.filter(
    (c) => c.name.startsWith(prefix) || c.aliases?.some((a) => a.startsWith(prefix))
  )
}

export function expandSlashToPrompt(action: SlashAction, lastAssistant?: string): string | null {
  switch (action.kind) {
    case "summarize":
      return "Hãy tóm tắt ngắn gọn (3-5 gạch đầu dòng) cuộc trò chuyện ở trên."
    case "translate":
      if (!lastAssistant) return null
      return action.lang === "vi"
        ? `Dịch sang tiếng Việt, giữ format markdown nếu có:\n\n${lastAssistant}`
        : `Translate to English, keep markdown formatting:\n\n${lastAssistant}`
    case "code":
      return `${action.prompt}\n\n(Trả lời bằng code block + giải thích ngắn)`
    case "explain":
      return `Giải thích khái niệm "${action.topic}" một cách dễ hiểu, có ví dụ.`
    case "rewrite":
      if (!lastAssistant) return null
      return `Viết lại nội dung sau theo phong cách "${action.style}":\n\n${lastAssistant}`
    default:
      return null
  }
}

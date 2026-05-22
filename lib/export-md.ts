import type { ChatSession } from "@/hooks/use-chat-history"

type MessageLike = {
  role?: string
  content?: unknown
  parts?: unknown
  model?: string
  modelName?: string
  provider?: string
  createdAt?: number | string
}

const VI_DATE = new Intl.DateTimeFormat("vi-VN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

function formatDate(value: number | string | undefined): string {
  if (!value) return VI_DATE.format(new Date())
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? VI_DATE.format(new Date()) : VI_DATE.format(date)
}

function todayStamp(): string {
  const date = new Date()
  const yyyy = date.getFullYear().toString()
  const mm = (date.getMonth() + 1).toString().padStart(2, "0")
  const dd = date.getDate().toString().padStart(2, "0")
  return `${yyyy}${mm}${dd}`
}

export function slugifyVietnamese(input: string): string {
  const normalized = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "cuoc-tro-chuyen"
}

function detectLanguage(code: string): string {
  const trimmed = code.trim()
  if (!trimmed) return "text"
  if (/^\s*[{[]/.test(trimmed) && /[}\]]\s*$/.test(trimmed)) return "json"
  if (/\b(import|export|const|let|function|interface|type|from)\b/.test(trimmed)) return "ts"
  if (/<[A-Za-z][\s\S]*>/.test(trimmed)) return "html"
  if (/\b(def|import|from|print|class)\b/.test(trimmed) && /:\s*(#.*)?$/m.test(trimmed)) return "python"
  if (/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i.test(trimmed)) return "sql"
  if (/\b(git|npm|npx|pnpm|yarn|cd|mkdir|curl)\b/.test(trimmed)) return "bash"
  if (/\b(display|position|color|background|border|padding|margin)\s*:/.test(trimmed)) return "css"
  return "text"
}

function normalizeFencedCode(markdown: string): string {
  return markdown.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
    const language = lang.trim() || detectLanguage(code)
    return `\`\`\`${language}\n${code}\`\`\``
  })
}

function textFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return ""

  const blocks: string[] = []
  for (const part of parts) {
    if (!part || typeof part !== "object") continue
    const p = part as {
      type?: string
      text?: string
      code?: string
      language?: string
      image?: string
      url?: string
      name?: string
      content?: string
    }

    if (typeof p.text === "string") blocks.push(p.text)
    else if (typeof p.content === "string") blocks.push(p.content)
    else if (typeof p.code === "string") {
      const language = p.language?.trim() || detectLanguage(p.code)
      blocks.push(`\`\`\`${language}\n${p.code}\n\`\`\``)
    } else if ((p.type === "image" || p.image || p.url) && (p.image || p.url)) {
      blocks.push(`![${p.name || "image"}](${p.image || p.url})`)
    }
  }

  return blocks.join("\n\n")
}

function messageContent(message: MessageLike): string {
  if (typeof message.content === "string") return normalizeFencedCode(message.content.trim())
  if (Array.isArray(message.content)) return normalizeFencedCode(textFromParts(message.content).trim())
  if (message.content != null) return normalizeFencedCode(String(message.content).trim())
  return normalizeFencedCode(textFromParts(message.parts).trim())
}

export function sessionToMarkdown(session: ChatSession): string {
  const title = session.title?.trim() || "Cuộc trò chuyện"
  const provider = session.provider || "Không rõ provider"
  const model = session.model || "Không rõ model"
  const lines: string[] = [
    `# ${title}`,
    "",
    `- Ngày tạo: ${formatDate(session.createdAt)}`,
    `- Cập nhật: ${formatDate(session.updatedAt)}`,
    `- Provider/Model: ${provider} / ${model}`,
    "",
  ]

  for (const rawMessage of session.messages as MessageLike[]) {
    if (!rawMessage || rawMessage.role === "system") continue

    const role = rawMessage.role === "user" ? "👤 User" : rawMessage.role === "assistant" ? `🤖 Assistant (${rawMessage.modelName || rawMessage.model || model})` : rawMessage.role || "Message"
    const content = messageContent(rawMessage) || "_(không có nội dung)_"

    lines.push(`## ${role}`)
    if (rawMessage.createdAt) {
      lines.push("")
      lines.push(`_${formatDate(rawMessage.createdAt)}_`)
    }
    lines.push("")
    lines.push(content)
    lines.push("")
  }

  return lines.join("\n").trimEnd() + "\n"
}

export function downloadAsMarkdown(session: ChatSession): void {
  if (typeof window === "undefined") return

  const markdown = sessionToMarkdown(session)
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${slugifyVietnamese(session.title || "cuoc-tro-chuyen")}-${todayStamp()}.md`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

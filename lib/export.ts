import type { ChatSession } from "@/hooks/use-chat-history"

const roleLabels: Record<string, string> = {
  user: "👤 Bạn",
  assistant: "🤖 Trợ lý",
}

export function sessionToMarkdown(session: ChatSession): string {
  const date = new Date(session.createdAt).toLocaleString("vi-VN")
  const header = `# ${session.title}\n\nModel: ${session.model} · Ngày: ${date}\n\n`
  const messages = session.messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      const label = roleLabels[message.role] ?? message.role
      const content = (message.content ?? "").toString()
      return `## ${label}\n\n${content}\n\n---\n`
    })
    .join("\n")

  return header + messages
}

export function sessionToJSON(session: ChatSession): string {
  return JSON.stringify(session, null, 2)
}

export function downloadBlob(content: string, filename: string, mime: string) {
  if (typeof window === "undefined") return

  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function safeFilename(title: string, ext: string): string {
  const name = title.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 60) || "chat"
  return `${name}.${ext}`
}

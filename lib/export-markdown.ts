// Export a chat session (or any messages array) to a portable markdown file
// with YAML frontmatter suitable for static blog publishing.

export type ExportMessage = {
  role?: string
  content?: unknown
  createdAt?: number | string
  model?: string
  provider?: string
}

export type ExportOptions = {
  title?: string
  author?: string
  tags?: string[]
  includeFrontmatter?: boolean
  includeTimestamps?: boolean
}

function escapeFrontmatterString(value: string): string {
  // YAML-safe: wrap in double quotes and escape backslash + quote.
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function partsToText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  const out: string[] = []
  for (const part of content) {
    if (!part || typeof part !== "object") continue
    const p = part as { type?: string; text?: string; image?: string; url?: string }
    if (p.type === "text" && typeof p.text === "string") out.push(p.text)
    else if (p.type === "image" && (p.image || p.url)) out.push(`![image](${p.image || p.url})`)
  }
  return out.join("\n\n")
}

export function messagesToMarkdown(messages: ExportMessage[], opts: ExportOptions = {}): string {
  const title = opts.title || "Cuộc trò chuyện"
  const includeFm = opts.includeFrontmatter !== false
  const includeTs = opts.includeTimestamps !== false

  const lines: string[] = []

  if (includeFm) {
    lines.push("---")
    lines.push(`title: ${escapeFrontmatterString(title)}`)
    if (opts.author) lines.push(`author: ${escapeFrontmatterString(opts.author)}`)
    lines.push(`date: ${new Date().toISOString()}`)
    if (opts.tags && opts.tags.length > 0) {
      lines.push(`tags: [${opts.tags.map((t) => escapeFrontmatterString(t)).join(", ")}]`)
    }
    lines.push("generator: Tan's Agents")
    lines.push("---")
    lines.push("")
  }

  lines.push(`# ${title}`)
  lines.push("")

  for (const msg of messages) {
    const role = msg.role || "unknown"
    if (role === "system") continue
    const roleLabel = role === "user" ? "👤 User" : role === "assistant" ? "🤖 Assistant" : `**${role}**`

    let heading = `## ${roleLabel}`
    if (includeTs && msg.createdAt) {
      const ts = typeof msg.createdAt === "number" ? new Date(msg.createdAt) : new Date(msg.createdAt)
      if (!Number.isNaN(ts.getTime())) heading += `  \n*${ts.toLocaleString("vi-VN")}*`
    }
    if (msg.model && role === "assistant") heading += `  \n\`${msg.provider || ""}/${msg.model}\``

    lines.push(heading)
    lines.push("")
    lines.push(partsToText(msg.content))
    lines.push("")
  }

  return lines.join("\n")
}

export function downloadMarkdown(filename: string, content: string): void {
  if (typeof window === "undefined") return
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".md") ? filename : `${filename}.md`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function exportSessionToMarkdown(
  session: { title?: string; messages: ExportMessage[]; tags?: string[] },
  opts: Omit<ExportOptions, "title" | "tags"> = {}
): void {
  const safeTitle = (session.title || "chat").replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "chat"
  const filename = `${safeTitle.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.md`
  const md = messagesToMarkdown(session.messages, {
    title: session.title,
    tags: session.tags,
    ...opts,
  })
  downloadMarkdown(filename, md)
}

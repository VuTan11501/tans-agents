"use client"
// AI auto-regenerate session title after enough messages.
// Lightweight: uses Groq llama-3.1-8b-instant via /api/chat-sse.

const RENAMED_KEY = "tans-agents:auto-renamed-v1"
const MIN_MSGS = 4
const MAX_TITLE = 50

function getRenamedSet(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(RENAMED_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function markRenamed(id: string) {
  if (typeof window === "undefined") return
  try {
    const set = getRenamedSet()
    set.add(id)
    const arr = Array.from(set).slice(-200)
    localStorage.setItem(RENAMED_KEY, JSON.stringify(arr))
  } catch {}
}

export function shouldAutoTitle(sessionId: string, messageCount: number): boolean {
  if (messageCount < MIN_MSGS) return false
  return !getRenamedSet().has(sessionId)
}

export async function generateTitle(messages: any[], fetcher = fetch): Promise<string | null> {
  const sample = messages.slice(0, 6).map((m) => `${m.role}: ${String(m.content ?? "").slice(0, 200)}`).join("\n")
  if (!sample.trim()) return null

  const systemPrompt = `Bạn là chuyên gia đặt tiêu đề. Tạo MỘT tiêu đề ngắn gọn (≤${MAX_TITLE} ký tự, tiếng Việt nếu hội thoại tiếng Việt) cho cuộc trò chuyện sau. Chỉ trả về tiêu đề, KHÔNG quote, KHÔNG giải thích.`
  try {
    const res = await fetcher("/api/chat-sse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "groq",
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: sample },
        ],
      }),
    })
    if (!res.ok || !res.body) return null
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let title = ""
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === "[DONE]") continue
        try {
          const json = JSON.parse(payload)
          const delta = json?.choices?.[0]?.delta?.content || json?.delta || ""
          if (delta) title += delta
        } catch {
          title += payload
        }
      }
    }
    title = title.trim().replace(/^["'`*]+|["'`*]+$/g, "").split("\n")[0].trim()
    if (!title) return null
    return title.length > MAX_TITLE ? title.slice(0, MAX_TITLE - 1) + "…" : title
  } catch {
    return null
  }
}

export async function tryAutoTitle(
  sessionId: string,
  messages: any[],
  rename: (id: string, t: string) => void
): Promise<void> {
  if (!shouldAutoTitle(sessionId, messages.length)) return
  const t = await generateTitle(messages)
  if (t) {
    rename(sessionId, t)
    markRenamed(sessionId)
  }
}

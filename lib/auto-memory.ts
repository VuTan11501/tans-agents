// Auto-extract user facts from chat messages using a small LLM call.
// Stores extracted facts as "pending" in localStorage until user reviews them.

export type ExtractedFact = {
  id: string
  text: string
  source: string // short snippet of the user message that triggered it
  at: number
  status: "pending" | "accepted" | "rejected"
}

const STORAGE_KEY = "tans-agents:auto-memory-pending-v1"
const MAX_PENDING = 50
const EXTRACT_DEBOUNCE_MS = 5000

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function read(): ExtractedFact[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(rows: ExtractedFact[]): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-MAX_PENDING)))
  } catch {
    /* ignore */
  }
}

export function getPendingFacts(): ExtractedFact[] {
  return read().filter((r) => r.status === "pending")
}

export function getAllFacts(): ExtractedFact[] {
  return read()
}

export function setFactStatus(id: string, status: "accepted" | "rejected"): void {
  const rows = read()
  const idx = rows.findIndex((r) => r.id === id)
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], status }
    write(rows)
  }
}

export function clearAllPending(): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
}

const EXTRACT_PROMPT = `Bạn là module trích xuất "facts" về người dùng.
Quy tắc:
- CHỈ trả về JSON array các fact mới về sở thích, ngữ cảnh, công việc, công cụ, ràng buộc của user.
- Bỏ qua nội dung kỹ thuật chung, không phải về user. Bỏ qua câu hỏi.
- Không lặp lại fact đã biết.
- Mỗi fact 1 câu ngắn ≤ 80 ký tự, tiếng Việt.
- Nếu không có fact nào, trả về [].
- Output schema CHÍNH XÁC: ["fact1", "fact2"]`

let lastExtractAt = 0

/**
 * Send the latest user message to a fast model and extract facts.
 * Best-effort — silent on any failure.
 */
export async function extractFactsFromMessage(opts: {
  userMessage: string
  knownFacts?: string[]
  fetcher?: typeof fetch
}): Promise<ExtractedFact[]> {
  const now = Date.now()
  if (now - lastExtractAt < EXTRACT_DEBOUNCE_MS) return []
  lastExtractAt = now

  const userMessage = (opts.userMessage || "").trim()
  if (!userMessage || userMessage.length < 12) return []

  const known = (opts.knownFacts ?? []).slice(-20).join("\n- ")
  const userPrompt = `Tin nhắn user:\n"""${userMessage.slice(0, 1500)}"""\n\n${
    known ? `Fact đã biết:\n- ${known}\n\n` : ""
  }Trích xuất fact MỚI (chỉ JSON array string):`

  try {
    const fetcher = opts.fetcher ?? fetch
    const res = await fetcher("/api/chat-sse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: EXTRACT_PROMPT },
          { role: "user", content: userPrompt },
        ],
        provider: "groq",
        model: "llama-3.1-8b-instant",
      }),
    })
    if (!res.ok || !res.body) return []

    // Drain stream to text
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = ""
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split("\n")) {
        const trimmed = line.trim()
        if (!trimmed.startsWith("data:")) continue
        const payload = trimmed.slice(5).trim()
        if (payload === "[DONE]") continue
        try {
          const json = JSON.parse(payload)
          const delta = json?.choices?.[0]?.delta?.content
          if (typeof delta === "string") full += delta
        } catch {
          /* ignore partial */
        }
      }
    }

    // Extract JSON array from response
    const match = full.match(/\[[\s\S]*\]/)
    if (!match) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return []
    }
    if (!Array.isArray(parsed)) return []

    const facts: ExtractedFact[] = parsed
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, 5)
      .map((text) => ({
        id: crypto.randomUUID().slice(0, 10),
        text: text.trim().slice(0, 200),
        source: userMessage.slice(0, 100),
        at: Date.now(),
        status: "pending" as const,
      }))

    if (facts.length === 0) return []
    const rows = read()
    rows.push(...facts)
    write(rows)
    window.dispatchEvent(new CustomEvent("tans:facts-extracted", { detail: facts }))
    return facts
  } catch {
    return []
  }
}

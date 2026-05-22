"use client"

import { useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const INTENTS = ["Cảm ơn", "Xin lỗi", "Đề xuất", "Phàn nàn", "Theo dõi", "Lời mời", "Từ chối lịch sự", "Báo cáo", "Hỏi thông tin", "Khác"]
const TONES = ["Trang trọng", "Thân thiện", "Trực tiếp", "Khéo léo"]
const LENGTHS = ["Ngắn (3-5 câu)", "Vừa (1 đoạn)", "Dài (nhiều đoạn)"]
const LANGUAGES = ["vi", "en", "ja"]

export default function EmailComposerPage() {
  const [to, setTo] = useState("")
  const [from, setFrom] = useState("")
  const [subjectHint, setSubjectHint] = useState("")
  const [intent, setIntent] = useState("Cảm ơn")
  const [customIntent, setCustomIntent] = useState("")
  const [tone, setTone] = useState("Trang trọng")
  const [length, setLength] = useState("Vừa (1 đoạn)")
  const [language, setLanguage] = useState("vi")
  const [keyPoints, setKeyPoints] = useState("")
  const [output, setOutput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const resolvedIntent = intent === "Khác" ? customIntent.trim() || "Khác" : intent
  const canRun = useMemo(() => to.trim().length > 0 && from.trim().length > 0 && !loading, [to, from, loading])
  const parsedSubject = useMemo(() => extractSubject(output), [output])
  const parsedBody = useMemo(() => extractEmailBody(output), [output])

  function buildPrompt() {
    return `Soạn email ${language} ${tone}, độ dài ${length}, ý định '${resolvedIntent}', gửi đến ${to.trim()} từ ${from.trim()}. Subject hint: ${subjectHint.trim() || "không có"}. Các điểm cần đề cập: ${keyPoints.trim() || "không có"}. Trả về dạng:\n\n**Tiêu đề:** ...\n\n**Nội dung:**\n...`
  }

  async function generateEmail() {
    if (!canRun) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setOutput("")
    setError(null)

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          enabledTools: [],
          messages: [{ role: "user", content: buildPrompt() }],
          personaSystemPrompt:
            "Bạn là trợ lý soạn email chuyên nghiệp cho người Việt. Trả lời đúng format yêu cầu, không thêm lời dẫn ngoài email.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => {
        setOutput((current) => current + chunk)
      })
    } catch (err: any) {
      setError(err?.name === "AbortError" ? "Đã huỷ yêu cầu." : err?.message ?? "Có lỗi khi gọi AI.")
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoading(false)
    }
  }

  async function copyText(kind: "email" | "subject") {
    const text = kind === "subject" ? parsedSubject : parsedBody || output
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 1500)
  }

  function fillSample() {
    setTo("Mentor hướng dẫn")
    setFrom("Học viên đang được mentor hỗ trợ")
    setSubjectHint("Cảm ơn vì buổi mentoring")
    setIntent("Cảm ơn")
    setCustomIntent("")
    setTone("Thân thiện")
    setLength("Vừa (1 đoạn)")
    setLanguage("vi")
    setKeyPoints("- Cảm ơn vì đã dành thời gian hướng dẫn\n- Nhắc lại 1-2 điểm học được\n- Mong tiếp tục nhận góp ý trong thời gian tới")
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">AI Email Composer</p>
              <h1 className="text-2xl font-semibold tracking-tight">Soạn email chuyên nghiệp</h1>
              <p className="mt-1 text-sm text-muted-foreground">Điền ngữ cảnh, AI sẽ viết email đúng giọng và đúng mục tiêu.</p>
            </div>
            <Button type="button" variant="secondary" onClick={fillSample} disabled={loading}>
              Dùng mẫu demo
            </Button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="grid gap-4">
              <TextField id="email-to" label="Gửi đến" value={to} onChange={setTo} placeholder="Sếp trực tiếp, Khách hàng A, Đồng nghiệp..." />
              <TextField id="email-from" label="Từ vai trò" value={from} onChange={setFrom} placeholder="Nhân viên dự án, account manager..." />
              <TextField id="email-subject" label="Gợi ý tiêu đề (tuỳ chọn)" value={subjectHint} onChange={setSubjectHint} placeholder="Ví dụ: Cập nhật tiến độ tuần này" />

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField id="email-intent" label="Ý định" value={intent} onChange={setIntent} options={INTENTS} />
                <SelectField id="email-tone" label="Giọng văn" value={tone} onChange={setTone} options={TONES} />
                <SelectField id="email-length" label="Độ dài" value={length} onChange={setLength} options={LENGTHS} />
                <SelectField id="email-language" label="Ngôn ngữ" value={language} onChange={setLanguage} options={LANGUAGES} />
              </div>

              {intent === "Khác" && (
                <TextareaField id="email-custom-intent" label="Mô tả ý định khác" value={customIntent} onChange={setCustomIntent} placeholder="Bạn muốn email đạt mục tiêu gì?" rows={3} />
              )}

              <TextareaField id="email-points" label="Các ý chính cần đưa vào (tuỳ chọn)" value={keyPoints} onChange={setKeyPoints} placeholder="- Ý 1\n- Ý 2\n- Deadline / mong muốn / call-to-action..." rows={7} />

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={generateEmail} disabled={!canRun}>
                  {loading ? "Đang soạn..." : "✉️ Soạn email"}
                </Button>
                <Button type="button" variant="secondary" onClick={generateEmail} disabled={!canRun || !output}>
                  Viết lại
                </Button>
                {loading && (
                  <Button type="button" variant="destructive" onClick={() => abortRef.current?.abort()}>
                    Dừng
                  </Button>
                )}
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-medium">Kết quả</h2>
                <p className="text-xs text-muted-foreground">Nội dung streaming từ AI, render dạng markdown.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => copyText("email")} disabled={!output}>
                  {copied === "email" ? "Đã copy" : "Copy email"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => copyText("subject")} disabled={!parsedSubject}>
                  {copied === "subject" ? "Đã copy" : "Copy subject only"}
                </Button>
              </div>
            </div>

            <div className="min-h-[28rem] rounded-lg border bg-background p-4 text-sm leading-relaxed">
              {output ? (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mb-2 prose-p:my-2 prose-ul:my-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
                </div>
              ) : (
                <span className="text-muted-foreground">Email sẽ xuất hiện ở đây.</span>
              )}
              {loading && <span className="mt-2 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function TextField({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
        placeholder={placeholder}
      />
    </div>
  )
}

function SelectField({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

function TextareaField({ id, label, value, onChange, placeholder, rows }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows: number }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full resize-y rounded-lg border bg-background p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
        placeholder={placeholder}
      />
    </div>
  )
}

function extractSubject(markdown: string) {
  const match = markdown.match(/^\s*(?:\*\*)?Tiêu đề(?:\*\*)?\s*:\s*(.+)$/im)
  return match?.[1]?.replace(/[*_`]/g, "").trim() ?? ""
}

function extractEmailBody(markdown: string) {
  const bodyMatch = markdown.match(/(?:\*\*)?Nội dung(?:\*\*)?\s*:\s*\n?([\s\S]*)/i)
  return bodyMatch?.[1]?.trim() || markdown.trim()
}

async function readSseStream(body: ReadableStream<Uint8Array>, onContent: (content: string) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""

    for (const event of events) {
      parseSseEvent(event, onContent)
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) parseSseEvent(buffer, onContent)
}

function parseSseEvent(event: string, onContent: (content: string) => void) {
  const dataLines = event
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())

  for (const data of dataLines) {
    if (!data || data === "[DONE]") continue

    const payload = JSON.parse(data)
    if (payload?.error?.message) throw new Error(payload.error.message)

    const content = payload?.choices?.[0]?.delta?.content
    if (typeof content === "string") onContent(content)
  }
}

"use client"

import { useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const LANGUAGES = [
  { value: "auto", label: "Tự động" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
] as const

const FORMATS = ["Markdown", "Plain"] as const
const AUDIENCES = ["Cấp quản lý", "Đồng nghiệp", "Khách hàng"] as const

const SAMPLE_TRANSCRIPT = `Minh: Chào mọi người, hôm nay standup nhanh cho sprint checkout mới. Hôm qua team frontend đã hoàn tất màn hình giỏ hàng và đang còn lỗi validate mã giảm giá trên mobile.
Lan: Backend đã merge API tính phí vận chuyển, nhưng endpoint payment callback cần thêm log để debug giao dịch thất bại. Em cần QA test lại vào chiều nay.
Huy: QA phát hiện 3 bug: giá bị làm tròn sai, trạng thái đơn hàng không cập nhật sau thanh toán, và email xác nhận bị gửi trùng. Bug email ưu tiên cao vì ảnh hưởng khách hàng thật.
Minh: Quyết định hôm nay là giữ scope release thứ Sáu, nhưng bỏ phần gợi ý sản phẩm sang sprint sau. Lan phụ trách log callback trước 15:00, Huy retest payment flow trước 17:00, Trang chuẩn bị email thông báo release cho khách hàng.
Trang: Em cần danh sách thay đổi cuối cùng và screenshot màn hình checkout mới. Ai gửi giúp em trước trưa mai?
Minh: Anh sẽ gửi changelog, còn frontend gửi screenshot. Câu hỏi còn mở: có cần bật feature flag cho 10% user trước không? Mình hỏi lại anh Nam trong buổi review chiều nay.`

const ACTIONS = [
  {
    label: "📝 Tóm tắt cuộc họp",
    instruction:
      "Tóm tắt cuộc họp có cấu trúc với các mục: Mục tiêu, Nội dung chính, Tiến độ, Rủi ro/vấn đề, Bước tiếp theo.",
  },
  {
    label: "✅ Trích xuất action items",
    instruction:
      "Liệt kê tất cả action items dưới dạng bảng markdown với cột: Việc cần làm | Người phụ trách | Hạn hoàn thành | Mức độ ưu tiên.",
  },
  {
    label: "🔑 Quyết định chính",
    instruction: "Trích xuất các quyết định chính đã được thống nhất. Nêu rõ bối cảnh và tác động nếu có.",
  },
  {
    label: "❓ Câu hỏi cần follow up",
    instruction: "Liệt kê các câu hỏi còn mở, ai cần trả lời, và đề xuất bước follow up tiếp theo.",
  },
  {
    label: "📧 Soạn email tổng kết",
    instruction: "Soạn email tổng kết chuyên nghiệp gửi cho người tham dự, gồm subject, lời chào, tóm tắt, action items và lời kết.",
  },
] as const

type Action = (typeof ACTIONS)[number]
type Language = (typeof LANGUAGES)[number]["value"]
type Format = (typeof FORMATS)[number]
type Audience = (typeof AUDIENCES)[number]

export default function MeetingNotesPage() {
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [language, setLanguage] = useState<Language>("vi")
  const [format, setFormat] = useState<Format>("Markdown")
  const [audience, setAudience] = useState<Audience>("Đồng nghiệp")
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = loadingLabel !== null
  const canRun = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading])
  const counts = useMemo(() => {
    const trimmed = input.trim()
    return {
      words: trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0,
      chars: input.length,
    }
  }, [input])

  async function runAction(action: Action) {
    const text = input.trim()
    if (!text || isLoading) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoadingLabel(action.label)
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
          messages: [{ role: "user", content: buildPrompt(action, text, language, format, audience) }],
          personaSystemPrompt:
            "Bạn là trợ lý ghi chú cuộc họp chuyên nghiệp. Trả lời đúng yêu cầu, rõ ràng, không bịa thông tin ngoài transcript.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => {
        setOutput((current) => current + chunk)
      })
    } catch (err: any) {
      if (err?.name === "AbortError") setError("Đã huỷ yêu cầu.")
      else setError(err?.message ?? "Có lỗi khi gọi AI.")
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoadingLabel(null)
    }
  }

  function abortRun() {
    abortRef.current?.abort()
  }

  async function copyOutput() {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function clearAll() {
    setInput("")
    setOutput("")
    setError(null)
  }

  function loadSample() {
    setInput(SAMPLE_TRANSCRIPT)
    setOutput("")
    setError(null)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Meeting Notes AI</p>
              <h1 className="text-2xl font-semibold tracking-tight">Trợ lý ghi chú cuộc họp</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Dán transcript, chọn thiết lập và tạo tóm tắt/action items bằng streaming AI.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={loadSample} disabled={isLoading}>
                Dùng mẫu demo
              </Button>
              <Button type="button" variant="secondary" onClick={clearAll} disabled={isLoading || (!input && !output)}>
                Clear
              </Button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="meeting-input" className="text-sm font-medium">
                Nội dung cuộc họp / transcript
              </label>
              <p className="text-xs text-muted-foreground">
                {counts.words} từ • {counts.chars} ký tự
              </p>
            </div>
            <textarea
              id="meeting-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="min-h-[22rem] w-full resize-y rounded-lg border bg-background p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="Dán nội dung họp, ghi chú standup, transcript call..."
            />
          </div>

          <aside className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Thiết lập đầu ra</h2>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium">
                Ngôn ngữ
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                  className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  {LANGUAGES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Định dạng
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value as Format)}
                  className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  {FORMATS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium">
                Đối tượng nhận
                <select
                  value={audience}
                  onChange={(event) => setAudience(event.target.value as Audience)}
                  className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  {AUDIENCES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 grid gap-2">
              {ACTIONS.map((action) => (
                <Button key={action.label} type="button" variant="secondary" onClick={() => runAction(action)} disabled={!canRun}>
                  {action.label}
                </Button>
              ))}
              {isLoading && (
                <Button type="button" variant="destructive" onClick={abortRun}>
                  Dừng streaming
                </Button>
              )}
            </div>

            <div className="mt-3 min-h-5 text-sm">
              {isLoading && <span className="text-muted-foreground">Đang chạy: {loadingLabel}</span>}
              {error && <span className="text-destructive">{error}</span>}
            </div>
          </aside>
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium">Kết quả</h2>
              <p className="text-xs text-muted-foreground">Markdown được render trực tiếp, có thể copy bản gốc.</p>
            </div>
            <Button type="button" variant="secondary" onClick={copyOutput} disabled={!output}>
              {copied ? "Đã sao chép" : "Copy"}
            </Button>
          </div>

          <div className="min-h-[16rem] rounded-lg border bg-background p-4 text-sm leading-relaxed">
            {output ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
              </div>
            ) : (
              <span className="text-muted-foreground">Chưa có kết quả.</span>
            )}
            {isLoading && <span className="mt-2 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
          </div>
        </section>
      </div>
    </main>
  )
}

function buildPrompt(action: Action, text: string, language: Language, format: Format, audience: Audience) {
  const languageInstruction =
    language === "auto" ? "Giữ/nghiệm suy ngôn ngữ phù hợp theo nội dung đầu vào." : language === "vi" ? "Trả lời bằng tiếng Việt." : "Respond in English."
  const formatInstruction = format === "Markdown" ? "Dùng Markdown rõ ràng." : "Trả về plain text, không dùng Markdown phức tạp."

  return `${action.instruction}\n\nThiết lập:\n- ${languageInstruction}\n- Định dạng: ${formatInstruction}\n- Đối tượng nhận: ${audience}\n\nTranscript/ghi chú:\n---\n${text}`
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

"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const MODES = [
  {
    label: "✍️ Kiểm tra ngữ pháp",
    systemPrompt:
      "Bạn là trợ lý biên tập tiếng Việt. Tìm lỗi ngữ pháp, chính tả, dấu câu và diễn đạt trong văn bản. Trả lời bằng tiếng Việt, theo cấu trúc: ## Tổng quan, ## Lỗi cần sửa (bảng: lỗi | gợi ý | lý do), ## Bản đã chỉnh sửa.",
  },
  {
    label: "📖 Đánh giá độ rõ ràng",
    systemPrompt:
      "Bạn là chuyên gia đánh giá độ rõ ràng của văn bản. Chấm điểm 1-10, nêu điểm mạnh, điểm gây khó hiểu và đề xuất cải thiện cụ thể. Trả lời bằng tiếng Việt, dùng markdown.",
  },
  {
    label: "🎯 Phân tích cấu trúc",
    systemPrompt:
      "Bạn là cố vấn cấu trúc bài viết. Phân tích bố cục, mạch lập luận, thứ tự ý, đoạn mở-thân-kết và đề xuất cách sắp xếp lại. Trả lời bằng tiếng Việt, có tiêu đề và bullet rõ ràng.",
  },
  {
    label: "🔤 Đề xuất từ vựng",
    systemPrompt:
      "Bạn là trợ lý nâng cấp từ vựng. Gợi ý từ/cụm từ thay thế tự nhiên, chính xác và phù hợp ngữ cảnh. Trả lời bằng tiếng Việt, ưu tiên bảng: từ hiện tại | đề xuất | sắc thái/ghi chú.",
  },
  {
    label: "📝 Viết lại học thuật",
    systemPrompt:
      "Bạn là biên tập viên học thuật. Viết lại văn bản theo phong cách trang trọng, logic, khách quan, phù hợp bài luận/báo cáo. Giữ nguyên ý chính, không thêm dữ kiện mới. Trả lời bằng tiếng Việt.",
  },
  {
    label: "💬 Viết lại đơn giản",
    systemPrompt:
      "Bạn là trợ lý đơn giản hoá văn bản. Viết lại sao cho dễ hiểu, câu ngắn, từ phổ thông, giữ nguyên ý chính. Trả lời bằng tiếng Việt và chỉ thêm ghi chú khi thật cần thiết.",
  },
] as const

export default function WritingPage() {
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [activeMode, setActiveMode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = activeMode !== null
  const trimmedInput = input.trim()
  const wordCount = useMemo(() => countWords(input), [input])
  const charCount = input.length
  const canRun = trimmedInput.length > 0 && !isLoading

  async function runMode(mode: (typeof MODES)[number]) {
    if (!trimmedInput || isLoading) return

    const controller = new AbortController()
    abortRef.current = controller
    setActiveMode(mode.label)
    setOutput("")
    setError(null)
    setCopied(false)

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          enabledTools: [],
          messages: [
            {
              role: "user",
              content: `Hãy xử lý văn bản sau:\n\n---\n\n${trimmedInput}`,
            },
          ],
          personaSystemPrompt: mode.systemPrompt,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => {
        setOutput((current) => current + chunk)
      })
    } catch (err: unknown) {
      if (isAbortError(err)) {
        setError("Đã huỷ yêu cầu.")
      } else {
        setError(err instanceof Error ? err.message : "Có lỗi khi gọi AI.")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setActiveMode(null)
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
    abortRun()
    setInput("")
    setOutput("")
    setError(null)
    setActiveMode(null)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <CardDescription>Writing AI Studio</CardDescription>
                <CardTitle>Phân tích và viết lại văn bản</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Chọn một chế độ để kiểm tra ngữ pháp, độ rõ ràng, cấu trúc hoặc viết lại nội dung.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={clearAll} disabled={isLoading || (!input && !output)}>
                Xoá nội dung
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="writing-input" className="text-sm font-medium">
                Văn bản cần xử lý
              </label>
              <Textarea
                id="writing-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="mt-2 min-h-[18rem] resize-y text-sm leading-relaxed"
                placeholder="Dán bài viết, đoạn văn hoặc bản nháp cần chỉnh sửa..."
                disabled={isLoading}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {formatNumber(wordCount)} từ • {formatNumber(charCount)} ký tự
                </span>
                {isLoading && <span>Đang chạy: {activeMode}</span>}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MODES.map((mode) => (
                <Button key={mode.label} type="button" variant="secondary" onClick={() => runMode(mode)} disabled={!canRun}>
                  {mode.label}
                </Button>
              ))}
            </div>

            <div className="min-h-5 text-sm">
              {error && <span className="text-destructive">{error}</span>}
              {isLoading && (
                <Button type="button" variant="destructive" size="sm" onClick={abortRun}>
                  Dừng phân tích
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl">Kết quả</CardTitle>
                <CardDescription>Phản hồi được stream và render markdown.</CardDescription>
              </div>
              <Button type="button" variant="secondary" onClick={copyOutput} disabled={!output}>
                {copied ? "Đã sao chép" : "Sao chép kết quả"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose-chat min-h-[16rem] rounded-lg border bg-background p-4 text-sm leading-relaxed">
              {output ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground">Chưa có kết quả. Nhập văn bản và chọn một chế độ phía trên.</p>
              )}
              {isLoading && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
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

function countWords(value: string) {
  const words = value.trim().match(/\S+/g)
  return words?.length ?? 0
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value)
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

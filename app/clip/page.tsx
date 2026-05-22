"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const ACTIONS = [
  {
    label: "📝 Tóm tắt",
    instruction: "Tóm tắt nội dung sau bằng tiếng Việt, ngắn gọn, giữ các ý quan trọng nhất.",
  },
  {
    label: "🌐 Dịch sang tiếng Anh",
    instruction: "Dịch nội dung sau sang tiếng Anh tự nhiên, rõ nghĩa. Chỉ trả về bản dịch.",
  },
  {
    label: "🌐 Dịch sang tiếng Việt",
    instruction: "Dịch nội dung sau sang tiếng Việt tự nhiên, rõ nghĩa. Chỉ trả về bản dịch.",
  },
  {
    label: "✨ Viết lại trang trọng",
    instruction: "Viết lại nội dung sau theo giọng văn trang trọng, lịch sự, chuyên nghiệp. Giữ nguyên ý chính.",
  },
  {
    label: "✨ Viết lại thân mật",
    instruction: "Viết lại nội dung sau theo giọng văn thân mật, dễ hiểu, tự nhiên. Giữ nguyên ý chính.",
  },
  {
    label: "🔡 Sửa chính tả",
    instruction: "Sửa chính tả, ngữ pháp và dấu câu cho nội dung sau. Không thay đổi ý nghĩa.",
  },
] as const

export default function ClipboardHelperPage() {
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = loadingLabel !== null
  const canRun = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading])

  async function runAction(action: (typeof ACTIONS)[number]) {
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
          messages: [
            {
              role: "user",
              content: `${action.instruction}\n\n---\n\n${text}`,
            },
          ],
          personaSystemPrompt:
            "Bạn là trợ lý clipboard cho Tan. Trả lời đúng yêu cầu, súc tích, không thêm lời dẫn không cần thiết.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => {
        setOutput((current) => current + chunk)
      })
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError("Đã huỷ yêu cầu.")
      } else {
        setError(err?.message ?? "Có lỗi khi gọi AI.")
      }
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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Clipboard AI helper</p>
              <h1 className="text-2xl font-semibold tracking-tight">Xử lý nhanh nội dung đã copy</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Provider mặc định: <code>{PROVIDER}</code> • Model: <code>{MODEL}</code>
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={clearAll} disabled={isLoading || (!input && !output)}>
              Xoá nội dung
            </Button>
          </div>
        </header>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <label htmlFor="clip-input" className="text-sm font-medium">
            Dán nội dung vào đây
          </label>
          <textarea
            id="clip-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="mt-2 min-h-[16rem] w-full resize-y rounded-lg border bg-background p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            placeholder="Paste text cần tóm tắt, dịch, viết lại hoặc sửa chính tả..."
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {ACTIONS.map((action) => (
              <Button key={action.label} type="button" variant="secondary" onClick={() => runAction(action)} disabled={!canRun}>
                {action.label}
              </Button>
            ))}
            {isLoading && (
              <Button type="button" variant="destructive" onClick={abortRun}>
                Dừng
              </Button>
            )}
          </div>

          <div className="mt-3 min-h-5 text-sm">
            {isLoading && <span className="text-muted-foreground">Đang chạy: {loadingLabel}</span>}
            {error && <span className="text-destructive">{error}</span>}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium">Kết quả streaming</h2>
              <p className="text-xs text-muted-foreground">Nội dung sẽ hiện dần khi AI trả lời.</p>
            </div>
            <Button type="button" variant="secondary" onClick={copyOutput} disabled={!output}>
              {copied ? "Đã sao chép" : "Sao chép kết quả"}
            </Button>
          </div>

          <div className="min-h-[14rem] whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-relaxed">
            {output || <span className="text-muted-foreground">Chưa có kết quả.</span>}
            {isLoading && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
          </div>
        </section>
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

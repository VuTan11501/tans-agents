"use client"

import { useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

type ContractAction = "summary" | "risks" | "terms" | "lawyer" | "rewrite"

const ACTIONS: Record<ContractAction, { label: string; instruction: string }> = {
  summary: {
    label: "📋 Tóm tắt điều khoản",
    instruction:
      "Tóm tắt các điều khoản chính của hợp đồng sau bằng tiếng Việt, dạng bảng markdown: STT | Điều khoản | Tóm tắt | Ảnh hưởng đến tôi.",
  },
  risks: {
    label: "⚠️ Rủi ro cần lưu ý",
    instruction:
      "Liệt kê các điểm gây rủi ro hoặc bất lợi trong hợp đồng (vd: phí ẩn, điều kiện hủy nghiệt, auto-renewal, jurisdiction xa, indemnification quá rộng, IP assignment, non-compete). Mỗi điểm: ## Vấn đề / Mức độ / Đề xuất.",
  },
  terms: {
    label: "🔍 Giải thích thuật ngữ",
    instruction: "Liệt kê và giải thích các thuật ngữ pháp lý/kỹ thuật trong hợp đồng bằng ngôn ngữ đơn giản.",
  },
  lawyer: {
    label: "💬 Câu hỏi để hỏi luật sư",
    instruction: "Liệt kê 10 câu hỏi quan trọng tôi nên hỏi luật sư trước khi ký hợp đồng này.",
  },
  rewrite: {
    label: "✏️ Đề xuất sửa đổi",
    instruction: "Đề xuất các điều khoản nên thương lượng/sửa đổi, kèm wording thay thế.",
  },
}

export default function ContractPage() {
  const [contractText, setContractText] = useState("")
  const [output, setOutput] = useState("")
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = loadingLabel !== null
  const canRun = useMemo(() => contractText.trim().length > 0 && !isLoading, [contractText, isLoading])

  async function runAction(actionKey: ContractAction) {
    const text = contractText.trim()
    if (!text || isLoading) return

    const action = ACTIONS[actionKey]
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
              content: `${action.instruction}\n\n--- HỢP ĐỒNG ---\n\n${text}`,
            },
          ],
          personaSystemPrompt:
            "Bạn là trợ lý đọc hợp đồng cho Tan. Trả lời bằng tiếng Việt, thận trọng, có cấu trúc. Luôn nhắc rằng đây không thay thế tư vấn luật sư khi phù hợp.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => {
        setOutput((current) => current + chunk)
      })
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoadingLabel(null)
    }
  }

  async function copyOutput() {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function clearAll() {
    abortRef.current?.abort()
    setContractText("")
    setOutput("")
    setError(null)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-200">
          ⚠️ Đây là phân tích tham khảo từ AI, không thay thế tư vấn luật sư.
        </div>

        <header className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">AI Contract Reviewer</p>
              <h1 className="text-2xl font-semibold tracking-tight">Phân tích hợp đồng</h1>
              <p className="mt-1 text-sm text-muted-foreground">Dán NDA, terms of service, hợp đồng lao động, thuê nhà... để tóm tắt và rà rủi ro.</p>
            </div>
            <Button type="button" variant="secondary" onClick={clearAll} disabled={isLoading || (!contractText && !output)}>
              Xoá
            </Button>
          </div>
        </header>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <label htmlFor="contract-text" className="text-sm font-medium">
            Nội dung hợp đồng
          </label>
          <textarea
            id="contract-text"
            value={contractText}
            onChange={(event) => setContractText(event.target.value)}
            className="mt-2 min-h-[20rem] w-full resize-y rounded-lg border bg-background p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            placeholder="Dán nội dung hợp đồng vào đây..."
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(ACTIONS) as ContractAction[]).map((actionKey) => (
              <Button key={actionKey} type="button" variant="secondary" onClick={() => runAction(actionKey)} disabled={!canRun}>
                {ACTIONS[actionKey].label}
              </Button>
            ))}
            {isLoading && (
              <Button type="button" variant="destructive" onClick={() => abortRef.current?.abort()}>
                Dừng
              </Button>
            )}
          </div>

          <div className="mt-3 min-h-5 text-sm">
            {isLoading && <span className="text-muted-foreground">Đang chạy: {loadingLabel}</span>}
            {error && <span className="text-destructive">{error}</span>}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium">Kết quả phân tích</h2>
              <p className="text-xs text-muted-foreground">Markdown được render trực tiếp, có thể copy lại khi cần.</p>
            </div>
            <Button type="button" variant="secondary" onClick={copyOutput} disabled={!output}>
              {copied ? "Đã sao chép" : "Copy"}
            </Button>
          </div>

          <div className="min-h-[18rem] rounded-lg border bg-background p-4 text-sm leading-relaxed">
            {output ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown> : <span className="text-muted-foreground">Chưa có kết quả.</span>}
            {isLoading && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
          </div>
        </section>
      </div>
    </main>
  )
}

function getErrorMessage(err: unknown) {
  if (err instanceof DOMException && err.name === "AbortError") return "Đã huỷ yêu cầu."
  if (err instanceof Error) return err.message
  return "Có lỗi khi gọi AI."
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

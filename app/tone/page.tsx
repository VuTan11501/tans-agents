"use client"

import { useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"
const SYSTEM_PROMPT =
  "Phân tích tông giọng (tone), cảm xúc (sentiment), và phong cách (style) của đoạn văn bản sau. Trả về dạng markdown gồm các mục: ## Tông giọng tổng thể, ## Cảm xúc chính, ## Phong cách viết, ## Đối tượng người đọc, ## Gợi ý cải thiện."

const SAMPLE_TEXT = `Chào team,

Mình thấy deadline này lại tiếp tục bị trễ dù tuần trước mọi người đều nói là "ổn". Nếu có vấn đề thì chắc mọi người đã chủ động báo sớm hơn rồi nhỉ.

Mình sẽ tự xử lý phần còn lại để kịp gửi khách hàng. Lần sau hy vọng chúng ta có thể giao tiếp rõ ràng hơn một chút.

Cảm ơn.`

export default function TonePage() {
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const canAnalyze = useMemo(() => input.trim().length > 0 && !isStreaming, [input, isStreaming])

  async function analyzeTone() {
    const text = input.trim()
    if (!text || isStreaming) return

    const controller = new AbortController()
    abortRef.current = controller
    setIsStreaming(true)
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
          messages: [{ role: "user", content: text }],
          personaSystemPrompt: SYSTEM_PROMPT,
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
        setError("Đã dừng phân tích.")
      } else {
        setError(err?.message ?? "Có lỗi khi gọi AI.")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsStreaming(false)
    }
  }

  function abortAnalyze() {
    abortRef.current?.abort()
  }

  function useSample() {
    if (isStreaming) return
    setInput(SAMPLE_TEXT)
    setOutput("")
    setError(null)
    setCopied(false)
  }

  async function copyOutput() {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function clearAll() {
    if (isStreaming) abortAnalyze()
    setInput("")
    setOutput("")
    setError(null)
    setCopied(false)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader className="gap-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <CardDescription>Phân tích giao tiếp bằng AI</CardDescription>
                <CardTitle className="mt-1 text-2xl">Phân tích tông giọng</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Provider: <code>{PROVIDER}</code> • Model: <code>{MODEL}</code>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={useSample} disabled={isStreaming}>
                  Sample
                </Button>
                <Button type="button" variant="secondary" onClick={copyOutput} disabled={!output}>
                  {copied ? "Đã sao chép" : "Sao chép"}
                </Button>
                <Button type="button" variant="secondary" onClick={clearAll} disabled={!input && !output && !error}>
                  Xoá
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Đoạn văn bản cần phân tích</CardTitle>
            <CardDescription>{input.length.toLocaleString("vi-VN")} ký tự</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="min-h-[18rem] resize-y bg-background text-sm leading-relaxed"
              placeholder="Dán email, tin nhắn hoặc đoạn văn cần phân tích tone..."
            />
            <div className="flex flex-wrap items-center gap-2">
              {isStreaming ? (
                <Button type="button" variant="destructive" onClick={abortAnalyze}>
                  Dừng
                </Button>
              ) : (
                <Button type="button" onClick={analyzeTone} disabled={!canAnalyze}>
                  Phân tích tông giọng
                </Button>
              )}
              <div className="min-h-5 text-sm">
                {isStreaming && <span className="text-muted-foreground">AI đang phân tích...</span>}
                {error && <span className="text-destructive">{error}</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kết quả phân tích</CardTitle>
            <CardDescription>Nội dung markdown sẽ được stream và render bên dưới.</CardDescription>
          </CardHeader>
          <CardContent>
            <article className="min-h-[18rem] rounded-lg border bg-background p-4">
              {output.trim() ? (
                <div className="prose-chat max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
                  {isStreaming && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
                </div>
              ) : (
                <div className="flex min-h-[16rem] items-center justify-center text-center text-sm text-muted-foreground">
                  Chưa có kết quả. Nhập văn bản rồi bấm “Phân tích tông giọng”.
                </div>
              )}
            </article>
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

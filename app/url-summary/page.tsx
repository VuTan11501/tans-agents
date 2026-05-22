"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"
const MAX_EXTRACTED_CHARS_FOR_AI = 60_000
const SUMMARY_SYSTEM_PROMPT =
  "Tóm tắt bài viết dưới đây thành các phần: ## TL;DR (2-3 câu), ## Các điểm chính (bullet), ## Kết luận. Dùng tiếng Việt."

export default function UrlSummaryPage() {
  const [url, setUrl] = useState("")
  const [summary, setSummary] = useState("")
  const [rawText, setRawText] = useState("")
  const [readLength, setReadLength] = useState<number | null>(null)
  const [phase, setPhase] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = phase !== null
  const canRun = useMemo(() => url.trim().length > 0 && !isLoading, [url, isLoading])

  async function summarizeUrl() {
    const targetUrl = normalizeUrl(url.trim())
    if (!targetUrl || isLoading) return

    const controller = new AbortController()
    abortRef.current = controller
    setPhase("Đang đọc nội dung trang...")
    setSummary("")
    setRawText("")
    setReadLength(null)
    setError(null)
    setCopied(false)

    try {
      let prompt = ""

      try {
        const extracted = await fetchWithJinaReader(targetUrl, controller.signal)
        const trimmed = extracted.trim()
        const clipped = trimmed.slice(0, MAX_EXTRACTED_CHARS_FOR_AI)
        const clippedNote =
          trimmed.length > clipped.length
            ? `\n\n(Lưu ý: nội dung gốc dài ${formatNumber(trimmed.length)} ký tự, phần gửi AI được giới hạn ${formatNumber(clipped.length)} ký tự đầu.)`
            : ""

        setRawText(trimmed)
        setReadLength(trimmed.length)
        prompt = `URL: ${targetUrl}\n\n---\n\n${clipped}${clippedNote}`
      } catch (readErr: unknown) {
        if (isAbortError(readErr)) throw readErr

        const message = readErr instanceof Error ? readErr.message : "Không đọc được trang qua Jina Reader."
        setError(`Không đọc trực tiếp được qua Jina Reader (${message}). Đang nhờ AI suy luận từ URL.`)
        prompt = `Không thể fetch nội dung trực tiếp qua Jina Reader/CORS. Hãy suy luận thận trọng dựa trên URL sau; nếu không đủ dữ liệu, nói rõ giới hạn và không bịa chi tiết.\n\nURL: ${targetUrl}`
      }

      setPhase("Đang tóm tắt bằng AI...")
      await streamChat(prompt, controller.signal, (chunk) => {
        setSummary((current) => current + chunk)
      })
    } catch (err: unknown) {
      if (isAbortError(err)) {
        setError("Đã huỷ yêu cầu.")
      } else {
        setError(err instanceof Error ? err.message : "Có lỗi khi tóm tắt URL.")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setPhase(null)
    }
  }

  function abortRun() {
    abortRef.current?.abort()
  }

  async function copySummary() {
    if (!summary) return
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function clearAll() {
    abortRun()
    setUrl("")
    setSummary("")
    setRawText("")
    setReadLength(null)
    setPhase(null)
    setError(null)
    setShowRaw(false)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <CardDescription>URL Summary AI</CardDescription>
                <CardTitle>Tóm tắt bài viết từ URL</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Đọc nội dung bằng Jina Reader rồi stream tóm tắt tiếng Việt qua AI.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={clearAll} disabled={isLoading || (!url && !summary && !rawText)}>
                Xoá
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 md:flex-row">
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") summarizeUrl()
                }}
                placeholder="https://example.com/bai-viet-can-tom-tat"
                disabled={isLoading}
                aria-label="URL cần tóm tắt"
              />
              <Button type="button" onClick={summarizeUrl} disabled={!canRun}>
                Tóm tắt
              </Button>
              {isLoading && (
                <Button type="button" variant="destructive" onClick={abortRun}>
                  Dừng
                </Button>
              )}
            </div>

            <div className="mt-3 min-h-5 text-sm">
              {phase && <span className="text-muted-foreground">{phase}</span>}
              {readLength !== null && (
                <span className="text-muted-foreground"> Đã đọc {formatNumber(readLength)} ký tự từ trang.</span>
              )}
              {error && <p className="mt-2 text-destructive">{error}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-xl">Kết quả tóm tắt</CardTitle>
                <CardDescription>Nội dung markdown được render khi AI trả lời.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={copySummary} disabled={!summary}>
                  {copied ? "Đã sao chép" : "Sao chép tóm tắt"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowRaw((value) => !value)} disabled={!rawText}>
                  {showRaw ? "Ẩn nội dung gốc" : "Hiện nội dung gốc"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose-chat min-h-[16rem] rounded-lg border bg-background p-4 text-sm leading-relaxed">
              {summary ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground">Chưa có tóm tắt.</p>
              )}
              {isLoading && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
            </div>

            {showRaw && rawText && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-2 text-sm font-medium">Nội dung đã trích xuất</div>
                <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                  {rawText}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function normalizeUrl(value: string) {
  if (!value) return ""
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    return new URL(withProtocol).toString()
  } catch {
    return ""
  }
}

async function fetchWithJinaReader(url: string, signal: AbortSignal) {
  const jinaKey = process.env.NEXT_PUBLIC_JINA_API_KEY
  const headers: HeadersInit = jinaKey ? { Authorization: `Bearer ${jinaKey}` } : {}
  const response = await fetch(`https://r.jina.ai/${url}`, { headers, signal })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

async function streamChat(prompt: string, signal: AbortSignal, onContent: (content: string) => void) {
  const response = await fetch("/api/chat-sse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: PROVIDER,
      model: MODEL,
      enabledTools: [],
      messages: [{ role: "user", content: prompt }],
      personaSystemPrompt: SUMMARY_SYSTEM_PROMPT,
    }),
    signal,
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  if (!response.body) throw new Error("Không nhận được stream từ server")

  await readSseStream(response.body, onContent)
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value)
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

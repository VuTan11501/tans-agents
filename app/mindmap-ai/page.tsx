"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"
const QUICK_TOPICS = ["JavaScript", "Marketing", "Quản lý dự án", "Học tiếng Anh"]

export default function MindmapAiPage() {
  const [topic, setTopic] = useState("")
  const [code, setCode] = useState("")
  const [streamText, setStreamText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const canGenerate = useMemo(() => topic.trim().length > 0 && !isLoading, [topic, isLoading])
  const displayCode = code || streamText

  async function generateMindmap(nextTopic = topic) {
    const text = nextTopic.trim()
    if (!text || isLoading) return

    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
    setError(null)
    setCode("")
    setStreamText("")
    setCopied(false)

    let streamed = ""

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          enabledTools: [],
          messages: [{ role: "user", content: text }],
          personaSystemPrompt:
            "Tạo mindmap dạng Mermaid (cú pháp `mindmap`) cho chủ đề sau. Có 3-4 nhánh chính, mỗi nhánh 3-5 nhánh con. CHỈ trả về code mermaid trong code block, không kèm chú thích.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => {
        streamed += chunk
        setStreamText(streamed)
      })

      const mermaidCode = extractMermaidCode(streamed)
      if (!mermaidCode) throw new Error("AI không trả về mã Mermaid hợp lệ.")
      setCode(mermaidCode)
    } catch (err: any) {
      if (err?.name === "AbortError") setError("Đã huỷ yêu cầu.")
      else setError(err?.message ?? "Có lỗi khi tạo mindmap.")
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsLoading(false)
    }
  }

  function useQuickTopic(value: string) {
    setTopic(value)
    void generateMindmap(value)
  }

  function abortRun() {
    abortRef.current?.abort()
  }

  async function copyCode() {
    if (!displayCode) return
    await navigator.clipboard.writeText(displayCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function openMermaidLive() {
    if (!displayCode) return
    window.open(createMermaidLiveUrl(displayCode), "_blank", "noopener,noreferrer")
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mindmap AI</p>
                <CardTitle>Tạo mindmap Mermaid</CardTitle>
                <CardDescription>
                  Nhập chủ đề, AI sẽ tạo cú pháp Mermaid mindmap. Dự án chưa cài package <code>mermaid</code>, nên trang hiển thị mã và hỗ trợ mở trên mermaid.live.
                </CardDescription>
              </div>
              <Button type="button" variant="secondary" onClick={() => setCode("")} disabled={!displayCode || isLoading}>
                Xoá kết quả
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="space-y-2 text-sm font-medium">
                Chủ đề
                <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Ví dụ: JavaScript, Marketing, Quản lý dự án..." />
              </label>
              <div className="flex gap-2">
                <Button type="button" onClick={() => generateMindmap()} disabled={!canGenerate}>
                  {isLoading ? "Đang tạo..." : "Tạo mindmap"}
                </Button>
                {isLoading && (
                  <Button type="button" variant="destructive" onClick={abortRun}>
                    Dừng
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="py-2 text-sm text-muted-foreground">Mẫu nhanh:</span>
              {QUICK_TOPICS.map((item) => (
                <Button key={item} type="button" variant="secondary" size="sm" onClick={() => useQuickTopic(item)} disabled={isLoading}>
                  {item}
                </Button>
              ))}
            </div>

            {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-xl">Kết quả</CardTitle>
                  <CardDescription>Fallback không cài dependency: xem mã Mermaid hoặc mở trực tiếp trên mermaid.live.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={copyCode} disabled={!displayCode}>
                    {copied ? "Đã sao chép" : "Sao chép mã"}
                  </Button>
                  <Button type="button" onClick={openMermaidLive} disabled={!displayCode}>
                    Sao chép vào mermaid.live
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="min-h-[28rem] rounded-lg border bg-muted/30 p-4">
                {displayCode ? (
                  <pre className="h-full min-h-[26rem] overflow-auto whitespace-pre-wrap rounded-md bg-background p-4 text-sm leading-relaxed">
                    <code>{displayCode}</code>
                  </pre>
                ) : (
                  <div className="flex min-h-[26rem] items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground">
                    Mindmap Mermaid sẽ xuất hiện ở đây sau khi tạo.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Hướng dẫn nhanh</CardTitle>
              <CardDescription>Không thêm package mới theo yêu cầu.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>1. Tạo mindmap bằng AI.</p>
              <p>2. Nhấn “Sao chép mã” để dùng trong Markdown/Mermaid.</p>
              <p>3. Nhấn “Sao chép vào mermaid.live” để mở trình xem online với mã đã nạp sẵn trong URL hash.</p>
            </CardContent>
          </Card>
        </section>

        <details className="rounded-lg border bg-card p-4 shadow-sm" open={!!displayCode && !isLoading}>
          <summary className="cursor-pointer text-sm font-medium">Xem mã</summary>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border bg-background p-4 text-sm leading-relaxed">
            <code>{displayCode || "Chưa có mã Mermaid."}</code>
          </pre>
        </details>
      </div>
    </main>
  )
}

function extractMermaidCode(text: string) {
  const fenced = text.match(/```(?:mermaid)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const raw = (fenced || text).trim()
  const mindmapIndex = raw.toLowerCase().indexOf("mindmap")
  return mindmapIndex >= 0 ? raw.slice(mindmapIndex).trim() : raw
}

function createMermaidLiveUrl(code: string) {
  const state = {
    code,
    mermaid: { theme: "default" },
    autoSync: true,
    updateDiagram: true,
  }
  const encoded = toBase64Url(JSON.stringify(state))
  return `https://mermaid.live/edit#base64:${encoded}`
}

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
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

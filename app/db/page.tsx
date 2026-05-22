"use client"

import { useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const ENGINES = ["PostgreSQL", "MySQL", "SQLite", "MongoDB", "DynamoDB"] as const

const MODES = [
  {
    label: "🗄️ Thiết kế schema",
    needsOldSchema: false,
    buildInstruction: (engine: string) =>
      `Thiết kế database schema cho ${engine} từ mô tả nghiệp vụ sau. Trả về markdown gồm: ## Tổng quan ## Danh sách bảng (mỗi bảng có columns, types, constraints, indexes) ## Quan hệ ## Sample queries ## ER diagram dạng mermaid \`erDiagram\`.`,
  },
  {
    label: "🔧 SQL CREATE",
    needsOldSchema: false,
    buildInstruction: (engine: string) => `Sinh CHỈ các câu CREATE TABLE/INDEX hợp lệ cho ${engine} dựa trên mô tả.`,
  },
  {
    label: "📈 Tối ưu query",
    needsOldSchema: false,
    buildInstruction: (engine: string) => `Đề xuất index, partition, denormalization phù hợp với mô tả cho ${engine}.`,
  },
  {
    label: "🔄 Migration",
    needsOldSchema: true,
    buildInstruction: (engine: string) => `Sinh migration script chuyển đổi từ schema cũ sang schema mới cho ${engine}.`,
  },
  {
    label: "🌱 Seed data",
    needsOldSchema: false,
    buildInstruction: (engine: string) => `Sinh sample INSERT statements với dữ liệu thực tế (10 rows/bảng) cho ${engine}.`,
  },
] as const

const SAMPLE_DOMAIN = "Hệ thống quản lý thư viện với độc giả, sách, tác giả, thể loại, nhiều bản sao sách, mượn trả, đặt trước, phí phạt trả muộn và nhân viên xử lý giao dịch. Cần theo dõi trạng thái sách, lịch sử mượn, thanh toán phí phạt và báo cáo sách phổ biến."

export default function DatabaseDesignerPage() {
  const [description, setDescription] = useState("")
  const [oldSchema, setOldSchema] = useState("")
  const [engine, setEngine] = useState<(typeof ENGINES)[number]>("PostgreSQL")
  const [activeMode, setActiveMode] = useState<(typeof MODES)[number]["label"]>(MODES[0].label)
  const [output, setOutput] = useState("")
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const activeAction = MODES.find((mode) => mode.label === activeMode) ?? MODES[0]
  const isLoading = loadingLabel !== null
  const canRun = description.trim().length > 0 && !isLoading
  const stats = useMemo(
    () => ({
      lines: description.length ? description.split("\n").length : 0,
      chars: description.length,
    }),
    [description]
  )
  const mermaidCode = useMemo(() => extractMermaid(output), [output])
  const mermaidUrl = useMemo(() => buildMermaidLiveUrl(mermaidCode), [mermaidCode])

  async function runAction() {
    const text = description.trim()
    if (!text || isLoading) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoadingLabel(activeAction.label)
    setOutput("")
    setError(null)

    const migrationContext = activeAction.needsOldSchema
      ? `\n\n## Schema cũ\n\n\`\`\`${engine.toLowerCase()}\n${oldSchema.trim() || "(Chưa cung cấp schema cũ; hãy nêu giả định trước khi sinh migration.)"}\n\`\`\``
      : ""

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
              content: `${activeAction.buildInstruction(engine)}\n\n## Mô tả nghiệp vụ\n\n${text}${migrationContext}`,
            },
          ],
          personaSystemPrompt:
            "Bạn là database architect. Trả lời bằng tiếng Việt, chính xác theo engine được chọn. Với SQL, ưu tiên cú pháp hợp lệ, constraints rõ ràng, index thực dụng. Với NoSQL, mô tả collection/table, key design và access patterns.",
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

  function loadSample() {
    setDescription(SAMPLE_DOMAIN)
    setEngine("PostgreSQL")
    setError(null)
  }

  function clearAll() {
    setDescription("")
    setOldSchema("")
    setOutput("")
    setError(null)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">AI Database Designer</p>
              <h1 className="text-2xl font-semibold tracking-tight">Thiết kế database từ mô tả nghiệp vụ</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Sinh schema, SQL, migration, seed data và ER diagram qua <code>/api/chat-sse</code>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={loadSample} disabled={isLoading}>
                Nạp ví dụ
              </Button>
              <Button type="button" variant="secondary" onClick={clearAll} disabled={isLoading || (!description && !oldSchema && !output)}>
                Xoá nội dung
              </Button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <label htmlFor="engine" className="text-sm font-medium">
                  Database engine
                </label>
                <select
                  id="engine"
                  value={engine}
                  onChange={(event) => setEngine(event.target.value as (typeof ENGINES)[number])}
                  className="mt-2 h-10 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  {ENGINES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-muted-foreground">
                {stats.lines} dòng • {stats.chars.toLocaleString("vi-VN")} ký tự
              </div>
            </div>

            <label htmlFor="domain-description" className="mt-4 block text-sm font-medium">
              Mô tả nghiệp vụ
            </label>
            <textarea
              id="domain-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 min-h-[18rem] w-full resize-y rounded-lg border bg-background p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="VD: Hệ thống quản lý thư viện với độc giả, sách, mượn trả, phí phạt..."
            />

            {activeAction.needsOldSchema && (
              <>
                <label htmlFor="old-schema" className="mt-4 block text-sm font-medium">
                  Schema cũ (tuỳ chọn cho migration)
                </label>
                <textarea
                  id="old-schema"
                  value={oldSchema}
                  onChange={(event) => setOldSchema(event.target.value)}
                  className="mt-2 min-h-[10rem] w-full resize-y rounded-lg border bg-background p-4 font-mono text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                  placeholder="Dán schema cũ hoặc migration hiện tại..."
                  spellCheck={false}
                />
              </>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {MODES.map((mode) => (
                <Button
                  key={mode.label}
                  type="button"
                  variant={activeMode === mode.label ? "default" : "secondary"}
                  onClick={() => setActiveMode(mode.label)}
                  disabled={isLoading}
                >
                  {mode.label}
                </Button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="button" onClick={runAction} disabled={!canRun}>
                Sinh kết quả
              </Button>
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
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium">Kết quả database design</h2>
                <p className="text-xs text-muted-foreground">Hỗ trợ markdown, bảng, code block và mermaid ER diagram.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={copyOutput} disabled={!output}>
                  {copied ? "Đã sao chép" : "Copy result"}
                </Button>
                <Button type="button" variant="secondary" asChild disabled={!mermaidCode}>
                  <a href={mermaidUrl} target="_blank" rel="noreferrer" aria-disabled={!mermaidCode}>
                    Mở mermaid.live
                  </a>
                </Button>
              </div>
            </div>

            <div className="min-h-[34rem] overflow-x-auto rounded-lg border bg-background p-4 text-sm leading-relaxed">
              {output ? (
                <MarkdownResult content={output} />
              ) : (
                <span className="text-muted-foreground">Chưa có kết quả.</span>
              )}
              {isLoading && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function MarkdownResult({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:scroll-m-20 prose-pre:bg-transparent prose-pre:p-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code: CodeRenderer,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function CodeRenderer({ inline, className, children, ...props }: any) {
  const match = /language-(\w+)/.exec(className || "")
  const language = match?.[1] ?? "text"
  const value = String(children).replace(/\n$/, "")

  if (inline) {
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]" {...props}>
        {children}
      </code>
    )
  }

  return (
    <SyntaxHighlighter
      PreTag="div"
      language={language}
      style={oneDark}
      customStyle={{ borderRadius: "0.75rem", margin: "1rem 0", padding: "1rem" }}
      wrapLongLines
    >
      {value}
    </SyntaxHighlighter>
  )
}

function extractMermaid(markdown: string) {
  const match = markdown.match(/```mermaid\s*([\s\S]*?)```/i)
  return match?.[1]?.trim() ?? ""
}

function buildMermaidLiveUrl(code: string) {
  if (!code) return "https://mermaid.live/edit"

  const lzString = typeof window !== "undefined" ? (window as any).LZString : undefined
  if (lzString?.compressToEncodedURIComponent) {
    const state = JSON.stringify({ code, mermaid: { theme: "default" }, updateEditor: false, autoSync: true })
    return `https://mermaid.live/edit#pako:${lzString.compressToEncodedURIComponent(state)}`
  }

  return "https://mermaid.live/edit"
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

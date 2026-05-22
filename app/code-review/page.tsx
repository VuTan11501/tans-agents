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

const LANGUAGES = ["TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C#", "PHP", "Ruby", "SQL", "Other"] as const

const MODES = [
  {
    label: "🔍 Review tổng quát",
    buildInstruction: (lang: string) =>
      `Review đoạn code ${lang} dưới đây. Trả về markdown gồm: ## Đánh giá tổng (1-10) ## Vấn đề nghiêm trọng ## Cải tiến đề xuất ## Best practices áp dụng ## Code mẫu đã sửa (nếu cần).`,
  },
  {
    label: "🐛 Tìm bug",
    buildInstruction: (lang: string) =>
      `Tìm tất cả bug tiềm ẩn, lỗi logic, race condition, memory leak, edge case missing trong code ${lang}.`,
  },
  {
    label: "🔒 Security audit",
    buildInstruction: (lang: string) =>
      `Kiểm tra security vulnerabilities (SQL injection, XSS, auth flaws, crypto issues, secret leak) trong code ${lang}.`,
  },
  {
    label: "⚡ Performance",
    buildInstruction: (lang: string) =>
      `Phân tích performance bottleneck, đề xuất tối ưu (algorithm, caching, query, render) cho code ${lang}.`,
  },
  {
    label: "📚 Giải thích",
    buildInstruction: (lang: string) => `Giải thích chi tiết đoạn code ${lang} cho người mới học.`,
  },
  {
    label: "✏️ Refactor",
    buildInstruction: (lang: string) =>
      `Refactor code ${lang} theo nguyên tắc SOLID/clean code. Trả về code đã refactor + giải thích thay đổi.`,
  },
] as const

const SAMPLE_CODE = `type User = { id: string; name?: string; role: "admin" | "user" }

async function getUsers(ids: string[]) {
  const users: User[] = []
  ids.forEach(async (id) => {
    const res = await fetch("/api/users/" + id)
    users.push(await res.json())
  })
  return users.filter((u) => u.name!.length > 0)
}

export function canDelete(user: User, ownerId: string) {
  return user.role === "admin" || user.id = ownerId
}`

export default function CodeReviewPage() {
  const [code, setCode] = useState("")
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("TypeScript")
  const [activeMode, setActiveMode] = useState<(typeof MODES)[number]["label"]>(MODES[0].label)
  const [output, setOutput] = useState("")
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedOutput, setCopiedOutput] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = loadingLabel !== null
  const lineCount = useMemo(() => (code.length ? code.split("\n").length : 0), [code])
  const charCount = code.length
  const activeAction = MODES.find((mode) => mode.label === activeMode) ?? MODES[0]
  const canRun = code.trim().length > 0 && !isLoading

  async function runReview() {
    const text = code.trim()
    if (!text || isLoading) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoadingLabel(activeAction.label)
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
              content: `${activeAction.buildInstruction(language)}\n\n\`\`\`${language.toLowerCase()}\n${text}\n\`\`\``,
            },
          ],
          personaSystemPrompt:
            "Bạn là senior software engineer và security reviewer. Trả lời bằng tiếng Việt, có cấu trúc markdown rõ ràng, ưu tiên phát hiện lỗi thực tế và đưa code mẫu an toàn khi cần.",
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

  async function copyText(value: string, setter: (copied: boolean) => void) {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setter(true)
    window.setTimeout(() => setter(false), 1500)
  }

  function loadSample() {
    setLanguage("TypeScript")
    setCode(SAMPLE_CODE)
    setError(null)
  }

  function clearAll() {
    setCode("")
    setOutput("")
    setError(null)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">AI Code Review</p>
              <h1 className="text-2xl font-semibold tracking-tight">Review code bằng tiếng Việt</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Streaming qua <code>/api/chat-sse</code> • Provider: <code>{PROVIDER}</code> • Model: <code>{MODEL}</code>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={loadSample} disabled={isLoading}>
                Nạp code mẫu
              </Button>
              <Button type="button" variant="secondary" onClick={clearAll} disabled={isLoading || (!code && !output)}>
                Xoá nội dung
              </Button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <label htmlFor="language" className="text-sm font-medium">
                  Ngôn ngữ
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as (typeof LANGUAGES)[number])}
                  className="mt-2 h-10 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-muted-foreground">
                {lineCount} dòng • {charCount.toLocaleString("vi-VN")} ký tự
              </div>
            </div>

            <label htmlFor="code-input" className="mt-4 block text-sm font-medium">
              Code cần phân tích
            </label>
            <textarea
              id="code-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-2 min-h-[28rem] w-full resize-y rounded-lg border bg-background p-4 font-mono text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="Dán code vào đây..."
              spellCheck={false}
            />

            <div className="mt-3 flex flex-wrap gap-2">
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
              <Button type="button" onClick={runReview} disabled={!canRun}>
                Chạy phân tích
              </Button>
              {isLoading && (
                <Button type="button" variant="destructive" onClick={abortRun}>
                  Dừng
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => copyText(code, setCopiedCode)} disabled={!code}>
                {copiedCode ? "Đã copy code" : "Copy code"}
              </Button>
            </div>

            <div className="mt-3 min-h-5 text-sm">
              {isLoading && <span className="text-muted-foreground">Đang chạy: {loadingLabel}</span>}
              {error && <span className="text-destructive">{error}</span>}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium">Kết quả review</h2>
                <p className="text-xs text-muted-foreground">Markdown sẽ hiện dần trong lúc AI trả lời.</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => copyText(output, setCopiedOutput)} disabled={!output}>
                {copiedOutput ? "Đã sao chép" : "Copy output"}
              </Button>
            </div>

            <div className="min-h-[32rem] overflow-x-auto rounded-lg border bg-background p-4 text-sm leading-relaxed">
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

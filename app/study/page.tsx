"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"
const SAVE_KEY = "tans-agents:saved-study-plans-v1"

const LEVELS = ["Mới bắt đầu", "Cơ bản", "Trung cấp", "Nâng cao"] as const
const TIMES = ["30p/ngày", "1h/ngày", "2h/ngày", "Cuối tuần", "Toàn thời gian"] as const
const TIMELINES = ["1 tuần", "2 tuần", "1 tháng", "3 tháng", "6 tháng", "1 năm"] as const
const STYLES = ["Đọc", "Video", "Thực hành", "Hỗn hợp"] as const
const LANGUAGES = ["vi", "en"] as const

const ACTIONS = [
  { label: "📚 Lập lộ trình học tập", kind: "roadmap" },
  { label: "🎯 Tạo bài kiểm tra", kind: "quiz" },
  { label: "📝 Cheatsheet", kind: "cheatsheet" },
  { label: "💡 Mẹo ghi nhớ", kind: "memory" },
] as const

type Action = (typeof ACTIONS)[number]

export default function StudyPage() {
  const [topic, setTopic] = useState("")
  const [currentLevel, setCurrentLevel] = useState<(typeof LEVELS)[number]>("Mới bắt đầu")
  const [targetLevel, setTargetLevel] = useState<(typeof LEVELS)[number]>("Trung cấp")
  const [time, setTime] = useState<(typeof TIMES)[number]>("1h/ngày")
  const [timeline, setTimeline] = useState<(typeof TIMELINES)[number]>("1 tháng")
  const [style, setStyle] = useState<(typeof STYLES)[number]>("Hỗn hợp")
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("vi")
  const [output, setOutput] = useState("")
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = loadingLabel !== null
  const canRun = useMemo(() => topic.trim().length > 0 && !isLoading, [topic, isLoading])

  function buildPrompt(action: Action) {
    const subject = topic.trim()
    const common = `Chủ đề: ${subject}\nTrình độ hiện tại: ${currentLevel}\nMục tiêu: ${targetLevel}\nThời gian học: ${time}\nTimeline: ${timeline}\nPhong cách học: ${style}\nNgôn ngữ trả lời: ${language}`

    if (action.kind === "roadmap") {
      return `Lập lộ trình học ${subject} từ ${currentLevel} đến ${targetLevel} trong ${timeline}, dành ${time}, phong cách ${style}. Format markdown gồm: ## Tổng quan & Mục tiêu ## Lộ trình theo tuần/ngày ## Tài nguyên đề xuất (sách, khoá học, kênh youtube) ## Dự án thực hành ## Cách kiểm tra tiến độ.\n\nThông tin chi tiết:\n${common}`
    }
    if (action.kind === "quiz") {
      return `Tạo bài kiểm tra 10 câu về ${subject}, phù hợp trình độ từ ${currentLevel} đến ${targetLevel}. Bao gồm nhiều dạng câu hỏi nếu phù hợp và có đáp án/giải thích ngắn ở cuối. Trả lời bằng markdown, ngôn ngữ: ${language}.\n\nThông tin chi tiết:\n${common}`
    }
    if (action.kind === "cheatsheet") {
      return `Tạo cheatsheet 1 trang thật súc tích về ${subject}, phù hợp người học trình độ ${currentLevel}, mục tiêu ${targetLevel}. Dùng markdown với tiêu đề, bullet, bảng công thức/khái niệm nếu cần. Ngôn ngữ: ${language}.\n\nThông tin chi tiết:\n${common}`
    }
    return `Đưa ra mẹo ghi nhớ, mnemonics và memory techniques để học ${subject}, phù hợp phong cách ${style}, timeline ${timeline}. Trả lời bằng markdown, có ví dụ cụ thể và cách ôn tập lặp lại ngắt quãng. Ngôn ngữ: ${language}.\n\nThông tin chi tiết:\n${common}`
  }

  async function runAction(action: Action) {
    if (!canRun) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoadingLabel(action.label)
    setOutput("")
    setError(null)
    setSaved(false)

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          enabledTools: [],
          messages: [{ role: "user", content: buildPrompt(action) }],
          personaSystemPrompt:
            "Bạn là trợ lý học tập cho Tan. Tạo kế hoạch rõ ràng, thực tế, có cấu trúc markdown, ưu tiên tài nguyên dễ áp dụng và bài tập thực hành.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => setOutput((current) => current + chunk))
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

  function savePlan() {
    if (!output) return
    const current = readSavedItems(SAVE_KEY)
    const item = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      topic: topic.trim(),
      currentLevel,
      targetLevel,
      time,
      timeline,
      style,
      language,
      content: output,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify([item, ...current].slice(0, 50)))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Study AI coach</p>
          <h1 className="text-2xl font-semibold tracking-tight">Lộ trình học tập cá nhân hoá</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tạo roadmap, quiz, cheatsheet và mẹo ghi nhớ bằng markdown.</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Chủ đề cần học
                <input value={topic} onChange={(event) => setTopic(event.target.value)} className="rounded-lg border bg-background px-3 py-2 outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="React Hooks, Lịch sử Việt Nam, Calculus..." />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Trình độ hiện tại
                  <select value={currentLevel} onChange={(event) => setCurrentLevel(event.target.value as (typeof LEVELS)[number])} className="rounded-lg border bg-background px-3 py-2 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20">
                    {LEVELS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Mục tiêu
                  <select value={targetLevel} onChange={(event) => setTargetLevel(event.target.value as (typeof LEVELS)[number])} className="rounded-lg border bg-background px-3 py-2 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20">
                    {LEVELS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Thời gian có thể học
                  <select value={time} onChange={(event) => setTime(event.target.value as (typeof TIMES)[number])} className="rounded-lg border bg-background px-3 py-2 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20">
                    {TIMES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Timeline
                  <select value={timeline} onChange={(event) => setTimeline(event.target.value as (typeof TIMELINES)[number])} className="rounded-lg border bg-background px-3 py-2 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20">
                    {TIMELINES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Phong cách học
                  <select value={style} onChange={(event) => setStyle(event.target.value as (typeof STYLES)[number])} className="rounded-lg border bg-background px-3 py-2 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20">
                    {STYLES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Ngôn ngữ
                  <select value={language} onChange={(event) => setLanguage(event.target.value as (typeof LANGUAGES)[number])} className="rounded-lg border bg-background px-3 py-2 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20">
                    {LANGUAGES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {ACTIONS.map((action) => (
                  <Button key={action.label} type="button" variant="secondary" onClick={() => runAction(action)} disabled={!canRun}>
                    {action.label}
                  </Button>
                ))}
                {isLoading && <Button type="button" variant="destructive" onClick={abortRun}>Dừng</Button>}
              </div>

              <div className="min-h-5 text-sm">
                {isLoading && <span className="text-muted-foreground">Đang chạy: {loadingLabel}</span>}
                {error && <span className="text-destructive">{error}</span>}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium">Kết quả markdown</h2>
                <p className="text-xs text-muted-foreground">Nội dung sẽ hiện dần khi AI trả lời.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={copyOutput} disabled={!output}>{copied ? "Đã sao chép" : "Copy"}</Button>
                <Button type="button" onClick={savePlan} disabled={!output}>{saved ? "Đã lưu" : "Save plan"}</Button>
              </div>
            </div>
            <MarkdownView content={output} loading={isLoading} empty="Chưa có kế hoạch. Hãy nhập chủ đề và chọn một tác vụ." />
          </div>
        </section>
      </div>
    </main>
  )
}

function readSavedItems(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function MarkdownView({ content, loading, empty }: { content: string; loading: boolean; empty: string }) {
  const html = useMemo(() => markdownToHtml(content), [content])
  return (
    <div className="min-h-[32rem] overflow-auto rounded-lg border bg-background p-4 text-sm leading-relaxed [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted [&_th]:p-2 [&_ul]:ml-5 [&_ul]:list-disc">
      {content ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <span className="text-muted-foreground">{empty}</span>}
      {loading && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
    </div>
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

    for (const event of events) parseSseEvent(event, onContent)
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

function markdownToHtml(markdown: string) {
  const lines = markdown.split(/\r?\n/)
  const html: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    if (line.trim().startsWith("```")) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index])
        index += 1
      }
      index += 1
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`)
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      index += 1
      continue
    }

    if (isTableStart(lines, index)) {
      const headers = splitTableRow(lines[index])
      index += 2
      const rows: string[][] = []
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        rows.push(splitTableRow(lines[index]))
        index += 1
      }
      html.push(`<table><thead><tr>${headers.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`)
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""))
        index += 1
      }
      html.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`)
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""))
        index += 1
      }
      html.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`)
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+/.test(lines[index]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[index]) && !lines[index].trim().startsWith("```") && !isTableStart(lines, index)) {
      paragraph.push(lines[index])
      index += 1
    }
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`)
  }

  return html.join("\n")
}

function isTableStart(lines: string[], index: number) {
  return /^\s*\|.*\|\s*$/.test(lines[index] ?? "") && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1] ?? "")
}

function splitTableRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
}

function renderInline(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;")
}

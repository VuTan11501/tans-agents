"use client"

import { useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const FUNDING_ROUNDS = [
  { value: "Pre-seed", label: "Pre-seed", detail: "ngắn gọn, tập trung insight, MVP và validation ban đầu" },
  { value: "Seed", label: "Seed", detail: "cân bằng giữa story, GTM, traction và kế hoạch dùng vốn" },
  { value: "Series A", label: "Series A", detail: "chi tiết hơn về scale, unit economics, moat và metrics" },
] as const

const SAMPLE_IDEA = `Vấn đề: Nhiều đội sales B2B mất hàng giờ mỗi tuần để tổng hợp insight từ CRM, email và call notes trước khi follow-up.
Giải pháp: AI copilot tự động đọc dữ liệu khách hàng, tóm tắt tình trạng deal, đề xuất next step và soạn email cá nhân hoá.
Đối tượng: Sales manager và account executive tại SaaS startup 50-500 nhân sự.`

function rehypeHighlight() {
  return (tree: unknown) => {
    visitCodeNodes(tree)
  }
}

function visitCodeNodes(node: unknown) {
  if (!node || typeof node !== "object") return
  const current = node as { tagName?: string; properties?: { className?: unknown }; children?: unknown[] }
  if (current.tagName === "code") {
    const className = Array.isArray(current.properties?.className) ? current.properties.className : []
    if (className.some((item) => typeof item === "string" && item.startsWith("language-"))) {
      current.properties = { ...current.properties, className: [...className, "hljs"] }
    }
  }
  current.children?.forEach(visitCodeNodes)
}

export default function PitchPage() {
  const [idea, setIdea] = useState("")
  const [fundingRound, setFundingRound] = useState<(typeof FUNDING_ROUNDS)[number]["value"]>("Seed")
  const [output, setOutput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const canSubmit = useMemo(() => idea.trim().length > 0 && !isLoading, [idea, isLoading])
  const roundDetail = FUNDING_ROUNDS.find((round) => round.value === fundingRound)?.detail ?? "cân bằng"

  async function submit() {
    const startupIdea = idea.trim()
    if (!startupIdea || isLoading) return

    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
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
          messages: [{ role: "user", content: buildPrompt(startupIdea, fundingRound, roundDetail) }],
          personaSystemPrompt:
            "Bạn là chuyên gia startup fundraising và pitch deck. Trả lời bằng tiếng Việt, markdown sạch, actionable, không thêm lời dẫn ngoài outline.",
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
      setIsLoading(false)
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
    setIdea("")
    setOutput("")
    setError(null)
    setCopied(false)
  }

  function useSample() {
    setIdea(SAMPLE_IDEA)
    setError(null)
  }

  function downloadMarkdown() {
    if (!output) return
    const blob = new Blob([output], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "outline.md"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Startup Pitch Deck</p>
              <h1 className="text-2xl font-semibold tracking-tight">Tạo outline pitch deck 10 slide</h1>
              <p className="mt-1 text-sm text-muted-foreground">Nhập ý tưởng startup, chọn vòng gọi vốn và stream outline markdown có speaker notes.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={useSample} disabled={isLoading}>
                Sample
              </Button>
              <Button type="button" variant="secondary" onClick={clearAll} disabled={isLoading || (!idea && !output)}>
                Xoá
              </Button>
            </div>
          </div>
        </header>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <label htmlFor="pitch-idea" className="text-sm font-medium">
            Mô tả ý tưởng startup
          </label>
          <textarea
            id="pitch-idea"
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            className="mt-2 min-h-[14rem] w-full resize-y rounded-lg border bg-background p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            placeholder="Mô tả vấn đề, giải pháp, đối tượng khách hàng, insight thị trường, traction nếu có..."
          />

          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <label className="text-sm font-medium">
              Vòng gọi vốn
              <select
                value={fundingRound}
                onChange={(event) => setFundingRound(event.target.value as typeof fundingRound)}
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
              >
                {FUNDING_ROUNDS.map((round) => (
                  <option key={round.value} value={round.value}>
                    {round.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={submit} disabled={!canSubmit}>
                Tạo outline
              </Button>
              {isLoading && (
                <Button type="button" variant="destructive" onClick={() => abortRef.current?.abort()}>
                  Dừng
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3 min-h-5 text-sm">
            {isLoading && <span className="text-muted-foreground">Đang tạo outline...</span>}
            {error && <span className="text-destructive">{error}</span>}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-medium">Kết quả markdown</h2>
              <p className="text-xs text-muted-foreground">Outline 10 slide sẽ hiện dần khi AI trả lời.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={copyOutput} disabled={!output}>
                {copied ? "Đã sao chép" : "Copy"}
              </Button>
              <Button type="button" variant="secondary" onClick={downloadMarkdown} disabled={!output}>
                Tải xuống .md
              </Button>
            </div>
          </div>
          <MarkdownBox output={output} isLoading={isLoading} />
        </section>
      </div>
    </main>
  )
}

function buildPrompt(idea: string, fundingRound: string, roundDetail: string) {
  return `Hãy tạo outline pitch deck startup chuẩn 10 slide cho vòng gọi vốn ${fundingRound} (${roundDetail}).

Ý tưởng startup:
${idea}

Yêu cầu format markdown:
- Đúng 10 slide theo thứ tự: Cover, Problem, Solution, Market, Product, Business Model, Traction, Competition, Team, Ask.
- Mỗi slide dùng heading dạng "## Slide N — <Tên slide>".
- Mỗi slide có các mục: "**Bullet points:**" với 3-5 bullet, và "**Speaker notes:**" với ghi chú nói 2-4 câu.
- Điều chỉnh độ chi tiết theo vòng gọi vốn.
- Nội dung cụ thể, tránh generic, có gợi ý số liệu/placeholder nếu thiếu dữ liệu.`
}

function MarkdownBox({ output, isLoading }: { output: string; isLoading: boolean }) {
  return (
    <article className="min-h-[22rem] rounded-lg border bg-background p-4 text-sm leading-relaxed">
      {output ? (
        <div className="prose-chat max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {output}
          </ReactMarkdown>
        </div>
      ) : (
        <span className="text-muted-foreground">Chưa có kết quả.</span>
      )}
      {isLoading && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
    </article>
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

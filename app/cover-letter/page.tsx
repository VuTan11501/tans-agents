"use client"

import { useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const TONES = [
  { value: "trang trọng", label: "Trang trọng" },
  { value: "thân thiện chuyên nghiệp", label: "Thân thiện chuyên nghiệp" },
  { value: "nhiệt huyết", label: "Nhiệt huyết" },
] as const

const LANGUAGES = [
  { value: "Tiếng Việt", label: "Tiếng Việt" },
  { value: "English", label: "English" },
  { value: "Cả hai", label: "Cả hai (dual column)" },
] as const

const SAMPLE = {
  company: "FPT Software",
  position: "Frontend Engineer",
  highlights:
    "3 năm kinh nghiệm React/Next.js, TypeScript, tối ưu performance và xây dựng design system. Từng làm việc với API streaming, dashboard nội bộ và automation workflow.",
  motivation: "Tôi thích môi trường công nghệ toàn cầu, cơ hội làm sản phẩm quy mô lớn và văn hoá học hỏi liên tục của công ty.",
}

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

export default function CoverLetterPage() {
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [highlights, setHighlights] = useState("")
  const [motivation, setMotivation] = useState("")
  const [tone, setTone] = useState<(typeof TONES)[number]["value"]>("thân thiện chuyên nghiệp")
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]["value"]>("Tiếng Việt")
  const [output, setOutput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const canSubmit = useMemo(
    () => company.trim().length > 0 && position.trim().length > 0 && highlights.trim().length > 0 && !isLoading,
    [company, position, highlights, isLoading]
  )

  async function submit() {
    if (!canSubmit) return

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
          messages: [
            {
              role: "user",
              content: buildPrompt({ company, position, highlights, motivation, tone, language }),
            },
          ],
          personaSystemPrompt:
            "Bạn là chuyên gia viết cover letter tuyển dụng. Viết tự nhiên, cụ thể, chuyên nghiệp, markdown sạch, không bịa thành tựu ngoài dữ liệu người dùng.",
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
    setCompany("")
    setPosition("")
    setHighlights("")
    setMotivation("")
    setOutput("")
    setError(null)
    setCopied(false)
  }

  function useSample() {
    setCompany(SAMPLE.company)
    setPosition(SAMPLE.position)
    setHighlights(SAMPLE.highlights)
    setMotivation(SAMPLE.motivation)
    setError(null)
  }

  function downloadMarkdown() {
    if (!output) return
    const blob = new Blob([output], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "cover-letter.md"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Cover Letter AI</p>
              <h1 className="text-2xl font-semibold tracking-tight">Soạn cover letter tiếng Việt</h1>
              <p className="mt-1 text-sm text-muted-foreground">Nhập thông tin ứng tuyển, chọn tone/ngôn ngữ và stream thư xin việc markdown.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={useSample} disabled={isLoading}>
                Sample
              </Button>
              <Button type="button" variant="secondary" onClick={clearAll} disabled={isLoading || (!company && !position && !highlights && !motivation && !output)}>
                Xoá
              </Button>
            </div>
          </div>
        </header>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField id="company" label="Tên công ty" value={company} onChange={setCompany} placeholder="Ví dụ: FPT Software" />
            <TextField id="position" label="Vị trí ứng tuyển" value={position} onChange={setPosition} placeholder="Ví dụ: Frontend Engineer" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
            <label className="text-sm font-medium">
              Kinh nghiệm / skills nổi bật
              <textarea
                value={highlights}
                onChange={(event) => setHighlights(event.target.value)}
                className="mt-2 min-h-[10rem] w-full resize-y rounded-lg border bg-background p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                placeholder="Tóm tắt kinh nghiệm, kỹ năng, thành tựu liên quan..."
              />
            </label>
            <label className="text-sm font-medium">
              Lý do thích công ty
              <textarea
                value={motivation}
                onChange={(event) => setMotivation(event.target.value)}
                className="mt-2 min-h-[10rem] w-full resize-y rounded-lg border bg-background p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                placeholder="Điều bạn thích ở công ty, sản phẩm, văn hoá, cơ hội..."
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <SelectField label="Tone" value={tone} onChange={(value) => setTone(value as typeof tone)} options={TONES} />
            <SelectField label="Ngôn ngữ" value={language} onChange={(value) => setLanguage(value as typeof language)} options={LANGUAGES} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={submit} disabled={!canSubmit}>
                Viết cover letter
              </Button>
              {isLoading && (
                <Button type="button" variant="destructive" onClick={() => abortRef.current?.abort()}>
                  Dừng
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3 min-h-5 text-sm">
            {isLoading && <span className="text-muted-foreground">Đang viết cover letter...</span>}
            {error && <span className="text-destructive">{error}</span>}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-medium">Kết quả markdown</h2>
              <p className="text-xs text-muted-foreground">Thư hoàn chỉnh 3-4 đoạn, render trực tiếp từ markdown.</p>
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

function TextField({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label htmlFor={id} className="text-sm font-medium">
      {label}
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
        placeholder={placeholder}
      />
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function buildPrompt({
  company,
  position,
  highlights,
  motivation,
  tone,
  language,
}: {
  company: string
  position: string
  highlights: string
  motivation: string
  tone: string
  language: string
}) {
  return `Hãy viết cover letter hoàn chỉnh cho ứng viên.

Thông tin:
- Công ty: ${company.trim()}
- Vị trí: ${position.trim()}
- Kinh nghiệm / skills nổi bật: ${highlights.trim()}
- Lý do thích công ty: ${motivation.trim() || "Chưa cung cấp, hãy viết chung chung nhưng chân thật, không bịa thông tin cụ thể."}
- Tone: ${tone}
- Ngôn ngữ: ${language}

Yêu cầu:
- Viết 3-4 đoạn, markdown sạch.
- Nếu ngôn ngữ là "Cả hai", trình bày dạng bảng markdown 2 cột: Tiếng Việt | English, nội dung tương ứng từng đoạn.
- Mở bài nêu vị trí và công ty; thân bài gắn skills với nhu cầu công việc; kết bài có lời cảm ơn và mong muốn trao đổi.
- Không dùng placeholder như [Tên bạn] trừ khi thật cần thiết; không bịa số liệu/thành tựu không có trong input.`
}

function MarkdownBox({ output, isLoading }: { output: string; isLoading: boolean }) {
  return (
    <article className="min-h-[20rem] rounded-lg border bg-background p-4 text-sm leading-relaxed">
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

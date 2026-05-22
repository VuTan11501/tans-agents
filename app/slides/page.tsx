"use client"

import { useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const AUDIENCES = [
  { value: "kid", label: "Trẻ em" },
  { value: "student", label: "Học sinh / sinh viên" },
  { value: "professional", label: "Chuyên gia" },
  { value: "executive", label: "Lãnh đạo / executive" },
] as const

const SLIDE_COUNTS = [5, 10, 15, 20] as const
const TONES = [
  { value: "formal", label: "Trang trọng" },
  { value: "casual", label: "Thân mật" },
  { value: "inspiring", label: "Truyền cảm hứng" },
] as const
const DURATIONS = [
  { value: "5p", label: "5 phút" },
  { value: "10p", label: "10 phút" },
  { value: "30p", label: "30 phút" },
  { value: "1h", label: "1 giờ" },
] as const

type SlideAction = "outline" | "visual" | "script" | "qa"

const ACTION_LABELS: Record<SlideAction, string> = {
  outline: "📊 Tạo dàn ý slide",
  visual: "🎨 Đề xuất visual",
  script: "🎤 Script thuyết trình",
  qa: "❓ Q&A dự kiến",
}

export default function SlidesPage() {
  const [topic, setTopic] = useState("")
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]["value"]>("student")
  const [slideCount, setSlideCount] = useState<(typeof SLIDE_COUNTS)[number]>(10)
  const [tone, setTone] = useState<(typeof TONES)[number]["value"]>("formal")
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]["value"]>("10p")
  const [output, setOutput] = useState("")
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = loadingLabel !== null
  const canRun = useMemo(() => topic.trim().length > 0 && !isLoading, [topic, isLoading])
  const audienceLabel = AUDIENCES.find((item) => item.value === audience)?.label ?? audience
  const toneLabel = TONES.find((item) => item.value === tone)?.label ?? tone
  const durationLabel = DURATIONS.find((item) => item.value === duration)?.label ?? duration

  function buildPrompt(action: SlideAction) {
    const cleanTopic = topic.trim()
    if (action === "outline") {
      return `Tạo dàn ý ${slideCount} slide thuyết trình về '${cleanTopic}' cho ${audienceLabel} với tone ${toneLabel} trong ${durationLabel}. Format markdown:\n\n# Slide 1: <title>\n**Mục đích:** ...\n**Nội dung:**\n- ...\n**Speaker notes:** ...\n\n# Slide 2: ...`
    }
    if (action === "visual") {
      return `Với cùng topic '${cleanTopic}', đề xuất visual/hình ảnh phù hợp cho từng slide. Liệt kê slide # + ý tưởng visual + prompt để generate image.`
    }
    if (action === "script") {
      return `Viết script đầy đủ cho người thuyết trình theo dàn ý slide trên, độ dài phù hợp ${durationLabel}. Topic: '${cleanTopic}'. Đối tượng: ${audienceLabel}. Tone: ${toneLabel}. Nếu chưa có dàn ý trước đó, hãy tự tạo cấu trúc ${slideCount} slide hợp lý rồi viết script.`
    }
    return `Liệt kê 10 câu hỏi có khả năng từ ${audienceLabel} kèm câu trả lời gợi ý cho bài thuyết trình về '${cleanTopic}' với tone ${toneLabel}, thời lượng ${durationLabel}.`
  }

  async function runAction(action: SlideAction) {
    if (!canRun) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoadingLabel(ACTION_LABELS[action])
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
          messages: [{ role: "user", content: buildPrompt(action) }],
          personaSystemPrompt:
            "Bạn là trợ lý tạo slide cho Tan. Trả lời bằng tiếng Việt, đúng format markdown được yêu cầu, rõ ràng và có thể dùng ngay.",
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
    setTopic("")
    setOutput("")
    setError(null)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">AI Presentation Builder</p>
              <h1 className="text-2xl font-semibold tracking-tight">Tạo slide thuyết trình</h1>
              <p className="mt-1 text-sm text-muted-foreground">Nhập topic, chọn đối tượng và để AI tạo dàn ý, visual, script, Q&A.</p>
            </div>
            <Button type="button" variant="secondary" onClick={clearAll} disabled={isLoading || (!topic && !output)}>
              Xoá
            </Button>
          </div>
        </header>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <label htmlFor="slides-topic" className="text-sm font-medium">
            Chủ đề thuyết trình
          </label>
          <input
            id="slides-topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="mt-2 w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            placeholder="Ví dụ: AI trong giáo dục, kế hoạch marketing Q4, biến đổi khí hậu..."
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField label="Đối tượng" value={audience} onChange={(value) => setAudience(value as typeof audience)} options={AUDIENCES} />
            <SelectField
              label="Số slide"
              value={String(slideCount)}
              onChange={(value) => setSlideCount(Number(value) as typeof slideCount)}
              options={SLIDE_COUNTS.map((count) => ({ value: String(count), label: `${count} slide` }))}
            />
            <SelectField label="Tone" value={tone} onChange={(value) => setTone(value as typeof tone)} options={TONES} />
            <SelectField label="Thời lượng" value={duration} onChange={(value) => setDuration(value as typeof duration)} options={DURATIONS} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(Object.keys(ACTION_LABELS) as SlideAction[]).map((action) => (
              <Button key={action} type="button" variant="secondary" onClick={() => runAction(action)} disabled={!canRun}>
                {ACTION_LABELS[action]}
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
              <h2 className="text-sm font-medium">Kết quả markdown</h2>
              <p className="text-xs text-muted-foreground">Nội dung stream trực tiếp từ AI.</p>
            </div>
            <Button type="button" variant="secondary" onClick={copyOutput} disabled={!output}>
              {copied ? "Đã sao chép" : "Copy"}
            </Button>
          </div>

          <MarkdownBox output={output} isLoading={isLoading} />
        </section>
      </div>
    </main>
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

function MarkdownBox({ output, isLoading }: { output: string; isLoading: boolean }) {
  return (
    <div className="min-h-[22rem] rounded-lg border bg-background p-4 text-sm leading-relaxed">
      {output ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
      ) : (
        <span className="text-muted-foreground">Chưa có kết quả.</span>
      )}
      {isLoading && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
    </div>
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

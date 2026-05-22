"use client"

import { useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

type ResumeAction = {
  label: string
  requiresJobDescription?: boolean
  systemPrompt: string
}

const ACTIONS: ResumeAction[] = [
  {
    label: "🎯 ATS Check",
    systemPrompt:
      "Bạn là chuyên gia tuyển dụng và tối ưu CV theo ATS. Đánh giá CV theo tiêu chí ATS (Applicant Tracking System). Trả lời bằng tiếng Việt, dùng Markdown với đúng các mục: ## Điểm số (X/100), ## Vấn đề chính, ## Đề xuất chỉnh sửa cụ thể.",
  },
  {
    label: "📊 Khớp với JD",
    requiresJobDescription: true,
    systemPrompt:
      "Bạn là chuyên gia tuyển dụng. So sánh CV với mô tả công việc. Trả lời bằng tiếng Việt, dùng Markdown với đúng các mục: ## Độ khớp tổng thể (X%), ## Điểm mạnh phù hợp, ## Lỗ hổng cần bổ sung, ## Câu hỏi phỏng vấn có thể gặp.",
  },
  {
    label: "✏️ Tối ưu hoá",
    systemPrompt:
      "Bạn là chuyên gia viết CV. Đề xuất viết lại từng phần của CV cho ấn tượng, rõ thành tựu, đúng chuẩn tuyển dụng và ATS. Trả lời bằng tiếng Việt, có ví dụ câu viết lại cụ thể.",
  },
  {
    label: "🔡 Trích xuất từ khoá",
    systemPrompt:
      "Bạn là trợ lý phân tích CV. Liệt kê các từ khoá kỹ năng, công nghệ, chứng chỉ có trong CV dưới dạng danh sách Markdown, nhóm theo: Kỹ năng cứng, Công nghệ/Công cụ, Kỹ năng mềm, Chứng chỉ/Bằng cấp, Vai trò/Lĩnh vực.",
  },
]

export default function ResumePage() {
  const [resumeText, setResumeText] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [output, setOutput] = useState("")
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = loadingLabel !== null
  const resumeStats = useMemo(() => getTextStats(resumeText), [resumeText])
  const jdStats = useMemo(() => getTextStats(jobDescription), [jobDescription])
  const canRun = useMemo(() => resumeText.trim().length > 0 && !isLoading, [resumeText, isLoading])

  async function runAction(action: ResumeAction) {
    const cv = resumeText.trim()
    const jd = jobDescription.trim()
    if (!cv || isLoading) return
    if (action.requiresJobDescription && !jd) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoadingLabel(action.label)
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
              content: buildUserContent(cv, jd),
            },
          ],
          personaSystemPrompt: action.systemPrompt,
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
        setError("Đã huỷ yêu cầu.")
      } else {
        setError(err?.message ?? "Có lỗi khi gọi AI.")
      }
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

  function clearAll() {
    setResumeText("")
    setJobDescription("")
    setOutput("")
    setError(null)
    setCopied(false)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">CV/Resume AI</p>
              <h1 className="text-2xl font-semibold tracking-tight">Phân tích và tối ưu CV</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Dán CV, thêm JD nếu có, rồi chạy ATS check, matching hoặc tối ưu nội dung.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={clearAll} disabled={isLoading || (!resumeText && !jobDescription && !output)}>
              Xoá tất cả
            </Button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <div className="flex min-h-[28rem] flex-col rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor="resume-input" className="text-sm font-medium">
                Nội dung CV/Resume
              </label>
              <span className="text-xs text-muted-foreground">
                {resumeStats.words} từ • {resumeStats.characters} ký tự
              </span>
            </div>
            <textarea
              id="resume-input"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              className="min-h-0 flex-1 resize-y rounded-lg border bg-background p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="Dán toàn bộ nội dung CV tại đây..."
            />
          </div>

          <div className="flex min-h-[28rem] flex-col rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor="jd-input" className="text-sm font-medium">
                Mô tả công việc (tuỳ chọn)
              </label>
              <span className="text-xs text-muted-foreground">
                {jdStats.words} từ • {jdStats.characters} ký tự
              </span>
            </div>
            <textarea
              id="jd-input"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              className="min-h-0 flex-1 resize-y rounded-lg border bg-background p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="Dán JD để bật chức năng so sánh độ khớp..."
            />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((action) => (
              <Button
                key={action.label}
                type="button"
                variant="secondary"
                onClick={() => runAction(action)}
                disabled={!canRun || (action.requiresJobDescription && !jobDescription.trim())}
                title={action.requiresJobDescription ? "Cần nhập mô tả công việc" : undefined}
              >
                {action.label}
              </Button>
            ))}
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
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium">Kết quả phân tích</h2>
              <p className="text-xs text-muted-foreground">Markdown sẽ được render khi AI trả lời streaming.</p>
            </div>
            <Button type="button" variant="secondary" onClick={copyOutput} disabled={!output}>
              {copied ? "Đã sao chép" : "Sao chép"}
            </Button>
          </div>

          <article className="min-h-[18rem] rounded-lg border bg-background p-4 text-sm leading-relaxed">
            {output ? (
              <div className="prose-chat max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
              </div>
            ) : (
              <div className="flex min-h-[16rem] items-center justify-center text-center text-sm text-muted-foreground">
                Chưa có kết quả. Hãy dán CV và chọn một thao tác ở trên.
              </div>
            )}
            {isLoading && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
          </article>
        </section>
      </div>
    </main>
  )
}

function buildUserContent(cv: string, jd: string) {
  return [`## CV/Resume`, cv, jd ? `## Mô tả công việc\n${jd}` : ""].filter(Boolean).join("\n\n---\n\n")
}

function getTextStats(text: string) {
  return {
    words: text.trim().split(/\s+/).filter(Boolean).length,
    characters: text.length,
  }
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

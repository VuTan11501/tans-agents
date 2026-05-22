"use client"

import { FormEvent, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const LEVELS = ["Intern", "Junior", "Mid", "Senior", "Lead"] as const
const DIFFICULTIES = ["Cơ bản", "Trung bình", "Khó", "Stress test"] as const
const LANGUAGES = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
] as const
const MODES = [
  { value: "questions", label: "Câu hỏi" },
  { value: "mock", label: "Mock chat" },
  { value: "review", label: "Đánh giá trả lời" },
] as const

type Level = (typeof LEVELS)[number]
type Difficulty = (typeof DIFFICULTIES)[number]
type Language = (typeof LANGUAGES)[number]["value"]
type Mode = (typeof MODES)[number]["value"]
type ChatMessage = { role: "user" | "assistant"; content: string }

export default function InterviewPage() {
  const [role, setRole] = useState("Frontend Developer")
  const [level, setLevel] = useState<Level>("Mid")
  const [difficulty, setDifficulty] = useState<Difficulty>("Trung bình")
  const [language, setLanguage] = useState<Language>("vi")
  const [mode, setMode] = useState<Mode>("questions")
  const [output, setOutput] = useState("")
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [mockMessages, setMockMessages] = useState<ChatMessage[]>([])
  const [mockInput, setMockInput] = useState("")
  const [mockDraft, setMockDraft] = useState("")
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = loadingLabel !== null
  const canRun = useMemo(() => role.trim().length > 0 && !isLoading, [role, isLoading])
  const langLabel = language === "vi" ? "tiếng Việt" : "English"

  async function runPrompt(label: string, prompt: string) {
    if (!canRun) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoadingLabel(label)
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
          messages: [{ role: "user", content: prompt }],
          personaSystemPrompt: buildBaseSystemPrompt(role, level, difficulty, language),
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

  function generateQuestions() {
    const prompt = `Tạo 5-10 câu hỏi phỏng vấn cho vị trí ${role.trim()} cấp ${level}, độ khó ${difficulty}.\n\nYêu cầu:\n- Viết bằng ${langLabel}.\n- Mỗi câu hỏi có model answer ngắn gọn nhưng đủ ý.\n- Chia nhóm theo kỹ năng nếu phù hợp.\n- Dùng Markdown rõ ràng.`
    void runPrompt("Tạo câu hỏi", prompt)
  }

  function reviewAnswer() {
    if (!question.trim() || !answer.trim() || !canRun) return
    const prompt = `Đánh giá câu trả lời phỏng vấn sau cho vị trí ${role.trim()} cấp ${level}, độ khó ${difficulty}.\n\nNgôn ngữ phản hồi: ${langLabel}.\n\nCâu hỏi:\n${question.trim()}\n\nCâu trả lời của ứng viên:\n${answer.trim()}\n\nHãy critique theo cấu trúc:\n1. Nhận xét tổng quan\n2. Điểm mạnh\n3. Điểm thiếu/rủi ro\n4. Câu trả lời cải thiện đề xuất\n5. Điểm số /10.`
    void runPrompt("Đánh giá trả lời", prompt)
  }

  async function sendMock(nextMessages: ChatMessage[], label: string) {
    if (!role.trim() || isLoading) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoadingLabel(label)
    setError(null)
    setMockDraft("")
    let streamed = ""

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          enabledTools: [],
          messages: nextMessages,
          personaSystemPrompt: `Bạn là interviewer chuyên nghiệp cho vị trí ${role.trim()} cấp ${level}. Hỏi một câu hỏi mỗi lần. Sau khi user trả lời, đưa feedback ngắn (1-2 câu) rồi hỏi câu tiếp theo. Tổng 5 câu. Kết thúc bằng tổng đánh giá. Độ khó: ${difficulty}. Ngôn ngữ: ${langLabel}.`,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => {
        streamed += chunk
        setMockDraft(streamed)
      })

      setMockMessages([...nextMessages, { role: "assistant", content: streamed }])
      setMockDraft("")
    } catch (err: any) {
      if (err?.name === "AbortError") setError("Đã huỷ yêu cầu.")
      else setError(err?.message ?? "Có lỗi khi gọi AI.")
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoadingLabel(null)
    }
  }

  function startMock() {
    if (!canRun) return
    const initial: ChatMessage[] = [
      {
        role: "user",
        content: `Bắt đầu mock interview cho vị trí ${role.trim()} cấp ${level}. Hãy hỏi câu đầu tiên bằng ${langLabel}.`,
      },
    ]
    setMockMessages(initial)
    void sendMock(initial, "Mock interview")
  }

  function submitMockAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = mockInput.trim()
    if (!text || isLoading) return

    const nextMessages: ChatMessage[] = [...mockMessages, { role: "user", content: text }]
    setMockMessages(nextMessages)
    setMockInput("")
    void sendMock(nextMessages, "Mock interview")
  }

  function abortRun() {
    abortRef.current?.abort()
  }

  function clearCurrent() {
    setOutput("")
    setError(null)
    setQuestion("")
    setAnswer("")
    setMockMessages([])
    setMockInput("")
    setMockDraft("")
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Interview AI</p>
              <h1 className="text-2xl font-semibold tracking-tight">Luyện phỏng vấn bằng AI</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Tạo câu hỏi, mock interview từng câu, hoặc đánh giá câu trả lời của bạn.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={clearCurrent} disabled={isLoading}>
              Clear
            </Button>
          </div>
        </header>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm font-medium md:col-span-2 lg:col-span-1">
              Vị trí ứng tuyển
              <input
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                placeholder="Frontend Developer, Product Manager..."
              />
            </label>

            <label className="block text-sm font-medium">
              Cấp độ kinh nghiệm
              <select
                value={level}
                onChange={(event) => setLevel(event.target.value as Level)}
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              >
                {LEVELS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Độ khó
              <select
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as Difficulty)}
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              >
                {DIFFICULTIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Ngôn ngữ
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              >
                {LANGUAGES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap gap-2 border-b pb-3">
            {MODES.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant={mode === item.value ? "default" : "secondary"}
                onClick={() => setMode(item.value)}
                disabled={isLoading}
              >
                {item.label}
              </Button>
            ))}
          </div>

          {mode === "questions" && (
            <div className="mt-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Tạo bộ câu hỏi + model answers</h2>
                <p className="mt-1 text-sm text-muted-foreground">AI sẽ tạo 5-10 câu hỏi theo role, level và độ khó đã chọn.</p>
              </div>
              <Button type="button" onClick={generateQuestions} disabled={!canRun}>
                Tạo câu hỏi phỏng vấn
              </Button>
            </div>
          )}

          {mode === "mock" && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Mock chat</h2>
                  <p className="mt-1 text-sm text-muted-foreground">AI hỏi từng câu, bạn trả lời, AI feedback rồi hỏi tiếp. Tổng 5 câu.</p>
                </div>
                <Button type="button" onClick={startMock} disabled={!canRun}>
                  Bắt đầu mock interview
                </Button>
              </div>

              <div className="min-h-[18rem] space-y-3 rounded-lg border bg-background p-4">
                {mockMessages.length === 0 && !mockDraft && <p className="text-sm text-muted-foreground">Chưa bắt đầu phiên mock.</p>}
                {mockMessages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={message.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto max-w-[85%]"}>
                    <div
                      className={
                        message.role === "user"
                          ? "rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground"
                          : "rounded-lg border bg-card px-4 py-3 text-sm"
                      }
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {mockDraft && (
                  <div className="mr-auto max-w-[85%] rounded-lg border bg-card px-4 py-3 text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{mockDraft}</ReactMarkdown>
                    <span className="mt-2 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />
                  </div>
                )}
              </div>

              <form onSubmit={submitMockAnswer} className="flex flex-col gap-2 sm:flex-row">
                <textarea
                  value={mockInput}
                  onChange={(event) => setMockInput(event.target.value)}
                  className="min-h-24 flex-1 resize-y rounded-lg border bg-background p-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  placeholder="Nhập câu trả lời của bạn..."
                  disabled={isLoading || mockMessages.length === 0}
                />
                <Button type="submit" disabled={!mockInput.trim() || isLoading || mockMessages.length === 0}>
                  Gửi trả lời
                </Button>
              </form>
            </div>
          )}

          {mode === "review" && (
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium">
                Câu hỏi phỏng vấn
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  className="mt-2 min-h-24 w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  placeholder="Dán câu hỏi cần luyện..."
                />
              </label>
              <label className="block text-sm font-medium">
                Câu trả lời của bạn
                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  className="mt-2 min-h-36 w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  placeholder="Dán câu trả lời để AI critique..."
                />
              </label>
              <Button type="button" onClick={reviewAnswer} disabled={!question.trim() || !answer.trim() || !canRun}>
                Đánh giá trả lời
              </Button>
            </div>
          )}

          <div className="mt-3 flex min-h-5 items-center gap-3 text-sm">
            {isLoading && <span className="text-muted-foreground">Đang chạy: {loadingLabel}</span>}
            {isLoading && (
              <Button type="button" variant="destructive" size="sm" onClick={abortRun}>
                Dừng
              </Button>
            )}
            {error && <span className="text-destructive">{error}</span>}
          </div>
        </section>

        {mode !== "mock" && (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-medium">Kết quả</h2>
            <div className="min-h-[18rem] rounded-lg border bg-background p-4 text-sm leading-relaxed">
              {output ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
                </div>
              ) : (
                <span className="text-muted-foreground">Chưa có kết quả.</span>
              )}
              {isLoading && <span className="mt-2 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function buildBaseSystemPrompt(role: string, level: Level, difficulty: Difficulty, language: Language) {
  const langLabel = language === "vi" ? "tiếng Việt" : "English"
  return `Bạn là chuyên gia phỏng vấn kỹ thuật và hành vi. Bối cảnh: vị trí ${role.trim()} cấp ${level}, độ khó ${difficulty}. Trả lời bằng ${langLabel}. Dùng Markdown rõ ràng, thực tế, súc tích.`
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

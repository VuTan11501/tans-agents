"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

export default function AudioTranscribePage() {
  const [transcribedText, setTranscribedText] = useState("")
  const [duration, setDuration] = useState(0)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisOutput, setAnalysisOutput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const canTranscribe = useMemo(() => fileInputRef.current?.files?.length === 1 && !isTranscribing, [isTranscribing])
  const canAnalyze = useMemo(() => transcribedText.trim().length > 0 && !isAnalyzing, [transcribedText, isAnalyzing])

  async function transcribeAudio() {
    const file = fileInputRef.current?.files?.[0]
    if (!file || isTranscribing) return

    setIsTranscribing(true)
    setError(null)
    setTranscribedText("")
    setDuration(0)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/audio-transcribe", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Transcription failed")

      setTranscribedText(data.text)
      setDuration(data.duration)
    } catch (err: any) {
      setError(err?.message ?? "Lỗi khi transcribe audio.")
    } finally {
      setIsTranscribing(false)
    }
  }

  async function analyzeText(analysisType: "summarize" | "keypoints") {
    if (!transcribedText.trim() || isAnalyzing) return

    const controller = new AbortController()
    abortRef.current = controller
    setIsAnalyzing(true)
    setError(null)
    setAnalysisOutput("")

    const instructions = {
      summarize: "Tóm tắt nội dung sau bằng tiếng Việt, ngắn gọn, giữ các ý quan trọng nhất.",
      keypoints: "Trích xuất các điểm chính từ nội dung sau dưới dạng danh sách bullet points bằng tiếng Việt.",
    }

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
              content: `${instructions[analysisType]}\n\n---\n\n${transcribedText}`,
            },
          ],
          personaSystemPrompt:
            "Bạn là trợ lý phân tích audio cho Tan. Trả lời đúng yêu cầu, súc tích, không thêm lời dẫn không cần thiết.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => {
        setAnalysisOutput((current) => current + chunk)
      })
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError("Đã huỷ yêu cầu.")
      } else {
        setError(err?.message ?? "Có lỗi khi gọi AI.")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsAnalyzing(false)
    }
  }

  function abortAnalysis() {
    abortRef.current?.abort()
  }

  async function copyTranscript() {
    if (!transcribedText) return
    await navigator.clipboard.writeText(transcribedText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function downloadTranscript() {
    if (!transcribedText) return
    const element = document.createElement("a")
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(transcribedText))
    element.setAttribute("download", `transcript-${Date.now()}.txt`)
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  function clearAll() {
    setTranscribedText("")
    setDuration(0)
    setAnalysisOutput("")
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Audio Transcription</p>
              <h1 className="text-2xl font-semibold tracking-tight">Transcribe & Analyze Audio</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Hỗ trợ: MP3, WAV, M4A • Provider: <code>{PROVIDER}</code> • Model: <code>{MODEL}</code>
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={clearAll} disabled={isTranscribing || isAnalyzing || (!transcribedText && !analysisOutput)}>
              Xoá nội dung
            </Button>
          </div>
        </header>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <label htmlFor="audio-file" className="text-sm font-medium">
            Chọn tệp audio
          </label>
          <input
            ref={fileInputRef}
            id="audio-file"
            type="file"
            accept="audio/mpeg,audio/wav,audio/mp4"
            className="mt-2 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm"
            disabled={isTranscribing}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={transcribeAudio} disabled={!canTranscribe} variant={canTranscribe ? "default" : "secondary"}>
              {isTranscribing ? "Đang transcribe..." : "🎙️ Transcribe"}
            </Button>
          </div>

          <div className="mt-3 min-h-5 text-sm">
            {isTranscribing && <span className="text-muted-foreground">Đang transcribe audio...</span>}
            {error && !isAnalyzing && <span className="text-destructive">{error}</span>}
          </div>
        </section>

        {transcribedText && (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium">Bản ghi âm</h2>
                <p className="text-xs text-muted-foreground">Thời lượng: {duration.toFixed(1)}s</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={copyTranscript} size="sm">
                  {copied ? "✓ Đã sao chép" : "Sao chép"}
                </Button>
                <Button type="button" variant="secondary" onClick={downloadTranscript} size="sm">
                  📥 Tải xuống
                </Button>
              </div>
            </div>

            <textarea
              value={transcribedText}
              onChange={(e) => setTranscribedText(e.target.value)}
              className="min-h-[12rem] w-full resize-y rounded-lg border bg-background p-4 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="Nội dung ghi âm..."
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => analyzeText("summarize")} disabled={!canAnalyze}>
                📝 Tóm tắt
              </Button>
              <Button type="button" variant="secondary" onClick={() => analyzeText("keypoints")} disabled={!canAnalyze}>
                ✨ Điểm chính
              </Button>
              {isAnalyzing && (
                <Button type="button" variant="destructive" onClick={abortAnalysis}>
                  Dừng
                </Button>
              )}
            </div>

            <div className="mt-3 min-h-5 text-sm">
              {isAnalyzing && <span className="text-muted-foreground">Đang phân tích...</span>}
              {error && isAnalyzing && <span className="text-destructive">{error}</span>}
            </div>
          </section>
        )}

        {analysisOutput && (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-medium">Kết quả phân tích</h2>
            <div className="min-h-[10rem] whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-relaxed">
              {analysisOutput}
              {isAnalyzing && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
            </div>
          </section>
        )}
      </div>
    </main>
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

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"
const STORAGE_KEY = "tans-agents:saved-stories-v1"

const GENRES = ["Fantasy", "Sci-fi", "Lãng mạn", "Trinh thám", "Kinh dị", "Phiêu lưu", "Đời thường", "Hài hước", "Cổ tích"] as const
const AUDIENCES = ["Trẻ em", "Teen", "Người lớn"] as const
const TONES = ["Vui", "Bí ẩn", "Cảm động", "Hồi hộp", "Dí dỏm"] as const
const LENGTHS = ["Ngắn (500 từ)", "Vừa (1500 từ)", "Dài (3000+ từ, nhiều chương)"] as const
const POVS = ["Ngôi 1", "Ngôi 3", "Đan xen"] as const

type StoryAction = "write" | "outline" | "characters" | "world" | "continue"
type Tab = "create" | "saved"
type SavedStory = { id: string; title: string; content: string; createdAt: string }

const ACTION_LABELS: Record<StoryAction, string> = {
  write: "📖 Viết câu chuyện",
  outline: "📝 Lập dàn ý",
  characters: "👥 Tạo nhân vật",
  world: "🌍 Xây dựng world",
  continue: "🎯 Tiếp tục",
}

export default function StoryPage() {
  const [tab, setTab] = useState<Tab>("create")
  const [prompt, setPrompt] = useState("")
  const [genre, setGenre] = useState<(typeof GENRES)[number]>("Fantasy")
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]>("Teen")
  const [tone, setTone] = useState<(typeof TONES)[number]>("Bí ẩn")
  const [length, setLength] = useState<(typeof LENGTHS)[number]>("Vừa (1500 từ)")
  const [pov, setPov] = useState<(typeof POVS)[number]>("Ngôi 3")
  const [output, setOutput] = useState("")
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [savedStories, setSavedStories] = useState<SavedStory[]>([])
  const [savedNotice, setSavedNotice] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = loadingLabel !== null
  const canRun = useMemo(() => prompt.trim().length > 0 && !isLoading, [prompt, isLoading])
  const canContinue = useMemo(() => output.trim().length > 0 && !isLoading, [output, isLoading])

  useEffect(() => {
    setSavedStories(loadSavedStories())
  }, [])

  function baseContext() {
    return `Ý tưởng: ${prompt.trim()}\nThể loại: ${genre}\nĐộc giả: ${audience}\nTone: ${tone}\nĐộ dài: ${length}\nGóc nhìn: ${pov}`
  }

  function buildPrompt(action: StoryAction) {
    const context = baseContext()
    if (action === "write") {
      return `Viết một câu chuyện hoàn chỉnh bằng tiếng Việt theo thông tin sau. Dùng markdown khi cần chia chương/cảnh, văn phong giàu hình ảnh, phù hợp độc giả.\n\n${context}`
    }
    if (action === "outline") {
      return `Lập dàn ý câu chuyện bằng tiếng Việt: chia chương/cảnh, plot points chính, cao trào, twist nếu phù hợp và kết thúc đề xuất.\n\n${context}`
    }
    if (action === "characters") {
      return `Tạo character sheets bằng tiếng Việt cho các nhân vật chính/phụ. Mỗi nhân vật gồm: name, age, background, personality, motivation, arc, mối quan hệ.\n\n${context}`
    }
    if (action === "world") {
      return `Xây dựng world-building details bằng tiếng Việt: bối cảnh, luật lệ thế giới, lịch sử, địa điểm quan trọng, văn hoá, xung đột, chi tiết cảm giác/âm thanh/mùi vị.\n\n${context}`
    }
    return "Tiếp tục câu chuyện từ đoạn trước, giữ đúng giọng văn, nhân vật và mạch truyện. Không lặp lại phần đã viết; bắt đầu ngay từ đoạn tiếp theo."
  }

  async function runAction(action: StoryAction) {
    if ((action === "continue" && !canContinue) || (action !== "continue" && !canRun)) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoadingLabel(ACTION_LABELS[action])
    if (action !== "continue") setOutput("")
    setError(null)

    try {
      const messages =
        action === "continue"
          ? [
              { role: "user", content: `Hãy viết câu chuyện theo cấu hình sau:\n\n${baseContext()}` },
              { role: "assistant", content: output },
              { role: "user", content: buildPrompt(action) },
            ]
          : [{ role: "user", content: buildPrompt(action) }]

      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          enabledTools: [],
          messages,
          personaSystemPrompt:
            "Bạn là nhà văn AI tiếng Việt cho Tan. Viết tự nhiên, giàu hình ảnh, có cấu trúc markdown đẹp, tránh giải thích ngoài yêu cầu.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      if (action === "continue") setOutput((current) => `${current.trimEnd()}\n\n`)
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
    setPrompt("")
    setOutput("")
    setError(null)
  }

  function saveStory() {
    const content = output.trim()
    if (!content) return
    const story: SavedStory = {
      id: `${Date.now()}`,
      title: prompt.trim() || content.split("\n").find(Boolean)?.replace(/^#+\s*/, "").slice(0, 80) || "Câu chuyện chưa đặt tên",
      content,
      createdAt: new Date().toISOString(),
    }
    const next = [story, ...savedStories].slice(0, 50)
    setSavedStories(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setSavedNotice(true)
    window.setTimeout(() => setSavedNotice(false), 1500)
  }

  function deleteStory(id: string) {
    const next = savedStories.filter((story) => story.id !== id)
    setSavedStories(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">AI Story Studio</p>
              <h1 className="text-2xl font-semibold tracking-tight">Viết truyện tiếng Việt</h1>
              <p className="mt-1 text-sm text-muted-foreground">Tạo truyện, dàn ý, nhân vật, world-building và lưu bản nháp trên trình duyệt.</p>
            </div>
            <div className="flex rounded-lg border bg-background p-1">
              <Button type="button" variant={tab === "create" ? "default" : "ghost"} onClick={() => setTab("create")}>
                Sáng tác
              </Button>
              <Button type="button" variant={tab === "saved" ? "default" : "ghost"} onClick={() => setTab("saved")}>
                Đã lưu ({savedStories.length})
              </Button>
            </div>
          </div>
        </header>

        {tab === "create" ? (
          <>
            <section className="rounded-xl border bg-card p-5 shadow-sm">
              <label htmlFor="story-prompt" className="text-sm font-medium">
                Ý tưởng câu chuyện
              </label>
              <input
                id="story-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="mt-2 w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                placeholder="Ví dụ: Câu chuyện về một con mèo lạc vào thư viện cổ"
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <SelectField label="Thể loại" value={genre} onChange={(value) => setGenre(value as typeof genre)} options={GENRES} />
                <SelectField label="Độc giả" value={audience} onChange={(value) => setAudience(value as typeof audience)} options={AUDIENCES} />
                <SelectField label="Tone" value={tone} onChange={(value) => setTone(value as typeof tone)} options={TONES} />
                <SelectField label="Độ dài" value={length} onChange={(value) => setLength(value as typeof length)} options={LENGTHS} />
                <SelectField label="Góc nhìn" value={pov} onChange={(value) => setPov(value as typeof pov)} options={POVS} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {(["write", "outline", "characters", "world"] as StoryAction[]).map((action) => (
                  <Button key={action} type="button" variant="secondary" onClick={() => runAction(action)} disabled={!canRun}>
                    {ACTION_LABELS[action]}
                  </Button>
                ))}
                <Button type="button" variant="secondary" onClick={() => runAction("continue")} disabled={!canContinue}>
                  {ACTION_LABELS.continue}
                </Button>
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
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-medium">Bản thảo</h2>
                  <p className="text-xs text-muted-foreground">Render markdown dạng prose, phù hợp để đọc truyện.</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={saveStory} disabled={!output}>
                    {savedNotice ? "Đã lưu" : "Lưu câu chuyện"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={copyOutput} disabled={!output}>
                    {copied ? "Đã sao chép" : "Copy"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={clearAll} disabled={isLoading || (!prompt && !output)}>
                    Clear
                  </Button>
                </div>
              </div>

              <StoryMarkdown output={output} isLoading={isLoading} />
            </section>
          </>
        ) : (
          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight">Truyện đã lưu</h2>
            <p className="mt-1 text-sm text-muted-foreground">Lưu trong localStorage key <code>{STORAGE_KEY}</code>.</p>
            <div className="mt-4 grid gap-4">
              {savedStories.length === 0 && <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">Chưa có truyện đã lưu.</div>}
              {savedStories.map((story) => (
                <article key={story.id} className="rounded-lg border bg-background p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{story.title}</h3>
                      <p className="text-xs text-muted-foreground">{new Date(story.createdAt).toLocaleString("vi-VN")}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(story.content)}>
                        Copy
                      </Button>
                      <Button type="button" variant="destructive" onClick={() => deleteStory(story.id)}>
                        Xoá
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[28rem] overflow-auto rounded-lg border bg-card p-4">
                    <div className="mx-auto max-w-prose text-base leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{story.content}</ReactMarkdown>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
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
  options: readonly string[]
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
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function StoryMarkdown({ output, isLoading }: { output: string; isLoading: boolean }) {
  return (
    <div className="min-h-[26rem] rounded-lg border bg-background p-4">
      <div className="mx-auto max-w-prose text-base leading-relaxed">
        {output ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown> : <span className="text-muted-foreground">Chưa có bản thảo.</span>}
        {isLoading && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
      </div>
    </div>
  )
}

function loadSavedStories(): SavedStory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
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

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"
const STORAGE_KEY = "tans-agents:flashcard-decks-v1"

const CARD_COUNTS = [5, 10, 15, 20] as const
const LANGUAGES = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
] as const
const DIFFICULTIES = ["Cơ bản", "Trung bình", "Khó"] as const

type Flashcard = { q: string; a: string }
type Deck = { id: string; name: string; createdAt: string; cards: Flashcard[] }
type StudyMark = "known" | "unknown"

export default function FlashcardsPage() {
  const [input, setInput] = useState("")
  const [count, setCount] = useState<(typeof CARD_COUNTS)[number]>(10)
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]["value"]>("vi")
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("Trung bình")
  const [cards, setCards] = useState<Flashcard[]>([])
  const [decks, setDecks] = useState<Deck[]>([])
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null)
  const [flipped, setFlipped] = useState<Record<number, boolean>>({})
  const [studyOpen, setStudyOpen] = useState(false)
  const [studyIndex, setStudyIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [marks, setMarks] = useState<Record<number, StudyMark>>({})
  const [streamText, setStreamText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setDecks(readDecks())
  }, [])

  const canGenerate = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading])
  const deckName = useMemo(() => {
    const firstLine = input.trim().split("\n")[0]?.trim()
    return firstLine ? firstLine.slice(0, 60) : "Bộ flashcards mới"
  }, [input])

  async function generateFlashcards() {
    const text = input.trim()
    if (!text || isLoading) return

    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
    setError(null)
    setCards([])
    setFlipped({})
    setMarks({})
    setStreamText("")
    setActiveDeckId(null)

    const langLabel = language === "vi" ? "tiếng Việt" : "tiếng Anh"
    const personaSystemPrompt = `Tạo CHÍNH XÁC ${count} flashcards Q&A từ nội dung sau ở mức độ ${difficulty} bằng ${langLabel}. CHỈ trả về một mảng JSON hợp lệ dạng [{\"q\":\"...\",\"a\":\"...\"}], không kèm chú thích.`
    let streamed = ""

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          enabledTools: [],
          messages: [{ role: "user", content: text }],
          personaSystemPrompt,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => {
        streamed += chunk
        setStreamText(streamed)
      })

      const parsed = parseFlashcards(streamed)
      if (parsed.length === 0) throw new Error("AI không trả về flashcard hợp lệ.")
      setCards(parsed.slice(0, count))
      setStudyIndex(0)
      setShowAnswer(false)
    } catch (err: any) {
      if (err?.name === "AbortError") setError("Đã huỷ yêu cầu.")
      else setError(err?.message ?? "Có lỗi khi tạo flashcards.")
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsLoading(false)
    }
  }

  function abortRun() {
    abortRef.current?.abort()
  }

  function loadDeck(deck: Deck) {
    setActiveDeckId(deck.id)
    setCards(deck.cards)
    setInput(deck.name)
    setFlipped({})
    setMarks({})
    setStudyIndex(0)
    setShowAnswer(false)
    setError(null)
  }

  function saveDeck() {
    if (cards.length === 0) return
    const deck: Deck = {
      id: crypto.randomUUID(),
      name: deckName,
      createdAt: new Date().toISOString(),
      cards,
    }
    const next = [deck, ...decks]
    persistDecks(next)
    setDecks(next)
    setActiveDeckId(deck.id)
  }

  function exportDeck() {
    if (cards.length === 0) return
    const payload = JSON.stringify(
      { id: activeDeckId ?? crypto.randomUUID(), name: deckName, createdAt: new Date().toISOString(), cards },
      null,
      2
    )
    const blob = new Blob([payload], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${slugify(deckName)}-flashcards.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function markCurrent(mark: StudyMark) {
    setMarks((current) => ({ ...current, [studyIndex]: mark }))
  }

  const currentStudyCard = cards[studyIndex]
  const knownCount = Object.values(marks).filter((mark) => mark === "known").length
  const unknownCount = Object.values(marks).filter((mark) => mark === "unknown").length

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-7xl gap-4 p-4 md:grid-cols-[280px_1fr] md:p-8">
        <aside className="rounded-lg border bg-card p-4 shadow-sm md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:overflow-auto">
          <div className="mb-4">
            <p className="text-sm font-medium text-muted-foreground">Flashcards AI</p>
            <h2 className="text-xl font-semibold tracking-tight">Bộ đã lưu</h2>
          </div>
          <div className="space-y-2">
            {decks.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Chưa có bộ flashcard nào.</p>
            ) : (
              decks.map((deck) => (
                <button
                  key={deck.id}
                  type="button"
                  onClick={() => loadDeck(deck)}
                  className={`w-full rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted ${
                    activeDeckId === deck.id ? "border-primary bg-primary/10" : "bg-background"
                  }`}
                >
                  <span className="line-clamp-2 font-medium">{deck.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {deck.cards.length} thẻ • {new Date(deck.createdAt).toLocaleDateString("vi-VN")}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <CardTitle>Tạo flashcards bằng AI</CardTitle>
                  <CardDescription>Dán nội dung học hoặc nhập tên chủ đề, AI sẽ tạo bộ Q&A để ôn tập.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={saveDeck} disabled={cards.length === 0}>
                    Lưu bộ thẻ
                  </Button>
                  <Button type="button" variant="secondary" onClick={exportDeck} disabled={cards.length === 0}>
                    Xuất JSON
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Nội dung hoặc chủ đề</span>
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  className="min-h-[14rem] resize-y text-sm leading-relaxed"
                  placeholder="Ví dụ: React hooks, lịch sử Việt Nam, từ vựng IELTS chủ đề Environment..."
                />
              </label>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-2 text-sm font-medium">
                  Số lượng thẻ
                  <select
                    value={count}
                    onChange={(event) => setCount(Number(event.target.value) as (typeof CARD_COUNTS)[number])}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {CARD_COUNTS.map((item) => (
                      <option key={item} value={item}>
                        {item} thẻ
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Ngôn ngữ
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as (typeof LANGUAGES)[number]["value"])}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {LANGUAGES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium">
                  Độ khó
                  <select
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value as (typeof DIFFICULTIES)[number])}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {DIFFICULTIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={generateFlashcards} disabled={!canGenerate}>
                  {isLoading ? "Đang tạo..." : "Tạo flashcards"}
                </Button>
                {isLoading && (
                  <Button type="button" variant="destructive" onClick={abortRun}>
                    Dừng
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={() => setStudyOpen(true)} disabled={cards.length === 0}>
                  Học flashcard
                </Button>
                <span className="text-sm text-muted-foreground">
                  {cards.length > 0 ? `${cards.length} thẻ sẵn sàng` : "Chưa có thẻ"}
                </span>
              </div>

              {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              {isLoading && (
                <pre className="max-h-44 overflow-auto rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                  {streamText || "Đang nhận dữ liệu từ AI..."}
                </pre>
              )}
            </CardContent>
          </Card>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.length === 0 ? (
              <Card className="sm:col-span-2 xl:col-span-3">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Flashcards sẽ xuất hiện ở đây. Nhấn vào từng thẻ để lật đáp án.
                </CardContent>
              </Card>
            ) : (
              cards.map((card, index) => (
                <button
                  key={`${card.q}-${index}`}
                  type="button"
                  onClick={() => setFlipped((current) => ({ ...current, [index]: !current[index] }))}
                  className="group h-56 text-left [perspective:1000px]"
                  aria-label={`Lật thẻ ${index + 1}`}
                >
                  <div
                    className={`relative h-full w-full rounded-xl transition-transform duration-500 [transform-style:preserve-3d] ${
                      flipped[index] ? "[transform:rotateY(180deg)]" : ""
                    }`}
                  >
                    <FlashcardFace label={`Câu hỏi ${index + 1}`} text={card.q} tone="front" />
                    <FlashcardFace label="Đáp án" text={card.a} tone="back" />
                  </div>
                </button>
              ))
            )}
          </section>
        </div>
      </div>

      {studyOpen && currentStudyCard && (
        <div className="fixed inset-0 z-50 flex bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl flex-col justify-center gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  Thẻ {studyIndex + 1}/{cards.length} • Đã biết {knownCount} • Chưa biết {unknownCount}
                </p>
                <h2 className="text-2xl font-semibold">Chế độ học flashcard</h2>
              </div>
              <Button type="button" variant="secondary" onClick={() => setStudyOpen(false)}>
                Thoát
              </Button>
            </div>

            <Card className="min-h-[22rem]">
              <CardHeader>
                <CardDescription>{showAnswer ? "Đáp án" : "Câu hỏi"}</CardDescription>
                <CardTitle className="text-2xl leading-snug">{showAnswer ? currentStudyCard.a : currentStudyCard.q}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => setShowAnswer((current) => !current)}>
                  {showAnswer ? "Ẩn đáp án" : "Hiện đáp án"}
                </Button>
                <Button type="button" variant={marks[studyIndex] === "known" ? "default" : "secondary"} onClick={() => markCurrent("known")}>
                  Đã biết
                </Button>
                <Button type="button" variant={marks[studyIndex] === "unknown" ? "destructive" : "secondary"} onClick={() => markCurrent("unknown")}>
                  Chưa biết
                </Button>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setStudyIndex((current) => Math.max(0, current - 1))
                  setShowAnswer(false)
                }}
                disabled={studyIndex === 0}
              >
                Trước
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setStudyIndex((current) => Math.min(cards.length - 1, current + 1))
                  setShowAnswer(false)
                }}
                disabled={studyIndex === cards.length - 1}
              >
                Tiếp
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function FlashcardFace({ label, text, tone }: { label: string; text: string; tone: "front" | "back" }) {
  return (
    <div
      className={`absolute inset-0 flex h-full w-full flex-col rounded-xl border p-5 shadow-sm [backface-visibility:hidden] ${
        tone === "back" ? "bg-primary text-primary-foreground [transform:rotateY(180deg)]" : "bg-card text-card-foreground"
      }`}
    >
      <span className={`text-xs font-medium uppercase tracking-wide ${tone === "back" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
        {label}
      </span>
      <p className="mt-4 line-clamp-6 text-base font-medium leading-relaxed">{text}</p>
      <span className={`mt-auto text-xs ${tone === "back" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>Nhấn để lật</span>
    </div>
  )
}

function readDecks(): Deck[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isDeck) : []
  } catch {
    return []
  }
}

function persistDecks(decks: Deck[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decks))
}

function isDeck(value: any): value is Deck {
  return (
    value &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "string" &&
    Array.isArray(value.cards)
  )
}

function parseFlashcards(text: string): Flashcard[] {
  const compact = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()
  const start = compact.indexOf("[")
  const end = compact.lastIndexOf("]")
  if (start === -1 || end === -1 || end <= start) throw new Error("Không tìm thấy mảng JSON trong phản hồi AI.")

  const parsed = JSON.parse(compact.slice(start, end + 1))
  if (!Array.isArray(parsed)) throw new Error("JSON không phải là mảng flashcards.")

  return parsed
    .map((item) => ({ q: String(item?.q ?? "").trim(), a: String(item?.a ?? "").trim() }))
    .filter((item) => item.q && item.a)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "flashcards"
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

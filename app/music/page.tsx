"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const MOODS = ["Vui vẻ", "Buồn", "Tập trung", "Năng lượng cao", "Thư giãn", "Lãng mạn", "Hoài niệm", "Tự tin", "Mộng mơ", "Tức giận"]
const GENRES = ["Pop", "Rock", "Indie", "Electronic", "Jazz", "Classical", "Hip-hop", "R&B", "Lo-fi", "V-pop", "K-pop", "J-pop", "Anime OST", "Soundtrack"]
const ACTIVITIES = ["Học", "Làm việc", "Tập gym", "Ngủ", "Lái xe", "Tiệc", "Yoga", "Thiền"]
const ERAS = ["Bất kỳ", "2020s", "2010s", "2000s", "90s", "80s", "Trước 80s"]
const LANGUAGES = ["Bất kỳ", "VN", "EN", "JP", "KR", "Nhạc không lời"]
const SONG_COUNTS = [5, 10, 20] as const

type Track = {
  index: string
  title: string
  artist: string
  year: string
  reason: string
}

export default function MusicPlaylistPage() {
  const [moods, setMoods] = useState<string[]>([])
  const [genres, setGenres] = useState<string[]>([])
  const [activity, setActivity] = useState(ACTIVITIES[0])
  const [era, setEra] = useState(ERAS[0])
  const [language, setLanguage] = useState(LANGUAGES[0])
  const [songCount, setSongCount] = useState<(typeof SONG_COUNTS)[number]>(10)
  const [output, setOutput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const tracks = useMemo(() => parseMarkdownTable(output), [output])
  const exportText = useMemo(() => formatTrackList(tracks, output), [tracks, output])

  function toggleValue(value: string, selected: string[], setter: (next: string[]) => void) {
    setter(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
  }

  async function generatePlaylist() {
    if (isLoading) return

    const moodText = moods.length ? moods.join(", ") : "bất kỳ"
    const genreText = genres.length ? genres.join(", ") : "bất kỳ"
    const prompt = `Đề xuất CHÍNH XÁC ${songCount} bài hát phù hợp với tâm trạng ${moodText}, thể loại ${genreText}, hoạt động ${activity}, thời kỳ ${era}, ngôn ngữ ${language}. CHỈ trả về dạng bảng markdown với cột: # | Tên bài | Nghệ sĩ | Năm | Tại sao phù hợp.`

    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
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
          personaSystemPrompt:
            "Bạn là chuyên gia gợi ý âm nhạc cho người Việt. Luôn tuân thủ chính xác số lượng bài hát và chỉ trả về bảng markdown khi được yêu cầu.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => {
        setOutput((current) => current + chunk)
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Có lỗi khi gọi AI."
      setError(message === "AbortError" ? "Đã huỷ yêu cầu." : message)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsLoading(false)
    }
  }

  async function copyList() {
    if (!exportText) return
    await navigator.clipboard.writeText(exportText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function exportAsText() {
    if (!exportText) return
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "playlist-goi-y.txt"
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">AI Music Finder</p>
          <h1 className="text-2xl font-semibold tracking-tight">🎵 Gợi ý playlist theo tâm trạng</h1>
          <p className="mt-1 text-sm text-muted-foreground">Chọn mood, gu nhạc và ngữ cảnh để AI đề xuất danh sách bài hát phù hợp.</p>
        </header>

        <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm">
          <ChipGroup label="Tâm trạng" values={MOODS} selected={moods} onToggle={(value) => toggleValue(value, moods, setMoods)} />
          <ChipGroup label="Thể loại" values={GENRES} selected={genres} onToggle={(value) => toggleValue(value, genres, setGenres)} />

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SelectField label="Hoạt động" value={activity} values={ACTIVITIES} onChange={setActivity} />
            <SelectField label="Thời kỳ" value={era} values={ERAS} onChange={setEra} />
            <SelectField label="Ngôn ngữ ưu tiên" value={language} values={LANGUAGES} onChange={setLanguage} />
            <SelectField label="Số bài hát" value={String(songCount)} values={SONG_COUNTS.map(String)} onChange={(value) => setSongCount(Number(value) as (typeof SONG_COUNTS)[number])} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={generatePlaylist} disabled={isLoading}>
              {isLoading ? "Đang gợi ý..." : "🎵 Gợi ý playlist"}
            </Button>
            {isLoading && (
              <Button type="button" variant="destructive" onClick={() => abortRef.current?.abort()}>
                Dừng
              </Button>
            )}
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Kết quả playlist</h2>
              <p className="text-sm text-muted-foreground">Sau khi AI trả lời, bảng markdown sẽ được chuyển thành card kèm link tìm kiếm.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={copyList} disabled={!exportText}>
                {copied ? "Đã sao chép" : "Copy whole list"}
              </Button>
              <Button type="button" variant="secondary" onClick={exportAsText} disabled={!exportText}>
                Export as text
              </Button>
            </div>
          </div>

          {tracks.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {tracks.map((track) => {
                const query = encodeURIComponent(`${track.artist} ${track.title}`)
                return (
                  <article key={`${track.index}-${track.artist}-${track.title}`} className="rounded-lg border bg-background p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                        {track.index}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold leading-tight">{track.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {track.artist} • {track.year}
                        </p>
                        <p className="mt-3 text-sm leading-relaxed">{track.reason}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <a className="rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted" href={`https://open.spotify.com/search/${query}`} target="_blank" rel="noreferrer">
                            🔍 Tìm trên Spotify
                          </a>
                          <a className="rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted" href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noreferrer">
                            📺 Tìm trên YouTube
                          </a>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="min-h-[14rem] whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-relaxed">
              {output || <span className="text-muted-foreground">Chưa có playlist. Hãy chọn tiêu chí và bấm gợi ý.</span>}
              {isLoading && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function ChipGroup({ label, values, selected, onToggle }: { label: string; values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => {
          const active = selected.includes(value)
          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(value)}
              className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
              }`}
            >
              {value}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SelectField({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20">
        {values.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  )
}

function parseMarkdownTable(markdown: string): Track[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("|") && !/^\|?\s*:?-{3,}/.test(line))
    .map((line) => line.replace(/^\|/, "").replace(/\|$/, ""))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 5 && cells[0] !== "#" && !/tên bài/i.test(cells[1] ?? ""))
    .map((cells) => ({
      index: cells[0],
      title: cleanMarkdown(cells[1]),
      artist: cleanMarkdown(cells[2]),
      year: cleanMarkdown(cells[3]),
      reason: cleanMarkdown(cells.slice(4).join(" | ")),
    }))
    .filter((track) => track.title && track.artist)
}

function cleanMarkdown(text: string) {
  return text.replace(/\*\*/g, "").replace(/`/g, "").trim()
}

function formatTrackList(tracks: Track[], fallback: string) {
  if (!tracks.length) return fallback.trim()
  return tracks.map((track) => `${track.index}. ${track.title} — ${track.artist} (${track.year})\n   ${track.reason}`).join("\n")
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

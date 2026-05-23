"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Heart } from "lucide-react"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const MOODS = ["Happy", "Sad", "Energetic", "Chill", "Focus"]
const GENRES = ["Pop", "Rock", "Hip-Hop", "Jazz", "Classical", "Electronic"]

type Song = {
  id: string
  title: string
  artist: string
  duration: string
  mood: string
  genre: string
}

const MOCK_SONGS: Song[] = [
  { id: "1", title: "Blinding Lights", artist: "The Weeknd", duration: "3:20", mood: "Energetic", genre: "Electronic" },
  { id: "2", title: "Good as Hell", artist: "Lizzo", duration: "2:58", mood: "Happy", genre: "Pop" },
  { id: "3", title: "Someone Like You", artist: "Adele", duration: "3:45", mood: "Sad", genre: "Pop" },
  { id: "4", title: "Chill Vibes", artist: "Lo-fi Beats", duration: "2:45", mood: "Chill", genre: "Electronic" },
  { id: "5", title: "Focus Mode", artist: "Deep Work", duration: "4:12", mood: "Focus", genre: "Classical" },
  { id: "6", title: "Bohemian Rhapsody", artist: "Queen", duration: "5:55", mood: "Happy", genre: "Rock" },
  { id: "7", title: "Lose Yourself", artist: "Eminem", duration: "5:26", mood: "Energetic", genre: "Hip-Hop" },
  { id: "8", title: "Midnight City", artist: "M83", duration: "4:09", mood: "Chill", genre: "Electronic" },
  { id: "9", title: "All Blues", artist: "Miles Davis", duration: "5:31", mood: "Chill", genre: "Jazz" },
  { id: "10", title: "Moonlight Sonata", artist: "Ludwig van Beethoven", duration: "4:43", mood: "Sad", genre: "Classical" },
  { id: "11", title: "Uptown Funk", artist: "Mark Ronson ft. Bruno Mars", duration: "4:30", mood: "Energetic", genre: "Pop" },
  { id: "12", title: "Giò Khách", artist: "Khoảng Vắng", duration: "3:15", mood: "Sad", genre: "Rock" },
  { id: "13", title: "Sunset Dreams", artist: "Chill Cats", duration: "3:08", mood: "Chill", genre: "Electronic" },
  { id: "14", title: "Productivity Beat", artist: "Study Time", duration: "4:00", mood: "Focus", genre: "Electronic" },
  { id: "15", title: "Happy", artist: "Pharrell Williams", duration: "3:54", mood: "Happy", genre: "Pop" },
  { id: "16", title: "Jazz in the City", artist: "New Jazz Quartet", duration: "4:21", mood: "Focus", genre: "Jazz" },
  { id: "17", title: "Electric Dreams", artist: "Synthwave", duration: "3:47", mood: "Energetic", genre: "Electronic" },
  { id: "18", title: "Rain & Reflection", artist: "Ambient Sounds", duration: "5:12", mood: "Sad", genre: "Classical" },
  { id: "19", title: "Rap God", artist: "Eminem", duration: "6:04", mood: "Energetic", genre: "Hip-Hop" },
  { id: "20", title: "Starlight", artist: "Muse", duration: "4:33", mood: "Happy", genre: "Rock" },
]

export default function PlaylistPage() {
  const [selectedMood, setSelectedMood] = useState<string>("")
  const [selectedGenre, setSelectedGenre] = useState<string>("")
  const [playlist, setPlaylist] = useState<Song[]>([])
  const [djCommentary, setDjCommentary] = useState("")
  const [isLoadingDJ, setIsLoadingDJ] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem("tans-agents:fav-playlists-v1")
    if (saved) {
      try {
        setFavorites(JSON.parse(saved))
      } catch (e) {
        console.error("Failed to load favorites:", e)
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("tans-agents:fav-playlists-v1", JSON.stringify(favorites))
  }, [favorites])

  function generatePlaylist() {
    if (!selectedMood || !selectedGenre) {
      setError("Please select both a mood and genre")
      return
    }
    setError(null)

    const filtered = MOCK_SONGS.filter(
      (song) => song.mood === selectedMood && song.genre === selectedGenre
    )

    if (filtered.length === 0) {
      const moodFiltered = MOCK_SONGS.filter((song) => song.mood === selectedMood)
      setPlaylist(moodFiltered.slice(0, 20))
    } else {
      setPlaylist(filtered.length > 20 ? filtered.slice(0, 20) : filtered)
    }
    setDjCommentary("")
  }

  async function generateDJCommentary() {
    if (!playlist.length) return

    const songList = playlist.map((s) => `${s.title} by ${s.artist}`).join(", ")
    const prompt = `You are an enthusiastic DJ. Create a fun and engaging 2-3 sentence commentary about this playlist: ${songList}. Focus on the vibe, mood, and what makes it special.`

    const controller = new AbortController()
    abortRef.current = controller
    setIsLoadingDJ(true)
    setDjCommentary("")
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
            "You are an enthusiastic and witty DJ who loves music. You create engaging commentary about playlists that captures their essence and gets people excited to listen.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("No stream received from server")

      await readSseStream(response.body, (chunk) => {
        setDjCommentary((current) => current + chunk)
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error generating DJ commentary"
      setError(message === "AbortError" ? "DJ commentary cancelled" : message)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsLoadingDJ(false)
    }
  }

  function toggleFavorite(playlistId: string) {
    setFavorites((prev) =>
      prev.includes(playlistId)
        ? prev.filter((id) => id !== playlistId)
        : [...prev, playlistId]
    )
  }

  const currentPlaylistId = `${selectedMood}-${selectedGenre}`
  const isFavorited = favorites.includes(currentPlaylistId)

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">🎵 Music Generator</p>
          <h1 className="text-2xl font-semibold tracking-tight">Playlist Suggester with AI DJ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select your mood and favorite genre to get a curated playlist with AI DJ commentary.
          </p>
        </header>

        <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm">
          <div>
            <p className="mb-3 text-sm font-medium">Mood</p>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((mood) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => setSelectedMood(mood)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    selectedMood === mood
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium">Genre</p>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setSelectedGenre(genre)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    selectedGenre === genre
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={generatePlaylist}>
              Generate Playlist
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </section>

        {playlist.length > 0 && (
          <>
            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {selectedMood} {selectedGenre} Playlist
                  </h2>
                  <p className="text-sm text-muted-foreground">{playlist.length} songs</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavorite(currentPlaylistId)}
                  className="rounded-lg border p-2 transition-colors hover:bg-muted"
                  title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                >
                  <Heart
                    size={20}
                    className={isFavorited ? "fill-red-500 text-red-500" : "text-muted-foreground"}
                  />
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {playlist.map((song, idx) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-3 rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors"
                  >
                    <button
                      type="button"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      title="Play song"
                    >
                      ▶
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{song.title}</p>
                      <p className="text-xs text-muted-foreground">{song.artist}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{song.duration}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">🎙️ DJ Notes</h2>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={generateDJCommentary}
                  disabled={isLoadingDJ}
                >
                  {isLoadingDJ ? "Generating..." : "Generate DJ Commentary"}
                </Button>
              </div>

              <div className="min-h-[6rem] rounded-lg border bg-background p-4">
                {djCommentary ? (
                  <p className="text-sm leading-relaxed">{djCommentary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click "Generate DJ Commentary" to get AI-generated commentary about this playlist.
                  </p>
                )}
                {isLoadingDJ && (
                  <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />
                )}
              </div>
            </section>
          </>
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

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

const LYRICS_DB = [
  {
    id: 1,
    title: "Starlight",
    artist: "Luna Sky",
    lyrics: `Verse 1:\nWalking through the night\nStars are shining bright\nHearts beating in the moonlight\nEverything feels right\n\nChorus:\nUnderneath the starlight\nWe can reach so high\nDreams are burning bright tonight\nReaching for the sky`,
  },
  {
    id: 2,
    title: "Rise Up",
    artist: "Phoenix Rising",
    lyrics: `Verse 1:\nFell down to the ground\nThought I'd never rise\nBut I found the strength\nDeep inside\n\nChorus:\nRise up, reach for the sun\nBroken wings will fly again\nStand tall, never give up\nBattle scars will fade`,
  },
]

export default function LyricsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLyrics, setSelectedLyrics] = useState<typeof LYRICS_DB[0] | null>(null)
  const [analysis, setAnalysis] = useState("")
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [favorites, setFavorites] = useState<number[]>([])

  function search() {
    const found = LYRICS_DB.find(
      (l) =>
        l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.artist.toLowerCase().includes(searchQuery.toLowerCase())
    )
    if (found) setSelectedLyrics(found)
  }

  async function analyzeLyrics() {
    if (!selectedLyrics) return
    setLoadingAnalysis(true)
    setAnalysis("")

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "groq",
          model: "llama-3.1-8b-instant",
          enabledTools: [],
          messages: [
            {
              role: "user",
              content: `Analyze these song lyrics and explain the meaning, themes, and emotions:\n\n"${selectedLyrics.title}" by ${selectedLyrics.artist}\n\n${selectedLyrics.lyrics}`,
            },
          ],
        }),
      })

      if (!response.ok || !response.body) return
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          if (line.startsWith("data:")) {
            const data = line.slice(5).trim()
            if (data === "[DONE]") return
            if (data) setAnalysis((curr) => curr + data)
          }
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAnalysis(false)
    }
  }

  function toggleFavorite() {
    if (!selectedLyrics) return
    setFavorites((curr) =>
      curr.includes(selectedLyrics.id)
        ? curr.filter((id) => id !== selectedLyrics.id)
        : [...curr, selectedLyrics.id]
    )
  }

  function copyLyrics() {
    if (selectedLyrics) navigator.clipboard.writeText(selectedLyrics.lyrics)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-3xl font-bold text-slate-900">🎵 Lyrics Explorer</h1>

          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Search by song or artist..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <Button onClick={search} className="bg-pink-600 hover:bg-pink-700">
              🔍
            </Button>
          </div>

          {selectedLyrics && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h2 className="font-bold text-slate-900">{selectedLyrics.title}</h2>
                    <p className="text-sm text-slate-600">{selectedLyrics.artist}</p>
                  </div>
                  <button
                    onClick={toggleFavorite}
                    className="text-2xl transition"
                  >
                    {favorites.includes(selectedLyrics.id) ? "❤️" : "🤍"}
                  </button>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-wrap max-h-80 overflow-auto">
                  {selectedLyrics.lyrics}
                </p>
                <Button onClick={copyLyrics} className="w-full mt-3 bg-slate-600 hover:bg-slate-700">
                  📋 Copy
                </Button>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={analyzeLyrics}
                  disabled={loadingAnalysis}
                  className="w-full bg-pink-600 hover:bg-pink-700"
                >
                  {loadingAnalysis ? "✨ Analyzing..." : "✨ AI Analysis"}
                </Button>

                {analysis && (
                  <div className="bg-pink-50 border border-pink-200 rounded p-4 max-h-80 overflow-auto">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{analysis}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!selectedLyrics && (
            <div className="text-center py-8 text-slate-500">
              Search for a song to see lyrics
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

type MoodType = "😢" | "😕" | "😐" | "🙂" | "😄"

interface MoodEntry {
  id: string
  date: string
  mood: MoodType
  intensity: number
  notes: string
}

const STORAGE_KEY = "tans-agents:mood-entries-v1"
const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const MOOD_COLORS: Record<MoodType, { bg: string; text: string; border: string }> = {
  "😢": { bg: "bg-red-100 dark:bg-red-900", text: "text-red-700 dark:text-red-200", border: "border-red-300 dark:border-red-700" },
  "😕": { bg: "bg-orange-100 dark:bg-orange-900", text: "text-orange-700 dark:text-orange-200", border: "border-orange-300 dark:border-orange-700" },
  "😐": { bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-700 dark:text-yellow-200", border: "border-yellow-300 dark:border-yellow-700" },
  "🙂": { bg: "bg-lime-100 dark:bg-lime-900", text: "text-lime-700 dark:text-lime-200", border: "border-lime-300 dark:border-lime-700" },
  "😄": { bg: "bg-green-100 dark:bg-green-900", text: "text-green-700 dark:text-green-200", border: "border-green-300 dark:border-green-700" },
}

export default function MoodPage() {
  const [entries, setEntries] = useState<MoodEntry[]>([])
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [mood, setMood] = useState<MoodType>("😐")
  const [intensity, setIntensity] = useState(5)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [aiResponse, setAiResponse] = useState("")
  const [mounted, setMounted] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setEntries(JSON.parse(saved))
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    }
  }, [entries, mounted])

  const addEntry = () => {
    const newEntry: MoodEntry = {
      id: Date.now().toString(),
      date,
      mood,
      intensity,
      notes,
    }

    setEntries([newEntry, ...entries])
    setDate(new Date().toISOString().split("T")[0])
    setMood("😐")
    setIntensity(5)
    setNotes("")
  }

  const deleteEntry = (id: string) => {
    setEntries(entries.filter((e) => e.id !== id))
  }

  async function readSseStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onChunk: (chunk: string) => void
  ): Promise<void> {
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
          if (data) onChunk(data)
        }
      }
    }
  }

  const getReflection = async () => {
    if (entries.length === 0) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setAiResponse("")

    const last3 = entries.slice(0, 3)
    const summary = last3
      .map((e) => `${e.date}: ${e.mood} (intensity: ${e.intensity}/10)${e.notes ? ` - ${e.notes}` : ""}`)
      .join("\n")

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          messages: [
            {
              role: "user",
              content: `I've been tracking my mood lately. Here are my last 3 entries:\n${summary}\n\nPlease reflect on my emotional patterns and provide some thoughtful advice.`,
            },
          ],
        }),
      })

      if (!response.ok) throw new Error(`API error: ${response.statusText}`)
      if (!response.body) throw new Error("No response body")

      const reader = response.body.getReader()
      await readSseStream(reader, (chunk) => {
        setAiResponse((prev) => prev + chunk)
      })
    } catch (error: any) {
      if (error.name !== "AbortError") {
        setAiResponse(`Error: ${error.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  const moodStats = {
    "😢": entries.filter((e) => e.mood === "😢").length,
    "😕": entries.filter((e) => e.mood === "😕").length,
    "😐": entries.filter((e) => e.mood === "😐").length,
    "🙂": entries.filter((e) => e.mood === "🙂").length,
    "😄": entries.filter((e) => e.mood === "😄").length,
  }

  const getMoodColor = (m: MoodType) => {
    if (m === "😢") return "bg-red-500"
    if (m === "😕") return "bg-orange-500"
    if (m === "😐") return "bg-yellow-500"
    if (m === "🙂") return "bg-lime-500"
    return "bg-green-500"
  }

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()

  const calendarDays = Array.from({ length: getDaysInMonth(currentMonth) }).map((_, i) => {
    const day = i + 1
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const entry = entries.find((e) => e.date === dateStr)
    return { day, date: dateStr, entry }
  })

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const maxMood = Math.max(...Object.values(moodStats))
  const moodDistribution = Object.entries(moodStats).map(([m, count]) => ({
    mood: m as MoodType,
    count,
    percentage: maxMood > 0 ? (count / maxMood) * 100 : 0,
  }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">✨ Daily Mood Journal</h1>
          <p className="text-slate-600 dark:text-slate-400">Track your emotions and get AI reflections</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">New Entry</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">How are you feeling?</label>
                <div className="flex gap-2 mt-2">
                  {(["😢", "😕", "😐", "🙂", "😄"] as MoodType[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMood(m)}
                      className={`text-3xl p-2 rounded-lg transition ${
                        mood === m ? "ring-2 ring-offset-2 ring-slate-400" : "opacity-50 hover:opacity-75"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Intensity: {intensity}/10</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={intensity}
                  onChange={(e) => setIntensity(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What's on your mind?" rows={3} />
              </div>

              <Button onClick={addEntry} className="w-full">
                Save Entry
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Mood Distribution</h2>
            <div className="space-y-3">
              {moodDistribution.map(({ mood: m, count, percentage }) => (
                <div key={m}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-lg">{m}</span>
                    <span className="text-slate-600 dark:text-slate-400">{count}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${getMoodColor(m)}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              ))}
              <div className="text-sm text-slate-500 mt-4">Total entries: {entries.length}</div>
            </div>
          </Card>
        </div>

        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button onClick={previousMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                ←
              </button>
              <h2 className="text-lg font-semibold min-w-48">
                {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h2>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center text-sm font-semibold text-slate-600 dark:text-slate-400">
                {day}
              </div>
            ))}

            {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {calendarDays.map(({ day, entry }) => (
              <div
                key={day}
                className={`p-2 rounded-lg text-center text-sm ${
                  entry
                    ? `${MOOD_COLORS[entry.mood].bg} ${MOOD_COLORS[entry.mood].text} cursor-pointer hover:opacity-80`
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                }`}
                title={entry ? `${entry.mood} (${entry.intensity}/10)` : ""}
              >
                <div className="font-medium">{day}</div>
                {entry && <div className="text-xs">{entry.mood}</div>}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">AI Reflection</h2>
            <Button onClick={getReflection} disabled={loading || entries.length === 0} className="gap-2">
              ✨ Reflect
            </Button>
          </div>

          {aiResponse && (
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg text-sm whitespace-pre-wrap">{aiResponse}</div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Entries</h2>
          <div className="space-y-3">
            {entries.length === 0 ? (
              <p className="text-slate-500">No entries yet. Start by adding one!</p>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className={`flex items-start justify-between p-3 rounded-lg border-l-4 ${MOOD_COLORS[entry.mood].bg} ${MOOD_COLORS[entry.mood].border}`}>
                  <div className="flex-1">
                    <div className="font-medium">
                      {entry.mood} {entry.date}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Intensity: {entry.intensity}/10</div>
                    {entry.notes && <div className="text-sm mt-2">{entry.notes}</div>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteEntry(entry.id)}>
                    ✕
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

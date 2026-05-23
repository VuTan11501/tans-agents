"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface Workout {
  id: string
  type: "Running" | "Gym" | "Yoga" | "Other"
  duration: number
  intensity: number
  date: string
  notes: string
}

const STORAGE_KEY = "tans-agents:workouts-v1"
const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

export default function FitnessPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [type, setType] = useState<"Running" | "Gym" | "Yoga" | "Other">("Gym")
  const [duration, setDuration] = useState("")
  const [intensity, setIntensity] = useState(5)
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [aiResponse, setAiResponse] = useState("")
  const [mounted, setMounted] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setWorkouts(JSON.parse(saved))
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts))
    }
  }, [workouts, mounted])

  const addWorkout = () => {
    if (!duration || parseInt(duration) <= 0) return

    const newWorkout: Workout = {
      id: Date.now().toString(),
      type,
      duration: parseInt(duration),
      intensity,
      date: new Date().toISOString().split("T")[0],
      notes,
    }

    setWorkouts([newWorkout, ...workouts])
    setDuration("")
    setIntensity(5)
    setNotes("")
    setType("Gym")
  }

  const deleteWorkout = (id: string) => {
    setWorkouts(workouts.filter((w) => w.id !== id))
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

  const getAiTips = async () => {
    if (workouts.length === 0) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setAiResponse("")

    const last5 = workouts.slice(0, 5)
    const summary = last5
      .map((w) => `${w.type} for ${w.duration}min (intensity: ${w.intensity}/10)${w.notes ? `: ${w.notes}` : ""}`)
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
              content: `I'm tracking my workouts. Here are my last 5:\n${summary}\n\nGive me personalized coaching tips and recommendations to improve my fitness routine.`,
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

  const stats = {
    totalWorkouts: workouts.length,
    avgIntensity: workouts.length > 0 ? (workouts.reduce((sum, w) => sum + w.intensity, 0) / workouts.length).toFixed(1) : 0,
    totalHours: (workouts.reduce((sum, w) => sum + w.duration, 0) / 60).toFixed(1),
  }

  const heatmapDays = Array.from({ length: 365 }).map((_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - 364 + i)
    const dateStr = date.toISOString().split("T")[0]
    const dayWorkouts = workouts.filter((w) => w.date === dateStr)
    const maxIntensity = dayWorkouts.length > 0 ? Math.max(...dayWorkouts.map((w) => w.intensity)) : 0
    return { date: dateStr, intensity: maxIntensity }
  })

  const getHeatmapColor = (intensity: number) => {
    if (intensity === 0) return "bg-slate-100 dark:bg-slate-900"
    if (intensity <= 3) return "bg-green-200 dark:bg-green-900"
    if (intensity <= 6) return "bg-green-500 dark:bg-green-700"
    if (intensity <= 8) return "bg-green-700 dark:bg-green-600"
    return "bg-green-900 dark:bg-green-500"
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">💪 Workout Tracker</h1>
          <p className="text-slate-600 dark:text-slate-400">Log your workouts and get AI coaching tips</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Log Workout</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={type} onValueChange={(value: any) => setType(value)}>
                  <option value="Running">Running</option>
                  <option value="Gym">Gym</option>
                  <option value="Yoga">Yoga</option>
                  <option value="Other">Other</option>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Duration (minutes)</label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="45"
                  min="1"
                />
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
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did you feel?" rows={3} />
              </div>

              <Button onClick={addWorkout} className="w-full">
                Add Workout
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Stats</h2>
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">{stats.totalWorkouts}</div>
                <div className="text-sm text-blue-700 dark:text-blue-200">Total Workouts</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-300">{stats.avgIntensity}</div>
                <div className="text-sm text-purple-700 dark:text-purple-200">Avg Intensity</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-300">{stats.totalHours}h</div>
                <div className="text-sm text-green-700 dark:text-green-200">Total Hours</div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Heatmap (Last Year)</h2>
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(53, minmax(0, 1fr))" }}>
            {heatmapDays.map((day) => (
              <div
                key={day.date}
                className={`w-3 h-3 rounded-sm ${getHeatmapColor(day.intensity)} cursor-pointer`}
                title={`${day.date}: Intensity ${day.intensity}/10`}
              />
            ))}
          </div>
        </Card>

        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">AI Coach</h2>
            <Button onClick={getAiTips} disabled={loading || workouts.length === 0} className="gap-2">
              💡 Get AI Tips
            </Button>
          </div>

          {aiResponse && (
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg text-sm whitespace-pre-wrap">{aiResponse}</div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Workouts</h2>
          <div className="space-y-3">
            {workouts.length === 0 ? (
              <p className="text-slate-500">No workouts logged yet. Start by adding one!</p>
            ) : (
              workouts.map((workout) => (
                <div key={workout.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">
                      {workout.type} • {workout.duration}min
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Intensity: {workout.intensity}/10 • {workout.date}
                    </div>
                    {workout.notes && <div className="text-sm text-slate-500 mt-1">{workout.notes}</div>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteWorkout(workout.id)}>
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

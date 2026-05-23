"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"
const STORAGE_KEY = "tans-agents:nutrition-log-v1"

// Mock nutrition database for common foods
const NUTRITION_DB: Record<string, { calories: number; protein: number; carbs: number; fat: number; fiber: number }> = {
  chicken: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 },
  beef: { calories: 250, protein: 26, carbs: 0, fat: 15, fiber: 0 },
  salmon: { calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0 },
  egg: { calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0 },
  rice: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4 },
  pasta: { calories: 131, protein: 5, carbs: 25, fat: 1.1, fiber: 1.8 },
  bread: { calories: 265, protein: 9, carbs: 49, fat: 3.3, fiber: 2.7 },
  potato: { calories: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.1 },
  broccoli: { calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.4 },
  carrot: { calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8 },
  apple: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 },
  banana: { calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6 },
  orange: { calories: 47, protein: 0.9, carbs: 12, fat: 0.3, fiber: 2.4 },
  milk: { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fiber: 0 },
  yogurt: { calories: 59, protein: 10, carbs: 3.3, fat: 0.4, fiber: 0 },
  cheese: { calories: 402, protein: 25, carbs: 1.3, fat: 33, fiber: 0 },
  olive_oil: { calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 },
  butter: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81, fiber: 0 },
  almonds: { calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5 },
  oats: { calories: 389, protein: 17, carbs: 66, fat: 7, fiber: 10.6 },
}

type MealEntry = {
  id: string
  food: string
  quantity: number
  unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  timestamp: string
}

type NutritionLog = {
  date: string
  meals: MealEntry[]
}

function getMacroEstimate(food: string, quantity: number): {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
} {
  const normalized = food.toLowerCase().trim()
  const match = Object.entries(NUTRITION_DB).find(([key]) => normalized.includes(key))

  if (match) {
    const [, macros] = match
    const multiplier = quantity / 100
    return {
      calories: Math.round(macros.calories * multiplier),
      protein: Math.round(macros.protein * multiplier * 10) / 10,
      carbs: Math.round(macros.carbs * multiplier * 10) / 10,
      fat: Math.round(macros.fat * multiplier * 10) / 10,
      fiber: Math.round(macros.fiber * multiplier * 10) / 10,
    }
  }

  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
}

export default function NutritionPage() {
  const [meals, setMeals] = useState<MealEntry[]>([])
  const [foodInput, setFoodInput] = useState("")
  const [quantityInput, setQuantityInput] = useState("100")
  const [unitInput, setUnitInput] = useState("g")
  const [advice, setAdvice] = useState("")
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showChart, setShowChart] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0]
    const log = loadNutritionLog(today)
    setMeals(log.meals)
  }, [])

  const totals = useMemo(() => {
    return meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.protein,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fat,
        fiber: acc.fiber + meal.fiber,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    )
  }, [meals])

  const macroPercentages = useMemo(() => {
    const proteinCal = totals.protein * 4
    const carbsCal = totals.carbs * 4
    const fatCal = totals.fat * 9
    const total = proteinCal + carbsCal + fatCal || 1

    return {
      protein: Math.round((proteinCal / total) * 100),
      carbs: Math.round((carbsCal / total) * 100),
      fat: Math.round((fatCal / total) * 100),
    }
  }, [totals])

  function addMeal() {
    const quantity = parseFloat(quantityInput)
    if (!foodInput.trim() || !quantity || quantity <= 0) return

    const macros = getMacroEstimate(foodInput, quantity)
    const newMeal: MealEntry = {
      id: `${Date.now()}`,
      food: foodInput.trim(),
      quantity,
      unit: unitInput,
      ...macros,
      timestamp: new Date().toISOString(),
    }

    const updated = [...meals, newMeal]
    setMeals(updated)
    saveMeals(updated)
    setFoodInput("")
    setQuantityInput("100")
  }

  function removeMeal(id: string) {
    const updated = meals.filter((m) => m.id !== id)
    setMeals(updated)
    saveMeals(updated)
  }

  function saveMeals(mealsToSave: MealEntry[]) {
    const today = new Date().toISOString().split("T")[0]
    const log = loadNutritionLog(today)
    log.meals = mealsToSave
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
  }

  async function generateAdvice() {
    if (totals.calories === 0) {
      setError("Add some meals first")
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setIsLoadingAdvice(true)
    setError(null)
    setAdvice("")

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
              content: `Based on this daily nutrition intake: ${totals.calories} calories, ${totals.protein}g protein, ${totals.carbs}g carbs, ${totals.fat}g fat, ${totals.fiber}g fiber. Suggest 3 balanced meals to complement this and achieve daily nutritional goals (2000-2500 calories, 50-60g protein, 250-300g carbs, 60-80g fat).`,
            },
          ],
          personaSystemPrompt:
            "You are a professional nutritionist. Provide practical meal suggestions. Format as a numbered list. Keep suggestions concise and realistic.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("No stream received")

      await readSseStream(response.body, (chunk) => {
        setAdvice((current) => current + chunk)
      })
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(err?.message ?? "Error generating advice")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsLoadingAdvice(false)
    }
  }

  async function copyAdvice() {
    if (!advice) return
    await navigator.clipboard.writeText(advice)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Nutrition Tracker</p>
          <h1 className="text-2xl font-semibold tracking-tight">🥗 Nutrition Calculator & Meal Advice</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track daily nutrition, view macro breakdown, and get AI-powered meal suggestions.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-medium mb-3">Add Food Item</h2>
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={foodInput}
                    onChange={(e) => setFoodInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMeal()}
                    placeholder="e.g. chicken, rice, apple..."
                    className="rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={quantityInput}
                      onChange={(e) => setQuantityInput(e.target.value)}
                      placeholder="100"
                      min="1"
                      step="1"
                      className="w-20 rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                    />
                    <select
                      value={unitInput}
                      onChange={(e) => setUnitInput(e.target.value)}
                      className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
                    >
                      <option>g</option>
                      <option>oz</option>
                      <option>cup</option>
                      <option>tbsp</option>
                      <option>piece</option>
                    </select>
                  </div>
                </div>
                <Button type="button" onClick={addMeal} className="mt-2 w-full">
                  + Add Food
                </Button>
              </div>

              <div className="border-t pt-4">
                <h2 className="text-sm font-medium mb-3">Today's Meals</h2>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {meals.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No meals added yet</p>
                  ) : (
                    meals.map((meal) => (
                      <div key={meal.id} className="rounded-lg border bg-background p-2.5">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {meal.food} ({meal.quantity}{meal.unit})
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {meal.calories} cal • {meal.protein}g P • {meal.carbs}g C • {meal.fat}g F
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMeal(meal.id)}
                            className="rounded px-2 py-1 text-xs hover:bg-muted text-destructive"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-sm font-medium mb-3">Daily Totals</h2>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-background p-3">
                    <p className="text-xs text-muted-foreground">Calories</p>
                    <p className="text-2xl font-bold">{totals.calories}</p>
                    <p className="text-xs text-muted-foreground">/ 2000 kcal</p>
                  </div>
                  <div className="rounded-lg bg-background p-3">
                    <p className="text-xs text-muted-foreground">Protein</p>
                    <p className="text-2xl font-bold">{totals.protein.toFixed(1)}g</p>
                    <p className="text-xs text-muted-foreground">/ 50-60g</p>
                  </div>
                  <div className="rounded-lg bg-background p-3">
                    <p className="text-xs text-muted-foreground">Carbs</p>
                    <p className="text-2xl font-bold">{totals.carbs.toFixed(1)}g</p>
                    <p className="text-xs text-muted-foreground">/ 250-300g</p>
                  </div>
                  <div className="rounded-lg bg-background p-3">
                    <p className="text-xs text-muted-foreground">Fat</p>
                    <p className="text-2xl font-bold">{totals.fat.toFixed(1)}g</p>
                    <p className="text-xs text-muted-foreground">/ 60-80g</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Fiber: {totals.fiber.toFixed(1)}g</p>
              </div>

              {showChart && totals.calories > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Macro Breakdown</h3>
                  <MacroPieChart
                    protein={macroPercentages.protein}
                    carbs={macroPercentages.carbs}
                    fat={macroPercentages.fat}
                  />
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <span>Protein {macroPercentages.protein}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span>Carbs {macroPercentages.carbs}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span>Fat {macroPercentages.fat}%</span>
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="button"
                onClick={generateAdvice}
                disabled={isLoadingAdvice || totals.calories === 0}
                variant="secondary"
                className="w-full"
              >
                {isLoadingAdvice ? "Generating..." : "🥗 AI Meal Advice"}
              </Button>
            </div>
          </section>
        </div>

        {advice && (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium">AI Meal Suggestions</h2>
                <p className="text-xs text-muted-foreground">Personalized recommendations to balance nutrition</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={copyAdvice}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="rounded-lg border bg-background p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {advice}
              {isLoadingAdvice && (
                <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function MacroPieChart({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const proteinOffset = circumference * ((100 - protein) / 100)
  const carbsOffset = circumference * ((100 - carbs) / 100) + (circumference * protein) / 100
  const fatOffset = circumference * ((100 - fat) / 100) + (circumference * (protein + carbs)) / 100

  return (
    <svg width="120" height="120" className="mx-auto">
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="#ea580c"
        strokeWidth="24"
        strokeDasharray={circumference}
        strokeDashoffset={proteinOffset}
        strokeLinecap="round"
      />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="24"
        strokeDasharray={circumference}
        strokeDashoffset={carbsOffset}
        strokeLinecap="round"
        transform="rotate(1 60 60)"
      />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="#eab308"
        strokeWidth="24"
        strokeDasharray={circumference}
        strokeDashoffset={fatOffset}
        strokeLinecap="round"
        transform="rotate(2 60 60)"
      />
      <text x="60" y="65" textAnchor="middle" className="fill-foreground font-bold text-sm">
        100%
      </text>
    </svg>
  )
}

function loadNutritionLog(date: string): NutritionLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : { date, meals: [] }
    if (parsed.date === date) return parsed
    return { date, meals: [] }
  } catch {
    return { date, meals: [] }
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

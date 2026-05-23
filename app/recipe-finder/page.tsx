"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"
const STORAGE_KEY = "tans-agents:fav-recipes-v1"

// Mock recipe database (free alternative to spoonacular)
const MOCK_RECIPES = [
  {
    id: 1,
    name: "Chicken Stir-Fry",
    image: "🍗",
    servings: 4,
    prepTime: "20 min",
    ingredients: ["chicken", "soy sauce", "garlic", "ginger", "bell peppers", "onion"],
    instructions: "1. Cut chicken into bite-sized pieces\n2. Heat oil in wok or large pan\n3. Stir-fry chicken until cooked\n4. Add vegetables and garlic, cook 3-4 min\n5. Add soy sauce and ginger\n6. Serve over rice",
  },
  {
    id: 2,
    name: "Garlic Shrimp Pasta",
    image: "🍝",
    servings: 2,
    prepTime: "15 min",
    ingredients: ["shrimp", "garlic", "pasta", "olive oil", "lemon", "parsley"],
    instructions: "1. Cook pasta according to package\n2. Heat olive oil, sauté garlic\n3. Add shrimp, cook until pink\n4. Toss with pasta and lemon juice\n5. Garnish with parsley",
  },
  {
    id: 3,
    name: "Egg Fried Rice",
    image: "🍚",
    servings: 3,
    prepTime: "10 min",
    ingredients: ["rice", "eggs", "garlic", "soy sauce", "green peas", "onion"],
    instructions: "1. Heat oil in wok\n2. Scramble eggs and set aside\n3. Stir-fry rice with garlic\n4. Add soy sauce and vegetables\n5. Mix in eggs\n6. Serve hot",
  },
  {
    id: 4,
    name: "Bell Pepper Soup",
    image: "🥘",
    servings: 4,
    prepTime: "25 min",
    ingredients: ["bell peppers", "onion", "garlic", "broth", "cream", "olive oil"],
    instructions: "1. Roast bell peppers and onion\n2. Blend with garlic and broth\n3. Simmer 10 minutes\n4. Add cream\n5. Season to taste",
  },
  {
    id: 5,
    name: "Garlic Broccoli",
    image: "🥦",
    servings: 2,
    prepTime: "8 min",
    ingredients: ["broccoli", "garlic", "olive oil", "lemon"],
    instructions: "1. Heat olive oil\n2. Add garlic, sauté 1 min\n3. Add broccoli, cook 5-7 min\n4. Squeeze lemon juice\n5. Serve",
  },
  {
    id: 6,
    name: "Tomato Basil Omelette",
    image: "🍳",
    servings: 1,
    prepTime: "5 min",
    ingredients: ["eggs", "tomato", "basil", "cheese", "olive oil"],
    instructions: "1. Heat oil in non-stick pan\n2. Pour beaten eggs\n3. Add tomato, cheese, basil\n4. Fold when cooked\n5. Serve immediately",
  },
]

type Recipe = (typeof MOCK_RECIPES)[number]
type FavRecipe = Recipe & { addedAt: string }

export default function RecipeFinderPage() {
  const [ingredients, setIngredients] = useState("")
  const [results, setResults] = useState<Recipe[]>([])
  const [favorites, setFavorites] = useState<FavRecipe[]>([])
  const [selectedRecipes, setSelectedRecipes] = useState<number[]>([])
  const [mealPlan, setMealPlan] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<"search" | "favorites">("search")
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setFavorites(loadFavorites())
  }, [])

  const parsedIngredients = useMemo(
    () =>
      ingredients
        .split(/[,\n]+/)
        .map((i) => i.trim().toLowerCase())
        .filter(Boolean),
    [ingredients]
  )

  const canSearch = parsedIngredients.length > 0
  const canCreateMealPlan = selectedRecipes.length > 0 && !isLoading

  function searchRecipes() {
    if (!canSearch) return

    const matchedRecipes = MOCK_RECIPES.filter((recipe) =>
      recipe.ingredients.some((ing) => parsedIngredients.some((userIng) => ing.toLowerCase().includes(userIng)))
    )

    setResults(matchedRecipes.length > 0 ? matchedRecipes : MOCK_RECIPES.slice(0, 3))
    setSelectedRecipes([])
    setMealPlan("")
  }

  function toggleFavorite(recipe: Recipe) {
    const isFav = favorites.some((f) => f.id === recipe.id)

    if (isFav) {
      const updated = favorites.filter((f) => f.id !== recipe.id)
      setFavorites(updated)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } else {
      const newFav: FavRecipe = { ...recipe, addedAt: new Date().toISOString() }
      const updated = [newFav, ...favorites]
      setFavorites(updated)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    }
  }

  function isFavorited(recipeId: number) {
    return favorites.some((f) => f.id === recipeId)
  }

  function toggleSelectRecipe(recipeId: number) {
    setSelectedRecipes((current) =>
      current.includes(recipeId) ? current.filter((id) => id !== recipeId) : [...current, recipeId]
    )
  }

  async function generateMealPlan() {
    if (!canCreateMealPlan) return

    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
    setError(null)
    setMealPlan("")

    try {
      const selectedRecipeList = results.filter((r) => selectedRecipes.includes(r.id))
      const recipeNames = selectedRecipeList.map((r) => r.name).join(", ")

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
              content: `Create a balanced weekly meal plan using these recipes: ${recipeNames}. Format as a 7-day schedule with breakfast, lunch, and dinner. Include shopping tips and nutritional highlights.`,
            },
          ],
          personaSystemPrompt:
            "You are a professional meal planner. Create detailed, practical weekly meal plans. Format with clear day labels and meal times. Keep it concise and actionable.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("No stream received")

      await readSseStream(response.body, (chunk) => {
        setMealPlan((current) => current + chunk)
      })
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(err?.message ?? "Error generating meal plan")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsLoading(false)
    }
  }

  async function copyMealPlan() {
    if (!mealPlan) return
    await navigator.clipboard.writeText(mealPlan)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Recipe Finder</p>
          <h1 className="text-2xl font-semibold tracking-tight">🔍 Search Recipes by Ingredients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter ingredients and find recipes. Save favorites and generate AI meal plans.
          </p>
        </header>

        <div className="flex w-fit rounded-lg border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "search" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("favorites")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "favorites" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            Favorites ({favorites.length})
          </button>
        </div>

        {activeTab === "search" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="ingredients-input" className="text-sm font-medium">
                    Ingredients
                  </label>
                  <textarea
                    id="ingredients-input"
                    value={ingredients}
                    onChange={(e) => setIngredients(e.target.value)}
                    rows={6}
                    className="mt-2 w-full resize-y rounded-lg border bg-background p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                    placeholder="Enter ingredients separated by comma or line break. E.g. chicken, garlic, onion..."
                  />
                </div>

                <Button
                  type="button"
                  onClick={searchRecipes}
                  disabled={!canSearch || isLoading}
                  className="w-full"
                >
                  🔍 Search Recipes
                </Button>

                {results.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="text-sm font-medium">Found {results.length} recipes</div>
                    {results.map((recipe) => (
                      <div key={recipe.id} className="rounded-lg border bg-background p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{recipe.image}</span>
                              <div>
                                <p className="font-medium text-sm">{recipe.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {recipe.servings} servings • {recipe.prepTime}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => toggleFavorite(recipe)}
                              className="rounded px-2 py-1 text-sm hover:bg-muted"
                              title={isFavorited(recipe.id) ? "Remove from favorites" : "Add to favorites"}
                            >
                              {isFavorited(recipe.id) ? "⭐" : "☆"}
                            </button>
                            <input
                              type="checkbox"
                              checked={selectedRecipes.includes(recipe.id)}
                              onChange={() => toggleSelectRecipe(recipe.id)}
                              className="h-4 w-4 rounded border"
                              title="Select for meal plan"
                            />
                          </div>
                        </div>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            View details
                          </summary>
                          <div className="mt-2 space-y-2 text-xs">
                            <div>
                              <p className="font-medium">Ingredients:</p>
                              <p>{recipe.ingredients.join(", ")}</p>
                            </div>
                            <div>
                              <p className="font-medium">Instructions:</p>
                              <p className="whitespace-pre-wrap">{recipe.instructions}</p>
                            </div>
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                )}

                {selectedRecipes.length > 0 && (
                  <Button
                    type="button"
                    onClick={generateMealPlan}
                    disabled={!canCreateMealPlan}
                    variant="secondary"
                    className="w-full"
                  >
                    {isLoading ? "Generating..." : "🥗 AI Meal Plan"}
                  </Button>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-medium">Weekly Meal Plan</h2>
                  <p className="text-xs text-muted-foreground">AI-generated meal schedule</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={copyMealPlan}
                  disabled={!mealPlan}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>

              <div className="min-h-[28rem] whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-relaxed">
                {mealPlan || (
                  <span className="text-muted-foreground">
                    Select recipes above and click "AI Meal Plan" to generate a weekly schedule.
                  </span>
                )}
                {isLoading && (
                  <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />
                )}
              </div>
            </section>
          </div>
        ) : (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-medium">Favorite Recipes</h2>
              <p className="text-xs text-muted-foreground">Saved to browser storage</p>
            </div>

            {favorites.length === 0 ? (
              <div className="rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground">
                No favorite recipes yet. Search and add some!
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {favorites.map((recipe) => (
                  <article key={recipe.id} className="rounded-lg border bg-background p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{recipe.image}</span>
                          <p className="font-medium">{recipe.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {recipe.servings} servings • {recipe.prepTime}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(recipe)}
                        className="rounded px-2 py-1 text-sm hover:bg-muted"
                      >
                        ⭐
                      </button>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        View details
                      </summary>
                      <div className="mt-2 space-y-2 text-xs">
                        <div>
                          <p className="font-medium">Ingredients:</p>
                          <p>{recipe.ingredients.join(", ")}</p>
                        </div>
                        <div>
                          <p className="font-medium">Instructions:</p>
                          <p className="whitespace-pre-wrap">{recipe.instructions}</p>
                        </div>
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

function loadFavorites(): FavRecipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
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

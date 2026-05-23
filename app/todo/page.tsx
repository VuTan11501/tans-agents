"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"
const STORAGE_KEY = "tans-agents:todos-v1"

interface Todo {
  id: string
  text: string
  done: boolean
  priority: "High" | "Medium" | "Low"
  createdAt: string
}

export default function TodoPage() {
  const [input, setInput] = useState("")
  const [todos, setTodos] = useState<Todo[]>([])
  const [prioritizing, setPrioritizing] = useState(false)
  const [aiOutput, setAiOutput] = useState("")
  const [showAiResult, setShowAiResult] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Load todos from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setTodos(JSON.parse(stored))
      } catch (e) {
        console.error("Failed to parse todos from localStorage:", e)
      }
    }
  }, [])

  // Save todos to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos])

  const doneTodosCount = useMemo(() => todos.filter((t) => t.done).length, [todos])
  const canAddTodo = useMemo(() => input.trim().length > 0, [input])
  const canPrioritize = useMemo(() => todos.length > 0 && !prioritizing, [todos.length, prioritizing])

  function addTodo() {
    if (!input.trim()) return

    const newTodo: Todo = {
      id: Date.now().toString(),
      text: input.trim(),
      done: false,
      priority: "Medium",
      createdAt: new Date().toISOString(),
    }

    setTodos([...todos, newTodo])
    setInput("")
  }

  function toggleTodo(id: string) {
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  function setPriority(id: string, priority: "High" | "Medium" | "Low") {
    setTodos(todos.map((t) => (t.id === id ? { ...t, priority } : t)))
  }

  function deleteTodo(id: string) {
    setTodos(todos.filter((t) => t.id !== id))
  }

  function clearDone() {
    setTodos(todos.filter((t) => !t.done))
  }

  async function copyAllTodos() {
    const text = todos.map((t) => `${t.done ? "☑" : "☐"} ${t.text} [${t.priority}]`).join("\n")
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function prioritizeWithAi() {
    if (todos.length === 0 || prioritizing) return

    const controller = new AbortController()
    abortRef.current = controller
    setPrioritizing(true)
    setAiOutput("")
    setError(null)
    setShowAiResult(true)

    try {
      const todoList = todos.map((t) => `- ${t.text}`).join("\n")

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
              content: `Rank these todos by importance/urgency. Return ONLY the ranked list in markdown format with - for each item:\n\n${todoList}`,
            },
          ],
          personaSystemPrompt: "You are a task prioritization expert. Rank tasks by importance and urgency. Return only the ranked list.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("No stream received")

      await readSseStream(response.body, (chunk) => {
        setAiOutput((curr) => curr + chunk)
      })
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(err?.message ?? "AI prioritization failed")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setPrioritizing(false)
    }
  }

  function applyAiPrioritization() {
    const lines = aiOutput
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter((line) => line.length > 0)

    const updatedTodos = [...todos]
    lines.forEach((line, idx) => {
      const matchingTodo = updatedTodos.find((t) => !t.done && line.includes(t.text))
      if (matchingTodo) {
        const priority: "High" | "Medium" | "Low" = idx < Math.ceil(todos.length / 3) ? "High" : idx < Math.ceil((todos.length * 2) / 3) ? "Medium" : "Low"
        matchingTodo.priority = priority
      }
    })

    setTodos(updatedTodos)
    setShowAiResult(false)
    setAiOutput("")
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Task Management</p>
              <h1 className="text-2xl font-semibold tracking-tight">Smart Todo List</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {todos.length} todos • {doneTodosCount} done
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={clearDone}
                disabled={doneTodosCount === 0}
                size="sm"
              >
                Clear Done ({doneTodosCount})
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={copyAllTodos}
                disabled={todos.length === 0}
                size="sm"
              >
                {copied ? "Copied" : "Copy All"}
              </Button>
            </div>
          </div>
        </header>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <label htmlFor="todo-input" className="text-sm font-medium">
            Add a new todo
          </label>
          <div className="mt-2 flex gap-2">
            <textarea
              id="todo-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey && canAddTodo) {
                  addTodo()
                }
              }}
              className="min-h-[6rem] flex-1 resize-y rounded-lg border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="What needs to be done?"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" onClick={addTodo} disabled={!canAddTodo}>
              Add Todo
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={prioritizeWithAi}
              disabled={!canPrioritize}
              className={prioritizing ? "animate-pulse" : ""}
            >
              {prioritizing ? "Ranking..." : "🤖 Prioritize with AI"}
            </Button>
          </div>
        </section>

        {showAiResult && (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">AI Priority Ranking</h2>
              <button
                onClick={() => setShowAiResult(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            {error && <div className="mb-3 text-sm text-destructive">{error}</div>}
            <div className="min-h-[8rem] whitespace-pre-wrap rounded-lg border bg-background p-3 text-sm leading-relaxed">
              {aiOutput || <span className="text-muted-foreground">Generating ranking...</span>}
              {prioritizing && (
                <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />
              )}
            </div>
            {aiOutput && !prioritizing && (
              <div className="mt-3 flex gap-2">
                <Button type="button" onClick={applyAiPrioritization}>
                  Apply Ranking
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAiResult(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </section>
        )}

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium">Todos</h2>
          {todos.length === 0 ? (
            <div className="text-sm text-muted-foreground">No todos yet. Add one to get started!</div>
          ) : (
            <div className="space-y-2">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 rounded-lg border bg-background p-3 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => toggleTodo(todo.id)}
                    className="h-4 w-4 rounded border cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className={`text-sm ${todo.done ? "line-through text-muted-foreground" : ""}`}>
                      {todo.text}
                    </p>
                  </div>
                  <select
                    value={todo.priority}
                    onChange={(e) => setPriority(todo.id, e.target.value as "High" | "Medium" | "Low")}
                    className={`rounded border px-2 py-1 text-xs font-medium cursor-pointer bg-background outline-none ${
                      todo.priority === "High"
                        ? "border-destructive text-destructive"
                        : todo.priority === "Low"
                          ? "border-muted text-muted-foreground"
                          : "border-ring text-foreground"
                    }`}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTodo(todo.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
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

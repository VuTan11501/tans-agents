"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"
const STORAGE_KEY = "tans-agents:notes-quick-v1"

interface Note {
  id: string
  title: string
  content: string
  createdAt: string
}

export default function NotesQuickPage() {
  const [tab, setTab] = useState<"new" | "saved">("new")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [aiStreaming, setAiStreaming] = useState(false)
  const [aiOutput, setAiOutput] = useState("")
  const [showMarkdown, setShowMarkdown] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Load notes from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setNotes(JSON.parse(stored))
      } catch (e) {
        console.error("Failed to parse notes from localStorage:", e)
      }
    }
  }, [])

  // Save notes to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
  }, [notes])

  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedNoteId), [notes, selectedNoteId])
  const canSave = useMemo(() => title.trim().length > 0 && content.trim().length > 0, [title, content])
  const canGenerateOutline = useMemo(() => content.trim().length > 0 && !aiStreaming, [content, aiStreaming])
  const canExpand = useMemo(() => content.trim().length > 0 && !aiStreaming, [content, aiStreaming])

  function saveNote() {
    if (!canSave) return

    if (selectedNoteId) {
      setNotes(
        notes.map((n) =>
          n.id === selectedNoteId ? { ...n, title: title.trim(), content: content.trim() } : n
        )
      )
    } else {
      const newNote: Note = {
        id: Date.now().toString(),
        title: title.trim(),
        content: content.trim(),
        createdAt: new Date().toISOString(),
      }
      setNotes([...notes, newNote])
    }

    setTitle("")
    setContent("")
    setSelectedNoteId(null)
    setAiOutput("")
    setTab("saved")
  }

  function editNote(note: Note) {
    setTitle(note.title)
    setContent(note.content)
    setSelectedNoteId(note.id)
    setTab("new")
    setAiOutput("")
  }

  function deleteNote(id: string) {
    setNotes(notes.filter((n) => n.id !== id))
    if (selectedNoteId === id) {
      setTitle("")
      setContent("")
      setSelectedNoteId(null)
    }
  }

  function clearNew() {
    setTitle("")
    setContent("")
    setSelectedNoteId(null)
    setAiOutput("")
  }

  async function copyContent() {
    const text = aiOutput || content
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function generateOutline() {
    if (!content.trim() || aiStreaming) return

    const controller = new AbortController()
    abortRef.current = controller
    setAiStreaming(true)
    setAiOutput("")
    setError(null)

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
              content: `Generate a structured outline from this content:\n\n${content}\n\nReturn as markdown with nested bullet points. Be concise and organize by main topics.`,
            },
          ],
          personaSystemPrompt: "You are an outline expert. Generate clear, well-organized outlines from content using markdown.",
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
        setError(err?.message ?? "Failed to generate outline")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setAiStreaming(false)
    }
  }

  async function expandContent() {
    if (!content.trim() || aiStreaming) return

    const controller = new AbortController()
    abortRef.current = controller
    setAiStreaming(true)
    setAiOutput("")
    setError(null)

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
              content: `Expand this bullet-point content with more details and explanations. Keep markdown format:\n\n${content}`,
            },
          ],
          personaSystemPrompt: "You are a writing assistant. Expand bullet points into detailed, well-written paragraphs while keeping structure.",
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
        setError(err?.message ?? "Failed to expand content")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setAiStreaming(false)
    }
  }

  function applyAiOutput() {
    if (!aiOutput) return
    setContent(aiOutput)
    setAiOutput("")
  }

  function parseMarkdown(md: string) {
    return md
      .split("\n")
      .map((line, idx) => {
        const level = line.match(/^#+/)?.[0]?.length ?? 0
        const bullet = line.match(/^[-*•]/)?.[0]
        const ordered = line.match(/^\d+\./)?.[0]

        if (level > 0) {
          const text = line.replace(/^#+\s*/, "")
          return (
            <div
              key={idx}
              style={{ marginLeft: `${(level - 1) * 1.5}rem`, marginTop: level === 1 ? "1rem" : "0.5rem" }}
            >
              {level === 1 && <h2 className="text-lg font-bold">{text}</h2>}
              {level === 2 && <h3 className="text-base font-semibold">{text}</h3>}
              {level >= 3 && <h4 className="text-sm font-semibold">{text}</h4>}
            </div>
          )
        }

        if (bullet) {
          const text = line.replace(/^[-*•]\s*/, "")
          const level = line.match(/^\s*/)?.[0]?.length ?? 0
          return (
            <div key={idx} style={{ marginLeft: `${level + 1.5}rem` }} className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <p className="text-sm">{text}</p>
            </div>
          )
        }

        if (ordered) {
          const text = line.replace(/^\d+\.\s*/, "")
          return (
            <p key={idx} className="text-sm">
              <span className="font-medium">{ordered}</span> {text}
            </p>
          )
        }

        if (line.trim().length > 0) {
          return (
            <p key={idx} className="text-sm leading-relaxed">
              {line}
            </p>
          )
        }

        return <div key={idx} className="h-2" />
      })
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Note Taking</p>
            <h1 className="text-2xl font-semibold tracking-tight">Markdown Notes with AI</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create, organize, and expand your notes with AI assistance
            </p>
          </div>
        </header>

        <section className="rounded-lg border bg-card">
          <div className="flex border-b">
            <button
              onClick={() => setTab("new")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                tab === "new"
                  ? "border-b-2 border-ring bg-muted/50 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ✏️ New Note
            </button>
            <button
              onClick={() => setTab("saved")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                tab === "saved"
                  ? "border-b-2 border-ring bg-muted/50 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              📚 Saved Notes ({notes.length})
            </button>
          </div>

          <div className="p-4">
            {tab === "new" ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="note-title" className="text-sm font-medium">
                    Title
                  </label>
                  <input
                    id="note-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                    placeholder="Note title..."
                  />
                </div>

                <div>
                  <label htmlFor="note-content" className="text-sm font-medium">
                    Content
                  </label>
                  <textarea
                    id="note-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="mt-2 min-h-[12rem] w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                    placeholder="Write your notes in markdown format..."
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={saveNote} disabled={!canSave}>
                    {selectedNoteId ? "Update Note" : "Save Note"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={generateOutline}
                    disabled={!canGenerateOutline}
                    className={aiStreaming ? "animate-pulse" : ""}
                  >
                    📝 Outline
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={expandContent}
                    disabled={!canExpand}
                    className={aiStreaming ? "animate-pulse" : ""}
                  >
                    ✨ Expand
                  </Button>
                  {selectedNoteId && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={clearNew}
                      className="text-muted-foreground"
                    >
                      New
                    </Button>
                  )}
                </div>

                {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
              </div>
            ) : (
              <div className="space-y-3">
                {notes.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No saved notes yet.</div>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3 hover:bg-muted/50">
                      <div className="flex-1 cursor-pointer" onClick={() => editNote(note)}>
                        <h3 className="font-medium text-sm">{note.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteNote(note.id)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        ✕
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>

        {aiOutput && (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium">AI Output</h2>
                <button
                  onClick={() => setShowMarkdown(!showMarkdown)}
                  className="text-xs px-2 py-1 rounded border text-muted-foreground hover:text-foreground"
                >
                  {showMarkdown ? "Preview" : "Raw"}
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={copyContent}
                  size="sm"
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button
                  type="button"
                  onClick={applyAiOutput}
                  size="sm"
                  disabled={aiStreaming}
                >
                  Use This
                </Button>
                <button
                  onClick={() => setAiOutput("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            </div>

            {showMarkdown ? (
              <div className="rounded-lg border bg-background p-4 text-sm space-y-2 max-h-96 overflow-auto">
                {parseMarkdown(aiOutput)}
              </div>
            ) : (
              <div className="min-h-[8rem] whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-relaxed max-h-96 overflow-auto">
                {aiOutput}
                {aiStreaming && (
                  <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />
                )}
              </div>
            )}
          </section>
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

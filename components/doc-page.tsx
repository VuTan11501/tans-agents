"use client"

import { useMemo, useRef, useState, type FormEvent } from "react"
import { Bot, Loader2, Send, User } from "lucide-react"
import { DocEditor, type DocEditorHandle } from "@/components/doc-editor"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { PROVIDERS } from "@/lib/providers"
import { cn } from "@/lib/utils"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

type DocAction = "continue" | "rewrite" | "summarize" | "translate-en"

const DEFAULT_CONTENT = "<h1>Document Writer</h1><p>Bắt đầu viết tài liệu ở đây...</p>"
const SYSTEM_PROMPT =
  "Bạn là trợ lý viết tài liệu trong Tan's Agent. Trả lời trực tiếp nội dung cần chèn vào editor, không giải thích dài dòng trừ khi người dùng yêu cầu. Ưu tiên tiếng Việt, văn phong rõ ràng, có cấu trúc."

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function textFromHtml(html: string) {
  if (typeof window === "undefined") return html
  const node = document.createElement("div")
  node.innerHTML = html
  return node.textContent?.trim() ?? ""
}

function buildActionPrompt(action: DocAction, source: string, usingSelection: boolean) {
  const target = usingSelection ? "đoạn đang chọn" : "toàn bộ tài liệu"
  if (action === "continue") {
    return `Hãy tiếp tục viết ${target} dưới đây. Chỉ trả về phần viết tiếp, không nhắc lại nội dung gốc.\n\n${source}`
  }
  if (action === "rewrite") {
    return `Hãy viết lại ${target} dưới đây cho mạch lạc, tự nhiên và chuyên nghiệp hơn. Chỉ trả về bản viết lại.\n\n${source}`
  }
  if (action === "summarize") {
    return `Hãy tóm tắt ${target} dưới đây bằng tiếng Việt, ngắn gọn nhưng đủ ý.\n\n${source}`
  }
  return `Translate ${target} below into natural English. Return only the English translation.\n\n${source}`
}

function parseSseDelta(payload: unknown) {
  const obj = payload as {
    error?: { message?: string }
    choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>
  }
  if (obj.error?.message) throw new Error(obj.error.message)
  const content = obj.choices?.[0]?.delta?.content
  return typeof content === "string" ? content : ""
}

async function streamChatSse({
  prompt,
  signal,
  onChunk,
}: {
  prompt: string
  signal: AbortSignal
  onChunk: (chunk: string) => void
}) {
  const res = await fetch("/api/chat-sse", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      provider: "google",
      model: PROVIDERS.google.default,
      enabledTools: [],
      personaSystemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    while (true) {
      const match = buffer.match(/\r?\n\r?\n/)
      if (!match || match.index === undefined) break
      const frame = buffer.slice(0, match.index)
      buffer = buffer.slice(match.index + match[0].length)

      for (const rawLine of frame.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith(":")) continue
        if (!line.startsWith("data:")) continue
        const data = line.slice(5).trim()
        if (data === "[DONE]") return
        onChunk(parseSseDelta(JSON.parse(data) as unknown))
      }
    }
  }
}

export function DocPage() {
  const editorRef = useRef<DocEditorHandle | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contentHtml, setContentHtml] = useState(DEFAULT_CONTENT)

  const contentText = useMemo(() => textFromHtml(contentHtml), [contentHtml])

  const runPrompt = async (prompt: string, mode: "chat" | "editor") => {
    if (!prompt.trim() || isStreaming) return

    const userMessage: ChatMessage = { id: uid(), role: "user", content: prompt.trim() }
    const assistantId = uid()
    const assistantMessage: ChatMessage = { id: assistantId, role: "assistant", content: "" }
    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setError(null)
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    let wroteToEditor = false

    try {
      await streamChatSse({
        prompt: prompt.trim(),
        signal: controller.signal,
        onChunk: (chunk) => {
          if (!chunk) return
          setMessages((prev) => prev.map((message) => (
            message.id === assistantId ? { ...message, content: message.content + chunk } : message
          )))

          if (mode === "editor") {
            if (!wroteToEditor) {
              editorRef.current?.replaceSelection(chunk)
              wroteToEditor = true
            } else {
              editorRef.current?.insertContent(chunk)
            }
          }
        },
      })
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const prompt = input.trim()
    if (!prompt) return
    setInput("")
    await runPrompt(prompt, "chat")
  }

  const runDocAction = async (action: DocAction) => {
    const selection = editorRef.current?.getSelectionText().trim() ?? ""
    const editorText = textFromHtml(editorRef.current?.getHTML() ?? contentHtml)
    const source = selection || editorText || contentText
    const prompt = buildActionPrompt(action, source, Boolean(selection))

    if (!selection) {
      editorRef.current?.appendContent("\n\n")
    }

    await runPrompt(prompt, "editor")
  }

  const stop = () => {
    abortRef.current?.abort()
    setIsStreaming(false)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex h-screen max-w-7xl flex-col gap-3 p-3 lg:flex-row lg:p-4">
        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card shadow-sm lg:max-w-md">
          <div className="border-b border-border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tan&apos;s Agent</p>
            <h1 className="text-lg font-semibold">Document Writer</h1>
            <p className="mt-1 text-sm text-muted-foreground">Chat bên trái, soạn thảo tài liệu bên phải.</p>
          </div>

          <ScrollArea className="min-h-0 flex-1 p-4">
            <div className="space-y-3 pr-3">
              {messages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Gõ yêu cầu hoặc dùng các nút AI trên editor để viết nhanh.
                </div>
              ) : null}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2 rounded-lg border border-border/60 p-3 text-sm",
                    message.role === "user" ? "bg-primary/10" : "bg-muted/40"
                  )}
                >
                  {message.role === "user" ? <User className="mt-0.5 h-4 w-4 shrink-0" /> : <Bot className="mt-0.5 h-4 w-4 shrink-0" />}
                  <div className="min-w-0 flex-1 whitespace-pre-wrap break-words">{message.content || "..."}</div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmit} className="border-t border-border p-3">
            {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Nhập yêu cầu viết tài liệu..."
              className="min-h-24 resize-none bg-background"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Enter để gửi · Shift+Enter xuống dòng</p>
              <div className="flex gap-2">
                {isStreaming ? (
                  <Button type="button" variant="outline" size="sm" onClick={stop}>Dừng</Button>
                ) : null}
                <Button type="submit" size="sm" disabled={!input.trim() || isStreaming}>
                  {isStreaming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Gửi
                </Button>
              </div>
            </div>
          </form>
        </section>

        <section className="flex min-h-0 flex-[1.6] flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
            <Button type="button" variant="secondary" size="sm" disabled={isStreaming} onClick={() => runDocAction("continue")}>✨ Tiếp tục viết</Button>
            <Button type="button" variant="secondary" size="sm" disabled={isStreaming} onClick={() => runDocAction("rewrite")}>🔁 Viết lại</Button>
            <Button type="button" variant="secondary" size="sm" disabled={isStreaming} onClick={() => runDocAction("summarize")}>📝 Tóm tắt</Button>
            <Button type="button" variant="secondary" size="sm" disabled={isStreaming} onClick={() => runDocAction("translate-en")}>🌐 Dịch sang EN</Button>
          </div>
          <div className="min-h-0 flex-1">
            <DocEditor initialContent={DEFAULT_CONTENT} onChange={setContentHtml} editorRef={editorRef} />
          </div>
        </section>
      </div>
    </main>
  )
}

"use client"

import { useSseChat } from "@/hooks/use-sse-chat"
import { useState } from "react"

// Minimal demo page to validate the true SSE pipeline (text/event-stream).
// Visit /sse-test to see deltas arrive token-by-token from /api/chat-sse.
// Open DevTools → Network → "chat-sse" → Response should show streaming
// `data: {"choices":[{"delta":{"content":"..."}}]}` lines as they arrive.

export default function SseTestPage() {
  const [provider, setProvider] = useState("groq")
  const [model, setModel] = useState("llama-3.1-8b-instant")

  const chat = useSseChat({
    api: "/api/chat-sse",
    body: { provider, model },
    onError: (err) => console.error("[sse-test] error:", err),
    onFinish: (msg) => console.log("[sse-test] finish:", msg.content.length, "chars"),
  })

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col p-6">
      <h1 className="mb-2 text-xl font-semibold">SSE Streaming Demo</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Endpoint <code>/api/chat-sse</code> trả về <code>text/event-stream</code> thuần OpenAI-compatible.
        Hook <code>useSseChat</code> parse từng <code>data:</code> line. Mở DevTools → Network để xem.
      </p>

      <div className="mb-3 flex gap-2 text-sm">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded border px-2 py-1"
        >
          <option value="groq">groq</option>
          <option value="google">google</option>
          <option value="github">github</option>
        </select>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="flex-1 rounded border px-2 py-1 font-mono"
        />
      </div>

      <div className="mb-4 flex-1 space-y-3 overflow-auto rounded border bg-muted/30 p-4">
        {chat.messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Chưa có tin nhắn. Gõ gì đó bên dưới.</p>
        )}
        {chat.messages.map((m) => (
          <div key={m.id} className="rounded bg-background p-3 text-sm">
            <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{m.role}</div>
            <div className="whitespace-pre-wrap">{m.content}</div>
            {m.toolCalls && m.toolCalls.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                🔧 tool calls: {m.toolCalls.map((t) => t.name).join(", ")}
              </div>
            )}
          </div>
        ))}
        {chat.isLoading && <div className="text-xs text-muted-foreground">⏳ streaming…</div>}
        {chat.error && (
          <div className="rounded border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-600">
            {chat.error.message}
          </div>
        )}
      </div>

      <form onSubmit={chat.handleSubmit} className="flex gap-2">
        <input
          value={chat.input}
          onChange={chat.handleInputChange}
          placeholder="Hỏi gì đó..."
          className="flex-1 rounded border px-3 py-2 text-sm"
          disabled={chat.isLoading}
        />
        {chat.isLoading ? (
          <button type="button" onClick={chat.stop} className="rounded bg-red-500 px-4 py-2 text-sm text-white">
            Dừng
          </button>
        ) : (
          <button type="submit" className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">
            Gửi
          </button>
        )}
      </form>
    </main>
  )
}

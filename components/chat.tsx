"use client"

import { useChat } from "ai/react"
import { useState, useRef, useEffect } from "react"
import { Header } from "@/components/header"
import { EmptyState } from "@/components/empty-state"
import { MessageBubble } from "@/components/message"
import { Composer } from "@/components/composer"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"

export function Chat() {
  // Default to Groq: free tier is far more generous (30 req/min) and it
  // streams token-by-token, giving the best ChatGPT-like feel out of the box.
  const [provider, setProvider] = useState<ProviderKey>("groq")
  const [model, setModel] = useState<string>(PROVIDERS.groq.default)
  const scrollEndRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, setInput, stop, error, reload } = useChat({
    api: "/api/chat",
    body: { provider, model },
  })

  // Auto-scroll: follow the bottom while assistant is streaming new tokens.
  // Tracks length of last message content so we rerun on every token, not just new messages.
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
  const streamingLen = lastAssistant?.content?.length ?? 0
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, streamingLen])

  function handleProviderChange(p: ProviderKey, m: string) {
    setProvider(p)
    setModel(m)
  }

  return (
    <div className="relative flex h-[100dvh] flex-col bg-background">
      {/* Dot grid background */}
      <div className="bg-dot-grid pointer-events-none fixed inset-0 -z-10 opacity-[0.15]" />

      <Header
        provider={provider}
        model={model}
        onChange={handleProviderChange}
        onNewChat={() => setMessages([])}
        canNewChat={messages.length > 0 && !isLoading}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4">
          {messages.length === 0 ? (
            <EmptyState onPick={(t) => setInput(t)} />
          ) : (
            <div className="space-y-8 py-8">
              {messages.map((m, i) => {
                const isLastAssistant =
                  m.role === "assistant" && i === messages.length - 1 && !isLoading
                return (
                  <MessageBubble
                    key={m.id}
                    role={m.role}
                    content={m.content}
                    parts={m.parts}
                    isStreaming={isLoading && i === messages.length - 1 && m.role === "assistant"}
                    isLastAssistant={isLastAssistant}
                    onRegenerate={() => reload()}
                    onEditUser={
                      m.role === "user"
                        ? (newContent) => {
                            // Truncate to this user msg with edited content, then resend
                            const truncated = messages.slice(0, i)
                            setMessages([
                              ...truncated,
                              { ...m, content: newContent, parts: undefined as any },
                            ])
                            // reload() generates a fresh assistant response for the last user msg
                            setTimeout(() => reload(), 0)
                          }
                        : undefined
                    }
                  />
                )
              })}
              {error && (
                <div className="fade-up flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
                    !
                  </div>
                  <div className="min-w-0 flex-1 space-y-2 pt-1">
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      <div className="font-medium">Có lỗi khi gọi AI:</div>
                      <div className="mt-1 whitespace-pre-wrap text-xs opacity-90">{error.message}</div>
                    </div>
                    <button
                      onClick={() => reload()}
                      className="rounded-md border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
                    >
                      Thử lại
                    </button>
                  </div>
                </div>
              )}
              <div ref={scrollEndRef} className="h-1" />
            </div>
          )}
        </div>
      </main>

      <div className="sticky bottom-0 border-t border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <Composer
            value={input}
            onChange={(v) => handleInputChange({ target: { value: v } } as any)}
            onSubmit={handleSubmit}
            onStop={stop}
            isStreaming={isLoading}
          />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            AI có thể tạo thông tin không chính xác · Powered by{" "}
            <span className="font-mono">{model}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

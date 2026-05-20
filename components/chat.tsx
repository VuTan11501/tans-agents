"use client"

import { useChat } from "ai/react"
import { useState, useRef, useEffect, useCallback } from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { EmptyState } from "@/components/empty-state"
import { MessageBubble } from "@/components/message"
import { Composer } from "@/components/composer"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"
import { useChatHistory, deriveTitle } from "@/hooks/use-chat-history"

function newId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  )
}

export function Chat() {
  const [provider, setProvider] = useState<ProviderKey>("groq")
  const [model, setModel] = useState<string>(PROVIDERS.groq.default)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string>(() => newId())
  const scrollEndRef = useRef<HTMLDivElement>(null)
  const skipNextPersistRef = useRef(false)

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    setInput,
    stop,
    error,
    reload,
  } = useChat({
    api: "/api/chat",
    body: { provider, model },
    id: sessionId,
  })

  const history = useChatHistory()

  // Persist current conversation whenever it changes (debounced).
  // Skip while streaming to avoid hammering localStorage on every token.
  useEffect(() => {
    if (messages.length === 0) return
    if (isLoading) return
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }
    const t = setTimeout(() => {
      history.upsert({
        id: sessionId,
        title: deriveTitle(messages),
        messages,
        provider,
        model,
      })
    }, 400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading, sessionId, provider, model])

  // Auto-scroll
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
  const streamingLen = lastAssistant?.content?.length ?? 0
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, streamingLen])

  function handleProviderChange(p: ProviderKey, m: string) {
    setProvider(p)
    setModel(m)
  }

  const handleNewChat = useCallback(() => {
    skipNextPersistRef.current = true
    setMessages([])
    setInput("")
    setSessionId(newId())
  }, [setMessages, setInput])

  const handleSelectSession = useCallback(
    (id: string) => {
      const s = history.get(id)
      if (!s) return
      skipNextPersistRef.current = true
      setSessionId(s.id)
      setMessages(s.messages as any)
      setProvider(s.provider as ProviderKey)
      setModel(s.model)
    },
    [history, setMessages]
  )

  const handleDeleteSession = useCallback(
    (id: string) => {
      history.remove(id)
      if (id === sessionId) {
        skipNextPersistRef.current = true
        setMessages([])
        setSessionId(newId())
      }
    },
    [history, sessionId, setMessages]
  )

  const handleClearAll = useCallback(() => {
    history.clearAll()
    skipNextPersistRef.current = true
    setMessages([])
    setSessionId(newId())
  }, [history, setMessages])

  return (
    <div className="relative flex h-[100dvh] flex-col bg-background">
      <div className="bg-dot-grid pointer-events-none fixed inset-0 -z-10 opacity-[0.15]" />

      <Sidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        sessions={history.sessions}
        currentId={sessionId}
        onSelect={handleSelectSession}
        onNewChat={handleNewChat}
        onDelete={handleDeleteSession}
        onClearAll={handleClearAll}
        trigger={<span className="hidden" />}
      />

      <Header
        provider={provider}
        model={model}
        onChange={handleProviderChange}
        onNewChat={handleNewChat}
        canNewChat={messages.length > 0 && !isLoading}
        onOpenMenu={() => setSidebarOpen(true)}
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
                    isStreaming={
                      isLoading && i === messages.length - 1 && m.role === "assistant"
                    }
                    isLastAssistant={isLastAssistant}
                    onRegenerate={() => reload()}
                    onEditUser={
                      m.role === "user"
                        ? (newContent) => {
                            const truncated = messages.slice(0, i)
                            setMessages([
                              ...truncated,
                              { ...m, content: newContent, parts: undefined as any },
                            ])
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
                      <div className="mt-1 whitespace-pre-wrap text-xs opacity-90">
                        {error.message}
                      </div>
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

"use client"

import { useChat } from "ai/react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { countTokens, estimateCost, formatCost } from "@/lib/tokens"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { EmptyState } from "@/components/empty-state"
import { MessageBubble, isLikelyTruncated } from "@/components/message"
import { Composer } from "@/components/composer"
import { ShortcutsDialog } from "@/components/shortcuts-dialog"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"
import { useChatHistory, deriveTitle } from "@/hooks/use-chat-history"
import { useHotkeys } from "@/hooks/use-hotkeys"

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
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
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
    append,
  } = useChat({
    api: "/api/chat",
    body: { provider, model },
  })

  const history = useChatHistory()

  // Persist current conversation whenever it changes (debounced 600ms).
  // We persist mid-stream too so a refresh doesn't lose in-flight assistant text;
  // 600ms keeps localStorage writes manageable even with token-by-token updates.
  useEffect(() => {
    if (messages.length === 0) return
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
    }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, sessionId, provider, model])

  // Auto-scroll
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
  const streamingLen = lastAssistant?.content?.length ?? 0
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, streamingLen])

  // Token + cost estimate
  const tokenStats = useMemo(() => {
    let input = 0
    let output = 0
    for (const m of messages) {
      const t = countTokens(typeof m.content === "string" ? m.content : "")
      if (m.role === "assistant") output += t
      else input += t
    }
    const cost = formatCost(estimateCost(model, input, output))
    return { input, output, cost }
  }, [messages, model])

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

  useHotkeys([
    { combo: "mod+k", handler: () => setSidebarOpen((o) => !o), allowInInput: true },
    { combo: "mod+shift+o", handler: handleNewChat, allowInInput: true },
    {
      combo: "mod+/",
      handler: () => {
        const ta = document.querySelector<HTMLTextAreaElement>("textarea")
        ta?.focus()
      },
      allowInInput: true,
    },
    { combo: "escape", handler: () => { if (isLoading) stop() } },
    { combo: "shift+?", handler: () => setShortcutsOpen(true) },
  ])

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
        onRename={history.rename}
        onDuplicate={(id) => {
          const newId = history.duplicate(id)
          if (newId) handleSelectSession(newId)
        }}
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
                    wasTruncated={isLastAssistant && isLikelyTruncated(m.content)}
                    onContinue={
                      isLastAssistant
                        ? () =>
                            append({
                              role: "user",
                              content: "Tiếp tục từ chỗ bạn vừa dừng, không lặp lại.",
                            })
                        : undefined
                    }
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
            tokenStats={tokenStats}
          />
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            AI có thể tạo thông tin không chính xác · Powered by{" "}
            <span className="font-mono">{model}</span>
          </p>
        </div>
      </div>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  )
}

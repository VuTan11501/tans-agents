"use client"

import { useChat } from "ai/react"
import { useState, useRef, useEffect, useCallback, useMemo, type FormEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent } from "react"
import { countTokens, estimateCost, formatCost } from "@/lib/tokens"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { EmptyState } from "@/components/empty-state"
import { MessageBubble, isLikelyTruncated } from "@/components/message"
import { Composer } from "@/components/composer"
import { ReadingMode } from "@/components/reading-mode"
import { ShortcutsDialog } from "@/components/shortcuts-dialog"
import { ChatSearch } from "@/components/chat-search"
import { BulkActions } from "@/components/bulk-actions"
import { MemoryDialog } from "@/components/memory-dialog"
import { PromptLibraryDialog } from "@/components/prompt-library-dialog"
import { ErrorLogDialog } from "@/components/error-log-dialog"
import { AbCompare, type AbPaneState } from "@/components/ab-compare"
import { AbToggle, type AbModeState } from "@/components/ab-toggle"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"
import type { PersonaId } from "@/lib/personas"
import { buildSystemPrompt } from "@/lib/system-prompt"
import { useChatHistory, deriveTitle } from "@/hooks/use-chat-history"
import { useHotkeys } from "@/hooks/use-hotkeys"
import { extractFileText, fileToAttachment, isImageFile } from "@/lib/upload"
import { useMemory } from "@/hooks/use-memory"
import { useUserKeys } from "@/hooks/use-user-keys"
import { logError } from "@/lib/error-log"
import { streamAbComparison, type AbStreamHandle } from "@/lib/ab"
import { getActiveCollectionId, RAG_ACTIVE_COLLECTION_EVENT } from "@/lib/collections"
import { cn } from "@/lib/utils"
import type { PromptItem } from "@/hooks/use-prompts"

function newId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  )
}

function messageDomId(message: any, index: number) {
  return String(message.id ?? index)
}

type PendingMessage = {
  content: string
  attachments?: any[]
}

type ActiveAbCompare = {
  id: string
  a: AbPaneState
  b: AbPaneState
}

const AB_STORAGE_KEY = "tans:ab"

export function Chat() {
  const [provider, setProvider] = useState<ProviderKey>("groq")
  const [model, setModel] = useState<string>(PROVIDERS.groq.default)
  const [persona, setPersona] = useState<PersonaId>("default")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false)
  const [errorLogOpen, setErrorLogOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [pendingFirstMessage, setPendingFirstMessage] = useState<PendingMessage | null>(null)
  const [sessionId, setSessionId] = useState<string>(() => newId())
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [abMode, setAbMode] = useState<AbModeState>(() => {
    if (typeof window === "undefined") {
      return { enabled: false, modelA: PROVIDERS.groq.default, modelB: PROVIDERS.google.default }
    }
    try {
      const saved = JSON.parse(window.localStorage.getItem(AB_STORAGE_KEY) || "null")
      return {
        enabled: !!saved?.enabled,
        modelA: typeof saved?.modelA === "string" ? saved.modelA : PROVIDERS.groq.default,
        modelB: typeof saved?.modelB === "string" ? saved.modelB : PROVIDERS.google.default,
      }
    } catch {
      return { enabled: false, modelA: PROVIDERS.groq.default, modelB: PROVIDERS.google.default }
    }
  })
  const [activeAb, setActiveAb] = useState<ActiveAbCompare | null>(null)
  const [ragActiveCollectionId, setRagActiveCollectionId] = useState<string | null>(() => getActiveCollectionId())
  const chatRootRef = useRef<HTMLDivElement>(null)
  const scrollEndRef = useRef<HTMLDivElement>(null)
  const skipNextPersistRef = useRef(false)
  const messagesRef = useRef<any[]>([])
  const abStreamRef = useRef<AbStreamHandle | null>(null)

  const { memory, setAbout, addFact, removeFact, clearAll } = useMemory()
  const { keys: userKeys, setKey: setUserKey, clearAll: clearUserKeys } = useUserKeys()
  const personaSystemPrompt = useMemo(
    () => buildSystemPrompt({ persona, memory }),
    [persona, memory]
  )
  const history = useChatHistory()
  const currentSession = useMemo(
    () => history.sessions.find((session) => session.id === sessionId),
    [history.sessions, sessionId]
  )
  const enabledTools = currentSession?.enabledTools
  const effectiveAbEnabled = abMode.enabled && !ragActiveCollectionId
  const isAbLoading = !!activeAb && (!activeAb.a.done || !activeAb.b.done)

  const {
    messages,
    input,
    handleInputChange,
    isLoading,
    setMessages,
    setInput,
    stop,
    error,
    reload,
    append,
  } = useChat({
    api: "/api/chat",
    body: { provider, model, userKeys, enabledTools, persona, memory: { about: memory.about, facts: memory.facts }, personaSystemPrompt },
    onError: (err) => {
      const lastMessage = [...messagesRef.current]
        .reverse()
        .find((message) => message.role === "user")?.content

      logError({
        time: Date.now(),
        request: { provider, model, lastMessage: typeof lastMessage === "string" ? lastMessage : undefined },
        error: err.message,
      })
    },
    onFinish: () => {
      window.dispatchEvent(new CustomEvent("tans:assistant-finished"))
    },
  })

  useEffect(() => {
    messagesRef.current = messages as any[]
  }, [messages])

  useEffect(() => {
    window.localStorage.setItem(AB_STORAGE_KEY, JSON.stringify(abMode))
  }, [abMode])

  useEffect(() => {
    const syncRag = () => setRagActiveCollectionId(getActiveCollectionId())
    window.addEventListener(RAG_ACTIVE_COLLECTION_EVENT, syncRag)
    window.addEventListener("storage", syncRag)
    return () => {
      window.removeEventListener(RAG_ACTIVE_COLLECTION_EVENT, syncRag)
      window.removeEventListener("storage", syncRag)
    }
  }, [])

  useEffect(() => {
    function handleOpenPrompts() {
      setPromptLibraryOpen(true)
    }

    window.addEventListener("tans-agents:open-prompts", handleOpenPrompts)
    return () => window.removeEventListener("tans-agents:open-prompts", handleOpenPrompts)
  }, [])

  const displayMessages = useMemo(
    () => messages.map((message, index) => ({ message, index })).filter(({ message }) => message.role !== "system"),
    [messages]
  )
  const searchRefreshKey = useMemo(
    () => displayMessages.map(({ message }) => `${message.id}:${typeof message.content === "string" ? message.content.length : 0}`).join("|"),
    [displayMessages]
  )
  const hasVisibleMessages = displayMessages.length > 0
  const selectedMessages = useMemo(
    () => displayMessages.filter(({ message, index }) => selectedIds.has(messageDomId(message, index))),
    [displayMessages, selectedIds]
  )

  useEffect(() => {
    const selected = selectedIds
    const nodes = document.querySelectorAll<HTMLElement>("[data-chat-messages] [data-message-id]")
    nodes.forEach((node) => {
      const id = node.dataset.messageId
      if (id && selected.has(id)) node.setAttribute("data-selected", "true")
      else node.removeAttribute("data-selected")
    })
    return () => nodes.forEach((node) => node.removeAttribute("data-selected"))
  }, [displayMessages, selectedIds])

  useEffect(() => {
    if (selectionMode) return
    setSelectedIds(new Set())
  }, [selectionMode])

  useEffect(() => {
    setSelectedIds((current) => {
      const visible = new Set(displayMessages.map(({ message, index }) => messageDomId(message, index)))
      const next = new Set([...current].filter((id) => visible.has(id)))
      return next.size === current.size ? current : next
    })
  }, [displayMessages])

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
        persona,
      } as any)
    }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, sessionId, provider, model, persona])

  // Auto-scroll
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
  const streamingLen = lastAssistant?.content?.length ?? 0
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, streamingLen])

  useEffect(() => {
    if (!pendingFirstMessage) return
    if (!messages.some((message) => message.role === "system")) return

    const pending = pendingFirstMessage
    setPendingFirstMessage(null)
    void append({
      role: "user",
      content: pending.content,
      experimental_attachments: pending.attachments,
    } as any)
  }, [append, messages, pendingFirstMessage])

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

  const startAbComparison = useCallback(
    (nextMessages: any[]) => {
      abStreamRef.current?.abort()
      const compareId = newId()
      setActiveAb({
        id: compareId,
        a: { model: abMode.modelA, content: "", done: false },
        b: { model: abMode.modelB, content: "", done: false },
      })

      const patchAb = (mutator: (current: ActiveAbCompare) => ActiveAbCompare) => {
        setActiveAb((current) => {
          if (!current || current.id !== compareId) return current
          return mutator(current)
        })
      }
      const handleError = (side: "a" | "b", err: Error) => {
        logError({
          time: Date.now(),
          request: { provider, model: side === "a" ? abMode.modelA : abMode.modelB, lastMessage: nextMessages.at(-1)?.content },
          error: err.message,
        })
        patchAb((current) => ({
          ...current,
          [side]: { ...current[side], done: true, error: err.message },
        }))
      }

      const handle = streamAbComparison({
        messages: nextMessages,
        modelA: abMode.modelA,
        modelB: abMode.modelB,
        body: { userKeys, enabledTools, persona, memory: { about: memory.about, facts: memory.facts }, personaSystemPrompt },
        callbacks: {
          onChunkA: (chunk) => patchAb((current) => ({ ...current, a: { ...current.a, content: current.a.content + chunk } })),
          onChunkB: (chunk) => patchAb((current) => ({ ...current, b: { ...current.b, content: current.b.content + chunk } })),
          onDoneA: () => patchAb((current) => ({ ...current, a: { ...current.a, done: true } })),
          onDoneB: () => patchAb((current) => ({ ...current, b: { ...current.b, done: true } })),
          onErrorA: (err) => handleError("a", err),
          onErrorB: (err) => handleError("b", err),
        },
      })
      abStreamRef.current = handle
      void handle.done.finally(() => {
        if (abStreamRef.current === handle) abStreamRef.current = null
      })
    },
    [abMode.modelA, abMode.modelB, enabledTools, memory.about, memory.facts, model, persona, personaSystemPrompt, provider, userKeys]
  )

  const sendUserMessage = useCallback(
    async (userMessage: PendingMessage) => {
      setInput("")
      setAttachedFiles([])

      if (effectiveAbEnabled) {
        const baseMessages = hasVisibleMessages
          ? messages
          : [{ id: newId(), role: "system", content: personaSystemPrompt } as any]
        const nextMessages = [
          ...baseMessages,
          {
            id: newId(),
            role: "user",
            content: userMessage.content,
            experimental_attachments: userMessage.attachments,
          } as any,
        ]
        setPendingFirstMessage(null)
        setMessages(nextMessages as any)
        startAbComparison(nextMessages)
        return
      }

      if (!hasVisibleMessages) {
        setMessages([{ id: newId(), role: "system", content: personaSystemPrompt } as any])
        setPendingFirstMessage(userMessage)
        return
      }

      await append({
        role: "user",
        content: userMessage.content,
        experimental_attachments: userMessage.attachments,
      } as any)
    },
    [append, effectiveAbEnabled, hasVisibleMessages, messages, personaSystemPrompt, setInput, setMessages, startAbComparison]
  )

  useEffect(() => {
    function handleVoiceSend(event: Event) {
      if (isLoading || isAbLoading) return
      const text = (event as CustomEvent<{ text?: unknown }>).detail?.text
      if (typeof text !== "string" || !text.trim()) return
      void sendUserMessage({ content: text.trim() })
    }

    window.addEventListener("tans:voice-send", handleVoiceSend)
    return () => window.removeEventListener("tans:voice-send", handleVoiceSend)
  }, [isAbLoading, isLoading, sendUserMessage])

  function handleSelectPrompt(prompt: PromptItem) {
    setInput((current) => {
      const trimmed = current.trimEnd()
      return trimmed ? `${trimmed}\n\n${prompt.body}` : prompt.body
    })
  }

  const handleNewChat = useCallback(() => {
    abStreamRef.current?.abort()
    abStreamRef.current = null
    setActiveAb(null)
    skipNextPersistRef.current = true
    setMessages([])
    setInput("")
    setAttachedFiles([])
    setPendingFirstMessage(null)
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
    { combo: "escape", handler: () => { if (isAbLoading) abStreamRef.current?.abort(); else if (isLoading) stop() } },
    { combo: "shift+?", handler: () => setShortcutsOpen(true) },
  ])

  const handleSelectSession = useCallback(
    (id: string) => {
      const s = history.get(id)
      if (!s) return
      abStreamRef.current?.abort()
      abStreamRef.current = null
      setActiveAb(null)
      skipNextPersistRef.current = true
      setAttachedFiles([])
      setSessionId(s.id)
      setMessages(s.messages as any)
      setProvider(s.provider as ProviderKey)
      setModel(s.model)
      setPersona(((s as any).persona as PersonaId) ?? "default")
    },
    [history, setMessages]
  )

  const handleEditMessage = useCallback(
    (index: number, newContent: string) => {
      const original = messages[index]
      const trimmed = newContent.trim()
      if (!original || original.role !== "user" || !trimmed) return
      if (isLoading) stop()

      const branchId = newId()
      const beforeEdited = messages.slice(0, index)
      const editedMessage = { ...original, id: newId(), content: trimmed, parts: undefined as any }
      const branchMessages = [...beforeEdited, editedMessage]

      history.upsert({
        id: branchId,
        title: deriveTitle(branchMessages),
        messages: branchMessages,
        provider,
        model,
        persona,
        parentId: sessionId,
        tags: currentSession?.tags,
        enabledTools: currentSession?.enabledTools,
      } as any)

      skipNextPersistRef.current = true
      setAttachedFiles([])
      setPendingFirstMessage(null)
      setInput("")
      setSessionId(branchId)
      setMessages(beforeEdited as any)
      setTimeout(() => {
        void append({
          role: "user",
          content: trimmed,
          experimental_attachments: (original as any).experimental_attachments,
        } as any)
      }, 0)
    },
    [append, currentSession?.enabledTools, currentSession?.tags, history, isLoading, messages, model, persona, provider, sessionId, setInput, setMessages, stop]
  )

  const handleDeleteSession = useCallback(
    (id: string) => {
      history.remove(id)
      if (id === sessionId) {
        abStreamRef.current?.abort()
        abStreamRef.current = null
        setActiveAb(null)
        skipNextPersistRef.current = true
        setMessages([])
        setAttachedFiles([])
        setPendingFirstMessage(null)
        setSessionId(newId())
      }
    },
    [history, sessionId, setMessages]
  )

  const handleClearAll = useCallback(() => {
    history.clearAll()
    abStreamRef.current?.abort()
    abStreamRef.current = null
    setActiveAb(null)
    skipNextPersistRef.current = true
    setMessages([])
    setAttachedFiles([])
    setPendingFirstMessage(null)
    setSessionId(newId())
  }, [history, setMessages])

  const handleChatPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    if (target?.closest("input,textarea,button,a,[role='button'],[contenteditable='true']")) return
    chatRootRef.current?.focus({ preventScroll: true })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setSelectionMode(false)
  }, [])

  const handleChatKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape" && selectionMode) {
        event.preventDefault()
        clearSelection()
        return
      }
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "f") {
        if (!hasVisibleMessages) return
        event.preventDefault()
        setSearchOpen(true)
      }
    },
    [clearSelection, hasVisibleMessages, selectionMode]
  )

  const handleMessagesClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!selectionMode && !(event.metaKey || event.ctrlKey)) return
    const target = event.target as HTMLElement | null
    if (target?.closest("input,textarea,button,a,[role='button'],[contenteditable='true']")) return
    const messageNode = target?.closest<HTMLElement>("[data-message-id]")
    if (!messageNode || !event.currentTarget.contains(messageNode)) return
    const id = messageNode.dataset.messageId
    if (!id) return
    event.preventDefault()
    event.stopPropagation()
    setSelectionMode(true)
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [selectionMode])

  const getSelectedText = useCallback(() => selectedMessages.map(({ message }) => (typeof message.content === "string" ? message.content.trim() : "")).filter(Boolean).join("\n\n---\n\n"), [selectedMessages])

  const handleCopySelected = useCallback(() => {
    const text = getSelectedText()
    if (text) void navigator.clipboard?.writeText(text)
  }, [getSelectedText])

  const handleExportSelected = useCallback(() => {
    const markdown = selectedMessages.map(({ message }) => {
      const role = message.role === "assistant" ? "Assistant" : message.role === "user" ? "User" : String(message.role)
      const content = typeof message.content === "string" ? message.content.trim() : ""
      return `## ${role}\n\n${content}`
    }).filter((block) => block.trim()).join("\n\n---\n\n")
    if (!markdown) return
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `tans-agents-selected-${new Date().toISOString().slice(0, 10)}.md`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }, [selectedMessages])

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return
    const next = messages.filter((message, index) => !selectedIds.has(messageDomId(message, index)))
    setMessages((next.some((message) => message.role !== "system") ? next : []) as any)
    clearSelection()
  }, [clearSelection, messages, selectedIds, setMessages])

  const handleComposerSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (isLoading || isAbLoading) return

      const textBlocks: string[] = []
      const attachments: any[] = []

      for (const file of attachedFiles) {
        if (isImageFile(file)) {
          attachments.push(await fileToAttachment(file))
          continue
        }

        const text = await extractFileText(file)
        if (text.trim()) {
          textBlocks.push(`[Nội dung file ${file.name}]:\n${text.trim()}`)
        }
      }

      const content = [textBlocks.join("\n\n"), input.trim()].filter(Boolean).join("\n\n")
      if (!content && attachments.length === 0) return

      const userMessage: PendingMessage = {
        content: content || "Hãy phân tích các tệp đính kèm.",
        attachments: attachments.length > 0 ? attachments : undefined,
      }

      await sendUserMessage(userMessage)
    },
    [attachedFiles, input, isAbLoading, isLoading, sendUserMessage]
  )

  const handleStopAb = useCallback(() => {
    abStreamRef.current?.abort()
    abStreamRef.current = null
  }, [])

  const handlePickAb = useCallback(
    (side: "a" | "b") => {
      if (!activeAb) return
      const content = activeAb[side].content.trim()
      if (!content) return
      setMessages((current) => [
        ...current,
        { id: newId(), role: "assistant", content } as any,
      ] as any)
      setActiveAb(null)
      abStreamRef.current = null
      window.dispatchEvent(new CustomEvent("tans:assistant-finished"))
    },
    [activeAb, setMessages]
  )

  return (
    <div
      ref={chatRootRef}
      tabIndex={-1}
      className="relative flex h-[100dvh] flex-col bg-background outline-none"
      onPointerDown={handleChatPointerDown}
      onKeyDown={handleChatKeyDown}
    >
      <div className="bg-dot-grid pointer-events-none fixed inset-0 -z-10 opacity-[0.15]" />

      <div data-sidebar>
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
      </div>

      <div data-header-chrome>
        <Header
          provider={provider}
          model={model}
          persona={persona}
          onChange={handleProviderChange}
          onPersonaChange={setPersona}
          onNewChat={handleNewChat}
          canNewChat={hasVisibleMessages && !isLoading && !isAbLoading}
          onOpenMenu={() => setSidebarOpen(true)}
          onOpenMemory={() => setMemoryOpen(true)}
          onOpenPromptLibrary={() => setPromptLibraryOpen(true)}
          onOpenErrorLog={() => setErrorLogOpen(true)}
          userKeys={userKeys}
          setUserKey={setUserKey}
          clearUserKeys={clearUserKeys}
        />
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className={cn("mx-auto px-4", activeAb ? "max-w-5xl" : "max-w-3xl")}>
          <div className="pt-3">
            <AbToggle
              value={abMode}
              onChange={setAbMode}
              disabled={!!ragActiveCollectionId}
              notice={ragActiveCollectionId ? "A/B tạm tắt khi RAG đang active." : undefined}
            />
          </div>
          {hasVisibleMessages && (
            <div className="sticky top-3 z-20 mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (selectionMode) clearSelection()
                  else setSelectionMode(true)
                }}
                className="rounded-full border bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur hover:bg-muted"
              >
                {selectionMode ? "Hủy" : "Chọn nhiều"}
              </button>
            </div>
          )}
          {!hasVisibleMessages ? (
            <EmptyState onPick={(t) => setInput(t)} />
          ) : (
            <div className="space-y-8 py-8" data-chat-messages data-selection-mode={selectionMode ? "true" : undefined} onClick={handleMessagesClick}>
              {displayMessages.map(({ message: m, index: i }) => {
                const isLastAssistant =
                  m.role === "assistant" && i === messages.length - 1 && !isLoading
                return (
                  <div key={m.id} data-message-id={messageDomId(m, i)}>
                    <MessageBubble
                      role={m.role}
                      content={m.content}
                      parts={m.parts}
                      index={i}
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
                      onEdit={m.role === "user" ? handleEditMessage : undefined}
                    />
                  </div>
                )
              })}
              {activeAb && <AbCompare a={activeAb.a} b={activeAb.b} onPick={handlePickAb} />}
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
            onSubmit={handleComposerSubmit}
            onStop={isAbLoading ? handleStopAb : stop}
            isStreaming={isLoading || isAbLoading}
            tokenStats={tokenStats}
            messages={messages}
            model={model}
            files={attachedFiles}
            onFilesChange={setAttachedFiles}
          />
          <p className="mt-2 text-center text-[11px] text-muted-foreground" data-composer-extra>
            AI có thể tạo thông tin không chính xác · Powered by{" "}
            <span className="font-mono">{model}</span>
          </p>
        </div>
      </div>

      <ReadingMode />
      <BulkActions
        selectedCount={selectedIds.size}
        selectionMode={selectionMode}
        onCopy={handleCopySelected}
        onExportMarkdown={handleExportSelected}
        onDelete={handleDeleteSelected}
        onClear={clearSelection}
      />
      <ChatSearch open={searchOpen} onOpenChange={setSearchOpen} refreshKey={searchRefreshKey} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <MemoryDialog
        open={memoryOpen}
        onOpenChange={setMemoryOpen}
        memory={memory}
        setAbout={setAbout}
        addFact={addFact}
        removeFact={removeFact}
        clearAll={clearAll}
      />
      <PromptLibraryDialog
        open={promptLibraryOpen}
        onOpenChange={setPromptLibraryOpen}
        onSelect={handleSelectPrompt}
      />
      <ErrorLogDialog open={errorLogOpen} onOpenChange={setErrorLogOpen} />
    </div>
  )
}

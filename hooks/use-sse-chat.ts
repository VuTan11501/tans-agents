"use client"

import { useCallback, useRef, useState } from "react"

// SSE-based chat hook. Drop-in subset of `useChat` from `ai/react` that
// reads a raw `text/event-stream` from `/api/chat-sse` and parses
// OpenAI-compatible `data: {choices:[{delta:{content:"..."},finish_reason:null}]}`
// lines. Inspired by the reference parser in
// `C:\Users\Admin\Desktop\Code\docs\js\ai-agent.js` (lines 982-1043).
//
// Why a custom hook? `useChat` from the Vercel AI SDK uses its own data-stream
// protocol (not pure SSE). This hook gives us:
//   * real `text/event-stream` Content-Type (visible in DevTools Network),
//   * incremental text deltas immediately readable as they arrive,
//   * easy interop with any OpenAI-compatible SSE consumer.

export type ChatRole = "system" | "user" | "assistant" | "tool"

export interface SseMessage {
  id: string
  role: ChatRole
  content: string
  createdAt?: number
  toolCalls?: Array<{ id: string; name: string; arguments: string }>
  toolResults?: Array<{ id: string; name: string; result: unknown }>
}

export interface UseSseChatOptions {
  api?: string
  initialMessages?: SseMessage[]
  body?: Record<string, unknown>
  onError?: (err: Error) => void
  onFinish?: (msg: SseMessage) => void
}

interface AppendOptions {
  body?: Record<string, unknown>
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function useSseChat(opts: UseSseChatOptions = {}) {
  const { api = "/api/chat-sse", initialMessages = [], body: baseBody, onError, onFinish } = opts

  const [messages, setMessages] = useState<SseMessage[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsLoading(false)
  }, [])

  const runStream = useCallback(
    async (allMessages: SseMessage[], extra?: Record<string, unknown>) => {
      setIsLoading(true)
      setError(null)

      const controller = new AbortController()
      abortRef.current?.abort()
      abortRef.current = controller

      const assistantId = uid()
      const assistant: SseMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        toolCalls: [],
        toolResults: [],
      }
      setMessages((prev) => [...prev, assistant])

      const payload = {
        ...(baseBody ?? {}),
        ...(extra ?? {}),
        // Strip client-only fields from messages.
        messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
      }

      try {
        const res = await fetch(api, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(payload),
        })

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "")
          throw new Error(text || `HTTP ${res.status}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder("utf-8")
        let buffer = ""
        let finishedNormally = false

        // Helper to update the last assistant message in place.
        const patchAssistant = (mutator: (m: SseMessage) => SseMessage) => {
          setMessages((prev) => {
            const next = [...prev]
            const idx = next.findIndex((m) => m.id === assistantId)
            if (idx >= 0) next[idx] = mutator(next[idx])
            return next
          })
        }

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // SSE frames are separated by blank lines (\n\n).
          let sep
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sep)
            buffer = buffer.slice(sep + 2)
            const lines = frame.split("\n")
            for (const raw of lines) {
              const line = raw.trim()
              if (!line || line.startsWith(":")) continue
              if (!line.startsWith("data:")) continue
              const data = line.slice(5).trim()
              if (data === "[DONE]") {
                finishedNormally = true
                continue
              }
              try {
                const json = JSON.parse(data)
                if (json.error) {
                  throw new Error(json.error.message ?? "stream error")
                }
                const delta = json.choices?.[0]?.delta
                if (delta?.content) {
                  patchAssistant((m) => ({ ...m, content: m.content + delta.content }))
                }
                if (Array.isArray(delta?.tool_calls)) {
                  patchAssistant((m) => ({
                    ...m,
                    toolCalls: [
                      ...(m.toolCalls ?? []),
                      ...delta.tool_calls.map((tc: any) => ({
                        id: tc.id ?? uid(),
                        name: tc.function?.name ?? "tool",
                        arguments: tc.function?.arguments ?? "",
                      })),
                    ],
                  }))
                }
                if (Array.isArray(delta?.tool_results)) {
                  patchAssistant((m) => ({
                    ...m,
                    toolResults: [...(m.toolResults ?? []), ...delta.tool_results],
                  }))
                }
              } catch (e: any) {
                throw e instanceof Error ? e : new Error(String(e))
              }
            }
          }
        }

        if (onFinish) {
          const final = messagesRef.current.find((m) => m.id === assistantId)
          if (final) onFinish(final)
        }
        if (!finishedNormally) {
          // Stream ended without [DONE]; treat as soft truncation, not an error.
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        onError?.(e)
        // Remove empty assistant placeholder on hard failure.
        setMessages((prev) => prev.filter((m) => !(m.id === assistantId && !m.content)))
      } finally {
        setIsLoading(false)
        abortRef.current = null
      }
    },
    [api, baseBody, onError, onFinish]
  )

  const append = useCallback(
    async (msg: Omit<SseMessage, "id"> & { id?: string }, opts?: AppendOptions) => {
      const m: SseMessage = { id: msg.id ?? uid(), createdAt: Date.now(), ...msg }
      const next = [...messagesRef.current, m]
      setMessages(next)
      await runStream(next, opts?.body)
    },
    [runStream]
  )

  const reload = useCallback(async () => {
    // Drop the trailing assistant message (if any) and re-stream the conversation.
    const trimmed = [...messagesRef.current]
    while (trimmed.length > 0 && trimmed[trimmed.length - 1].role === "assistant") {
      trimmed.pop()
    }
    setMessages(trimmed)
    await runStream(trimmed)
  }, [runStream])

  const handleInputChange = useCallback(
    (e: { target: { value: string } } | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput((e as any).target.value)
    },
    []
  )

  const handleSubmit = useCallback(
    async (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.()
      const content = input.trim()
      if (!content || isLoading) return
      setInput("")
      await append({ role: "user", content })
    },
    [append, input, isLoading]
  )

  return {
    messages,
    setMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    append,
    reload,
    stop,
    isLoading,
    error,
  }
}

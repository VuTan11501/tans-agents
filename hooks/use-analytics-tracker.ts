"use client"

import { useEffect, useRef } from "react"
import { logEvent } from "@/lib/analytics"
import { estimateCost, estimateTokens } from "@/lib/cost-estimator"
import { recordTtft } from "@/lib/latency-tracker"
import { logUsage } from "@/lib/usage-log"

type ChatMessage = {
  id?: string
  role?: string
  content?: unknown
  model?: string
  provider?: string
  parts?: Array<{
    type?: string
    text?: string
    toolInvocation?: {
      toolName?: string
      state?: string
    }
  }>
}

type UseChatAnalyticsResult = {
  messages?: ChatMessage[]
  isLoading?: boolean
  error?: Error | string | null
}

function messageKey(message: ChatMessage, index: number) {
  if (message.id) return message.id
  const content = typeof message.content === "string" ? message.content.slice(0, 80) : ""
  return `${index}:${message.role ?? "unknown"}:${content}`
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value
  if (!Array.isArray(value)) return ""
  return value
    .map((part) => {
      if (typeof part === "string") return part
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text
      return ""
    })
    .filter(Boolean)
    .join("\n")
}

function getMessageText(message: ChatMessage): string {
  const contentText = extractText(message.content)
  if (contentText) return contentText
  return (message.parts ?? []).map((part) => (part.type === "text" && part.text ? part.text : "")).filter(Boolean).join("\n")
}

export function useAnalyticsTracker({ messages = [], isLoading = false, error }: UseChatAnalyticsResult) {
  const initializedRef = useRef(false)
  const loggedMessagesRef = useRef(new Set<string>())
  const loggedToolsRef = useRef(new Set<string>())
  const loggedTtftRef = useRef(new Set<string>())
  const lastUserSentAtRef = useRef<number | null>(null)
  const lastErrorRef = useRef<string | null>(null)

  useEffect(() => {
    if (!initializedRef.current) {
      for (let index = 0; index < messages.length; index += 1) {
        loggedMessagesRef.current.add(messageKey(messages[index], index))
      }
      initializedRef.current = true
      return
    }

    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index]
      const key = messageKey(message, index)

      if (message.role === "user" && !loggedMessagesRef.current.has(key)) {
        const now = Date.now()
        loggedMessagesRef.current.add(key)
        lastUserSentAtRef.current = now
        logEvent({
          time: now,
          type: "message_sent",
          model: message.model,
          provider: message.provider,
        })
      }

      // TTFT: first time an assistant message appears (even mid-stream).
      if (
        message.role === "assistant" &&
        !loggedTtftRef.current.has(key) &&
        lastUserSentAtRef.current &&
        typeof message.content === "string" &&
        message.content.length > 0
      ) {
        const now = Date.now()
        const ttftMs = now - lastUserSentAtRef.current
        loggedTtftRef.current.add(key)
        if (message.provider && message.model) {
          recordTtft({
            provider: message.provider,
            model: message.model,
            ttftMs,
            at: now,
          })
        }
      }

      if (message.role === "assistant" && !isLoading && !loggedMessagesRef.current.has(key)) {
        const now = Date.now()
        const latencyMs = lastUserSentAtRef.current ? now - lastUserSentAtRef.current : undefined
        const previousUser = messages.slice(0, index).reverse().find((item) => item.role === "user")
        const provider = message.provider ?? previousUser?.provider ?? "unknown"
        const model = message.model ?? previousUser?.model ?? "_default"
        const inputTokens = estimateTokens(previousUser ? getMessageText(previousUser) : "")
        const outputTokens = estimateTokens(getMessageText(message))
        loggedMessagesRef.current.add(key)
        logEvent({
          time: now,
          type: "message_received",
          model: message.model,
          provider: message.provider,
          latencyMs,
        })
        logUsage({
          ts: now,
          provider,
          model,
          inputTokens,
          outputTokens,
          costUsd: estimateCost(inputTokens, outputTokens, model),
        })
      }

      for (const [partIndex, part] of (message.parts ?? []).entries()) {
        if (part.type !== "tool-invocation") continue
        const tool = part.toolInvocation?.toolName
        if (!tool || part.toolInvocation?.state !== "result") continue

        const toolKey = `${key}:tool:${partIndex}:${tool}`
        if (loggedToolsRef.current.has(toolKey)) continue

        loggedToolsRef.current.add(toolKey)
        logEvent({
          time: Date.now(),
          type: "tool_call",
          tool,
          model: message.model,
          provider: message.provider,
        })
      }
    }
  }, [messages, isLoading])

  useEffect(() => {
    if (!error) return

    const message = typeof error === "string" ? error : error.message
    if (!message || message === lastErrorRef.current) return

    lastErrorRef.current = message
    logEvent({ time: Date.now(), type: "error" })
  }, [error])
}

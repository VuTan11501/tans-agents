"use client"
import { useCallback, useEffect, useState } from "react"

export interface ChatSession {
  id: string
  title: string
  messages: any[]
  provider: string
  model: string
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = "tans-agents:chat-history-v1"
const MAX_SESSIONS = 50

function read(): ChatSession[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function write(sessions: ChatSession[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)))
  } catch {
    // quota exceeded — drop oldest half and retry once
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(sessions.slice(0, Math.floor(MAX_SESSIONS / 2)))
      )
    } catch {}
  }
}

export function deriveTitle(messages: any[]): string {
  const firstUser = messages.find((m) => m.role === "user")
  const text = (firstUser?.content || "").toString().trim().replace(/\s+/g, " ")
  if (!text) return "Cuộc trò chuyện mới"
  return text.length > 50 ? text.slice(0, 47) + "…" : text
}

/**
 * Hook for managing a list of saved chat sessions in localStorage,
 * ChatGPT-style. Returns sessions sorted by updatedAt desc, plus
 * mutators. Subscribes to the storage event so multiple tabs stay in sync.
 */
export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([])

  useEffect(() => {
    setSessions(read())
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSessions(read())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const upsert = useCallback(
    (session: Omit<ChatSession, "createdAt" | "updatedAt"> & { createdAt?: number }) => {
      const now = Date.now()
      setSessions((prev) => {
        const existing = prev.find((s) => s.id === session.id)
        const merged: ChatSession = {
          ...session,
          createdAt: existing?.createdAt ?? session.createdAt ?? now,
          updatedAt: now,
        }
        const next = [merged, ...prev.filter((s) => s.id !== session.id)]
        write(next)
        return next
      })
    },
    []
  )

  const remove = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id)
      write(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setSessions([])
    write([])
  }, [])

  const get = useCallback((id: string) => sessions.find((s) => s.id === id), [sessions])

  return { sessions, upsert, remove, clearAll, get }
}

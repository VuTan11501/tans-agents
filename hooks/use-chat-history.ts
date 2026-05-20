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
  pinned?: boolean
  tags?: string[]
  enabledTools?: string[]
  parentId?: string
  branches?: string[]
}

export interface BranchTree {
  session: ChatSession
  children: BranchTree[]
}

const STORAGE_KEY = "tans-agents:chat-history-v1"
const HISTORY_CHANGED_EVENT = "tans-agents:chat-history-changed"
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

function notifyChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(HISTORY_CHANGED_EVENT))
}

function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)))
}

function mutateStoredSessions(mutator: (sessions: ChatSession[]) => ChatSession[]) {
  const next = mutator(read())
  write(next)
  notifyChanged()
  return next
}

export function togglePinnedSession(id: string) {
  mutateStoredSessions((sessions) =>
    sessions.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s))
  )
}

export function setSessionTags(id: string, tags: string[]) {
  const normalized = normalizeTags(tags)
  mutateStoredSessions((sessions) =>
    sessions.map((s) => (s.id === id ? { ...s, tags: normalized } : s))
  )
}

export function setSessionEnabledTools(id: string, enabledTools?: string[]) {
  mutateStoredSessions((sessions) =>
    sessions.map((s) => (s.id === id ? { ...s, enabledTools } : s))
  )
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
    const onHistoryChanged = () => setSessions(read())
    const onCloudPull = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.scope === "sessions") setSessions(read())
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener(HISTORY_CHANGED_EVENT, onHistoryChanged)
    window.addEventListener("tans:cloud-pull", onCloudPull as EventListener)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(HISTORY_CHANGED_EVENT, onHistoryChanged)
      window.removeEventListener("tans:cloud-pull", onCloudPull as EventListener)
    }
  }, [])

  const upsert = useCallback(
    (session: Omit<ChatSession, "createdAt" | "updatedAt"> & { createdAt?: number }) => {
      const now = Date.now()
      setSessions((prev) => {
        const existing = prev.find((s) => s.id === session.id)
        const merged: ChatSession = {
          ...existing,
          ...session,
          createdAt: existing?.createdAt ?? session.createdAt ?? now,
          updatedAt: now,
        }
        let next = [merged, ...prev.filter((s) => s.id !== session.id)]
        if (session.parentId && !existing) {
          next = next.map((s) =>
            s.id === session.parentId
              ? { ...s, branches: Array.from(new Set([...(s.branches ?? []), session.id])) }
              : s
          )
        }
        write(next)
        return next
      })
    },
    []
  )

  const remove = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev
        .filter((s) => s.id !== id)
        .map((s) =>
          s.branches?.includes(id)
            ? { ...s, branches: s.branches.filter((branchId) => branchId !== id) }
            : s
        )
      write(next)
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setSessions([])
    write([])
  }, [])

  const rename = useCallback((id: string, title: string) => {
    const t = title.trim().slice(0, 80) || "Cuộc trò chuyện mới"
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, title: t } : s))
      write(next)
      return next
    })
  }, [])

  const duplicate = useCallback((id: string): string | null => {
    let newId: string | null = null
    setSessions((prev) => {
      const orig = prev.find((s) => s.id === id)
      if (!orig) return prev
      newId =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      const { parentId: _parentId, branches: _branches, ...sessionCopy } = orig
      const copy: ChatSession = {
        ...sessionCopy,
        id: newId,
        title: orig.title + " (bản sao)",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const next = [copy, ...prev]
      write(next)
      return next
    })
    return newId
  }, [])

  const togglePin = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s))
      write(next)
      return next
    })
  }, [])

  const setTags = useCallback((id: string, tags: string[]) => {
    const normalized = normalizeTags(tags)
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, tags: normalized } : s))
      write(next)
      return next
    })
  }, [])

  const setEnabledTools = useCallback((id: string, enabledTools?: string[]) => {
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, enabledTools } : s))
      write(next)
      return next
    })
  }, [])

  const get = useCallback((id: string) => sessions.find((s) => s.id === id), [sessions])

  const getBranchTree = useCallback(
    (rootId: string): BranchTree | null => {
      const byId = new Map(sessions.map((s) => [s.id, s]))
      const build = (id: string): BranchTree | null => {
        const session = byId.get(id)
        if (!session) return null
        const branchIds = session.branches ?? sessions.filter((s) => s.parentId === id).map((s) => s.id)
        return {
          session,
          children: branchIds.map(build).filter((tree): tree is BranchTree => !!tree),
        }
      }
      return build(rootId)
    },
    [sessions]
  )

  return { sessions, upsert, remove, rename, duplicate, clearAll, togglePin, setTags, setEnabledTools, get, getBranchTree }
}

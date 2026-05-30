"use client"

import { useCallback, useEffect, useState } from "react"
import type { AutoRouteProfile } from "@/lib/router"
import type { MemoryState } from "@/lib/system-prompt"

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
  persona?: string
  memory?: MemoryState
  autoProfile?: AutoRouteProfile
  workspacePackId?: string
  smartRetry?: boolean
}

export interface BranchTree {
  session: ChatSession
  children: BranchTree[]
}

const STORAGE_KEY = "tans-agents:chat-history-v1"
const HISTORY_CHANGED_EVENT = "tans-agents:chat-history-changed"
const MAX_SESSIONS = 50
const DB_NAME = "tans-agents-db"
const DB_VERSION = 1
const DB_STORE = "kv"
const DB_HISTORY_KEY = "chat-history-v1"

function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))
}

function normalizeSession(value: any): ChatSession | null {
  if (!value || typeof value !== "object" || typeof value.id !== "string") return null
  if (!Array.isArray(value.messages)) return null
  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : "Cuộc trò chuyện mới",
    messages: value.messages,
    provider: typeof value.provider === "string" ? value.provider : "google",
    model: typeof value.model === "string" ? value.model : "gemini-2.5-flash",
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
    pinned: typeof value.pinned === "boolean" ? value.pinned : undefined,
    tags: Array.isArray(value.tags) ? normalizeTags(value.tags.filter((tag: unknown): tag is string => typeof tag === "string")) : undefined,
    enabledTools: Array.isArray(value.enabledTools)
      ? value.enabledTools.filter((tool: unknown): tool is string => typeof tool === "string")
      : undefined,
    parentId: typeof value.parentId === "string" ? value.parentId : undefined,
    branches: Array.isArray(value.branches)
      ? value.branches.filter((branch: unknown): branch is string => typeof branch === "string")
      : undefined,
    persona: typeof value.persona === "string" ? value.persona : undefined,
    memory: value.memory && typeof value.memory === "object" ? (value.memory as MemoryState) : undefined,
    autoProfile:
      value.autoProfile === "speed" || value.autoProfile === "balanced" || value.autoProfile === "quality"
        ? value.autoProfile
        : undefined,
    workspacePackId: typeof value.workspacePackId === "string" ? value.workspacePackId : undefined,
    smartRetry: typeof value.smartRetry === "boolean" ? value.smartRetry : undefined,
  }
}

function normalizeSessions(input: unknown): ChatSession[] {
  if (!Array.isArray(input)) return []
  return input
    .map((value) => normalizeSession(value))
    .filter((session): session is ChatSession => Boolean(session))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS)
}

function readLocal(): ChatSession[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return normalizeSessions(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeLocal(sessions: ChatSession[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)))
  } catch {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, Math.floor(MAX_SESSIONS / 2))))
    } catch {
      // ignore quota error
    }
  }
}

function notifyChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(HISTORY_CHANGED_EVENT))
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null)
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE)
    }
    request.onerror = () => resolve(null)
    request.onsuccess = () => resolve(request.result)
  })
}

async function readIndexedDb(): Promise<ChatSession[] | null> {
  const db = await openDb()
  if (!db) return null
  try {
    const result = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly")
      const store = tx.objectStore(DB_STORE)
      const request = store.get(DB_HISTORY_KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return normalizeSessions(result)
  } catch {
    return null
  } finally {
    db.close()
  }
}

async function writeIndexedDb(sessions: ChatSession[]) {
  const db = await openDb()
  if (!db) return
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite")
      const store = tx.objectStore(DB_STORE)
      const request = store.put(sessions.slice(0, MAX_SESSIONS), DB_HISTORY_KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch {
    // ignore IndexedDB write failures, localStorage remains fallback
  } finally {
    db.close()
  }
}

function persistSessions(sessions: ChatSession[]) {
  writeLocal(sessions)
  void writeIndexedDb(sessions)
}

function read(): ChatSession[] {
  return readLocal()
}

function mutateStoredSessions(mutator: (sessions: ChatSession[]) => ChatSession[]) {
  const next = mutator(read())
  persistSessions(next)
  notifyChanged()
  return next
}

export function togglePinnedSession(id: string) {
  mutateStoredSessions((sessions) => sessions.map((session) => (session.id === id ? { ...session, pinned: !session.pinned } : session)))
}

export function setSessionTags(id: string, tags: string[]) {
  const normalized = normalizeTags(tags)
  mutateStoredSessions((sessions) => sessions.map((session) => (session.id === id ? { ...session, tags: normalized } : session)))
}

export function setSessionEnabledTools(id: string, enabledTools?: string[]) {
  mutateStoredSessions((sessions) => sessions.map((session) => (session.id === id ? { ...session, enabledTools } : session)))
}

export function setSessionSmartRetry(id: string, smartRetry?: boolean) {
  mutateStoredSessions((sessions) => sessions.map((session) => (session.id === id ? { ...session, smartRetry } : session)))
}

export function deriveTitle(messages: any[]): string {
  const firstUser = messages.find((message) => message.role === "user")
  const text = (firstUser?.content || "").toString().trim().replace(/\s+/g, " ")
  if (!text) return "Cuộc trò chuyện mới"
  return text.length > 50 ? `${text.slice(0, 47)}…` : text
}

export function useChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([])

  useEffect(() => {
    const local = read()
    setSessions(local)
    void (async () => {
      const indexed = await readIndexedDb()
      if (!indexed) return
      if (indexed.length === 0 && local.length > 0) {
        await writeIndexedDb(local)
        return
      }
      if (indexed.length > 0) {
        setSessions(indexed)
        writeLocal(indexed)
      }
    })()

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSessions(read())
    }
    const onHistoryChanged = () => setSessions(read())
    const onCloudPull = (event: Event) => {
      const detail = (event as CustomEvent).detail
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

  const upsert = useCallback((session: Omit<ChatSession, "createdAt" | "updatedAt"> & { createdAt?: number }) => {
    const now = Date.now()
    setSessions((prev) => {
      const existing = prev.find((entry) => entry.id === session.id)
      const merged: ChatSession = {
        ...existing,
        ...session,
        createdAt: existing?.createdAt ?? session.createdAt ?? now,
        updatedAt: now,
      }
      let next = [merged, ...prev.filter((entry) => entry.id !== session.id)]
      if (session.parentId && !existing) {
        next = next.map((entry) =>
          entry.id === session.parentId
            ? { ...entry, branches: Array.from(new Set([...(entry.branches ?? []), session.id])) }
            : entry
        )
      }
      next = normalizeSessions(next)
      persistSessions(next)
      notifyChanged()
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev
        .filter((session) => session.id !== id)
        .map((session) =>
          session.branches?.includes(id)
            ? { ...session, branches: session.branches.filter((branchId) => branchId !== id) }
            : session
        )
      persistSessions(next)
      notifyChanged()
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    setSessions([])
    persistSessions([])
    notifyChanged()
  }, [])

  const rename = useCallback((id: string, title: string) => {
    const nextTitle = title.trim().slice(0, 80) || "Cuộc trò chuyện mới"
    setSessions((prev) => {
      const next = prev.map((session) => (session.id === id ? { ...session, title: nextTitle } : session))
      persistSessions(next)
      notifyChanged()
      return next
    })
  }, [])

  const duplicate = useCallback((id: string): string | null => {
    let newId: string | null = null
    setSessions((prev) => {
      const original = prev.find((session) => session.id === id)
      if (!original) return prev
      newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      const { parentId: _parentId, branches: _branches, ...sessionCopy } = original
      const copy: ChatSession = {
        ...sessionCopy,
        id: newId,
        title: `${original.title} (bản sao)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const next = normalizeSessions([copy, ...prev])
      persistSessions(next)
      notifyChanged()
      return next
    })
    return newId
  }, [])

  const togglePin = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.map((session) => (session.id === id ? { ...session, pinned: !session.pinned } : session))
      persistSessions(next)
      notifyChanged()
      return next
    })
  }, [])

  const setTags = useCallback((id: string, tags: string[]) => {
    const normalized = normalizeTags(tags)
    setSessions((prev) => {
      const next = prev.map((session) => (session.id === id ? { ...session, tags: normalized } : session))
      persistSessions(next)
      notifyChanged()
      return next
    })
  }, [])

  const setEnabledTools = useCallback((id: string, enabledTools?: string[]) => {
    setSessions((prev) => {
      const next = prev.map((session) => (session.id === id ? { ...session, enabledTools } : session))
      persistSessions(next)
      notifyChanged()
      return next
    })
  }, [])

  const setSmartRetry = useCallback((id: string, smartRetry?: boolean) => {
    setSessions((prev) => {
      const next = prev.map((session) => (session.id === id ? { ...session, smartRetry } : session))
      persistSessions(next)
      notifyChanged()
      return next
    })
  }, [])

  const get = useCallback((id: string) => sessions.find((session) => session.id === id), [sessions])

  const getBranchTree = useCallback(
    (rootId: string): BranchTree | null => {
      const byId = new Map(sessions.map((session) => [session.id, session]))
      const build = (id: string): BranchTree | null => {
        const session = byId.get(id)
        if (!session) return null
        const branchIds = session.branches ?? sessions.filter((entry) => entry.parentId === id).map((entry) => entry.id)
        return {
          session,
          children: branchIds.map(build).filter((tree): tree is BranchTree => Boolean(tree)),
        }
      }
      return build(rootId)
    },
    [sessions]
  )

  return {
    sessions,
    upsert,
    remove,
    rename,
    duplicate,
    clearAll,
    togglePin,
    setTags,
    setEnabledTools,
    setSmartRetry,
    get,
    getBranchTree,
  }
}

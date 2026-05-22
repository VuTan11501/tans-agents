"use client"
// Pinned messages — store per (sessionId, messageId)
// Listed across all sessions on /pinned page

const KEY = "tans-agents:pinned-messages-v1"

export interface PinnedMessage {
  sessionId: string
  messageId: string
  preview: string
  role: string
  pinnedAt: number
}

function read(): PinnedMessage[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function write(items: PinnedMessage[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 200)))
    window.dispatchEvent(new Event("tans:pinned-changed"))
  } catch {}
}

export function listPinned(): PinnedMessage[] {
  return read().sort((a, b) => b.pinnedAt - a.pinnedAt)
}

export function isPinned(sessionId: string, messageId: string): boolean {
  return read().some((p) => p.sessionId === sessionId && p.messageId === messageId)
}

export function togglePin(item: Omit<PinnedMessage, "pinnedAt">): boolean {
  const items = read()
  const existing = items.find((p) => p.sessionId === item.sessionId && p.messageId === item.messageId)
  if (existing) {
    write(items.filter((p) => !(p.sessionId === item.sessionId && p.messageId === item.messageId)))
    return false
  }
  const next: PinnedMessage = { ...item, pinnedAt: Date.now() }
  write([next, ...items])
  return true
}

export function clearSessionPins(sessionId: string) {
  write(read().filter((p) => p.sessionId !== sessionId))
}

export function clearAllPins() {
  write([])
}

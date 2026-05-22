"use client"
// Per-session notes — markdown notes attached to a session
// Stored as { [sessionId]: notesString } in localStorage

const KEY = "tans-agents:session-notes-v1"

function readAll(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeAll(notes: Record<string, string>) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(KEY, JSON.stringify(notes))
    window.dispatchEvent(new Event("tans:notes-changed"))
  } catch {}
}

export function getNotes(sessionId: string): string {
  return readAll()[sessionId] ?? ""
}

export function setNotes(sessionId: string, content: string) {
  const all = readAll()
  if (!content.trim()) {
    delete all[sessionId]
  } else {
    all[sessionId] = content.slice(0, 50_000)
  }
  writeAll(all)
}

export function hasNotes(sessionId: string): boolean {
  return Boolean(readAll()[sessionId])
}

export function listSessionsWithNotes(): { sessionId: string; preview: string; length: number }[] {
  const all = readAll()
  return Object.entries(all).map(([sessionId, content]) => ({
    sessionId,
    preview: content.slice(0, 100),
    length: content.length,
  }))
}

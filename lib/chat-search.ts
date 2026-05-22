"use client"
import type { ChatSession } from "@/hooks/use-chat-history"

export interface SearchHit {
  sessionId: string
  sessionTitle: string
  messageIndex: number
  role: string
  snippet: string
  matchStart: number
  matchEnd: number
  ts: number
}

const SNIPPET_RADIUS = 60

export function searchSessions(sessions: ChatSession[], query: string, maxHits = 50): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: SearchHit[] = []
  for (const s of sessions) {
    if (hits.length >= maxHits) break
    const titleIdx = s.title.toLowerCase().indexOf(q)
    if (titleIdx !== -1) {
      hits.push({
        sessionId: s.id,
        sessionTitle: s.title,
        messageIndex: -1,
        role: "title",
        snippet: s.title,
        matchStart: titleIdx,
        matchEnd: titleIdx + q.length,
        ts: s.updatedAt,
      })
    }
    for (let i = 0; i < s.messages.length; i++) {
      if (hits.length >= maxHits) break
      const m = s.messages[i] as any
      const content = (m?.content ?? "").toString()
      if (!content) continue
      const lower = content.toLowerCase()
      const idx = lower.indexOf(q)
      if (idx === -1) continue
      const start = Math.max(0, idx - SNIPPET_RADIUS)
      const end = Math.min(content.length, idx + q.length + SNIPPET_RADIUS)
      const prefix = start > 0 ? "…" : ""
      const suffix = end < content.length ? "…" : ""
      const snippet = prefix + content.slice(start, end) + suffix
      const matchStart = prefix.length + (idx - start)
      hits.push({
        sessionId: s.id,
        sessionTitle: s.title,
        messageIndex: i,
        role: m.role,
        snippet,
        matchStart,
        matchEnd: matchStart + q.length,
        ts: s.updatedAt,
      })
    }
  }
  return hits
}

export function highlightSnippet(snippet: string, start: number, end: number): { before: string; match: string; after: string } {
  return {
    before: snippet.slice(0, start),
    match: snippet.slice(start, end),
    after: snippet.slice(end),
  }
}

"use client"
import type { ChatSession } from "@/hooks/use-chat-history"

const TEAM_GIST_KEY = "tans-agents:team-gist-id-v1"
const TEAM_NICK_KEY = "tans-agents:team-nick-v1"

export interface TeamSession extends ChatSession {
  sharedBy: string
  sharedAt: number
}

export interface TeamGistData {
  version: 1
  sessions: TeamSession[]
  updatedAt: number
}

export function getTeamGistId(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(TEAM_GIST_KEY) ?? ""
}

export function setTeamGistId(id: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(TEAM_GIST_KEY, id.trim())
}

export function getTeamNick(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(TEAM_NICK_KEY) ?? ""
}

export function setTeamNick(nick: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(TEAM_NICK_KEY, nick.trim().slice(0, 40))
}

const GIST_FILE = "team-sessions.json"

async function ghFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text().catch(() => "")}`)
  return res.json()
}

export async function pullTeamSessions(gistId: string, token: string): Promise<TeamGistData> {
  if (!gistId || !token) throw new Error("Thiếu gistId hoặc token")
  const gist = await ghFetch(`/gists/${gistId}`, token)
  const file = gist?.files?.[GIST_FILE]
  if (!file?.content) return { version: 1, sessions: [], updatedAt: 0 }
  try {
    const parsed = JSON.parse(file.content)
    if (parsed?.version === 1 && Array.isArray(parsed.sessions)) return parsed
  } catch {}
  return { version: 1, sessions: [], updatedAt: 0 }
}

export async function pushTeamSession(
  gistId: string,
  token: string,
  session: ChatSession,
  nick: string
): Promise<TeamGistData> {
  const current = await pullTeamSessions(gistId, token)
  const teamSession: TeamSession = {
    ...session,
    sharedBy: nick || "anon",
    sharedAt: Date.now(),
  }
  // dedupe by id+sharedBy
  const sessions = [
    teamSession,
    ...current.sessions.filter((s) => !(s.id === session.id && s.sharedBy === teamSession.sharedBy)),
  ].slice(0, 100)
  const next: TeamGistData = { version: 1, sessions, updatedAt: Date.now() }
  await ghFetch(`/gists/${gistId}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      files: { [GIST_FILE]: { content: JSON.stringify(next, null, 2) } },
    }),
  })
  return next
}

export async function removeTeamSession(
  gistId: string,
  token: string,
  sessionId: string,
  sharedBy: string
): Promise<TeamGistData> {
  const current = await pullTeamSessions(gistId, token)
  const sessions = current.sessions.filter((s) => !(s.id === sessionId && s.sharedBy === sharedBy))
  const next: TeamGistData = { version: 1, sessions, updatedAt: Date.now() }
  await ghFetch(`/gists/${gistId}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      files: { [GIST_FILE]: { content: JSON.stringify(next, null, 2) } },
    }),
  })
  return next
}

export async function createTeamGist(token: string): Promise<string> {
  const initial: TeamGistData = { version: 1, sessions: [], updatedAt: Date.now() }
  const gist = await ghFetch(`/gists`, token, {
    method: "POST",
    body: JSON.stringify({
      description: "Tan's Agents — Team Workspace",
      public: false,
      files: { [GIST_FILE]: { content: JSON.stringify(initial, null, 2) } },
    }),
  })
  return gist.id as string
}

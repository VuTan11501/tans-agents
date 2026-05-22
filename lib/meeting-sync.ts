"use client"

const MEETING_GIST_KEY = "tans-agents:meeting-gist-v1"
const MEETING_PAT_KEY = "tans-agents:meeting-pat-v1"
const TEAM_PAT_KEY = "tans-agents:team-pat-v1"
const TEAM_NICK_KEY = "tans-agents:team-nick-v1"
const ROOMS_FILE = "meeting-rooms.json"
const MAX_MESSAGES = 100

export interface MeetingMessage {
  id: string
  author: string
  role: "user" | "assistant" | "system"
  content: string
  ts: number
}

export interface MeetingRoom {
  id: string
  title: string
  createdBy: string
  createdAt: number
  nParticipants?: number
}

export interface MeetingRoomsData {
  version: 1
  rooms: MeetingRoom[]
  updatedAt: number
}

export interface MeetingRoomData {
  version: 1
  messages: MeetingMessage[]
  updatedAt: number
}

interface GistFile {
  content?: string
  truncated?: boolean
  raw_url?: string
}

interface GistResponse {
  id: string
  files?: Record<string, GistFile>
}

export function getMeetingGistId(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(MEETING_GIST_KEY) ?? ""
}

export function setMeetingGistId(id: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(MEETING_GIST_KEY, id.trim())
}

export function getMeetingPat(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(MEETING_PAT_KEY) ?? localStorage.getItem(TEAM_PAT_KEY) ?? ""
}

export function setMeetingPat(token: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(MEETING_PAT_KEY, token.trim())
}

export function getMeetingNick(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(TEAM_NICK_KEY) ?? ""
}

export function setMeetingNick(nick: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(TEAM_NICK_KEY, nick.trim().slice(0, 40))
}

export function createMeetingId() {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${Date.now().toString(36)}-${rand}`
}

export function createMeetingMessage(author: string, role: MeetingMessage["role"], content: string): MeetingMessage {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    author: (author || "anon").trim().slice(0, 40),
    role,
    content,
    ts: Date.now(),
  }
}

export function roomFileName(roomId: string) {
  return `meeting-${roomId.replace(/[^a-zA-Z0-9_-]/g, "")}.json`
}

export function mergeMeetingMessages(...groups: MeetingMessage[][]): MeetingMessage[] {
  const map = new Map<string, MeetingMessage>()
  for (const group of groups) {
    for (const message of group) {
      if (!message?.id || typeof message.content !== "string") continue
      map.set(message.id, message)
    }
  }
  return [...map.values()].sort((a, b) => a.ts - b.ts).slice(-MAX_MESSAGES)
}

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
  const text = await res.text()
  let json: any = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = text
    }
  }
  if (!res.ok) {
    const detail = typeof json === "string" ? json : json?.message ?? text
    const err = new Error(`GitHub API ${res.status}: ${detail}`) as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return json
}

async function readGist(gistId: string, token: string): Promise<GistResponse> {
  if (!gistId || !token) throw new Error("Thiếu Gist ID hoặc GitHub PAT")
  return ghFetch(`/gists/${gistId}`, token)
}

function parseRooms(content?: string): MeetingRoomsData {
  if (!content) return { version: 1, rooms: [], updatedAt: 0 }
  try {
    const parsed = JSON.parse(content)
    if (parsed?.version === 1 && Array.isArray(parsed.rooms)) {
      return { version: 1, rooms: parsed.rooms, updatedAt: Number(parsed.updatedAt) || 0 }
    }
    if (Array.isArray(parsed.rooms)) return { version: 1, rooms: parsed.rooms, updatedAt: Number(parsed.updatedAt) || 0 }
  } catch {}
  return { version: 1, rooms: [], updatedAt: 0 }
}

function parseRoom(content?: string): MeetingRoomData {
  if (!content) return { version: 1, messages: [], updatedAt: 0 }
  try {
    const parsed = JSON.parse(content)
    if (parsed?.version === 1 && Array.isArray(parsed.messages)) {
      return { version: 1, messages: mergeMeetingMessages(parsed.messages), updatedAt: Number(parsed.updatedAt) || 0 }
    }
  } catch {}
  return { version: 1, messages: [], updatedAt: 0 }
}

function withParticipantCounts(gist: GistResponse, rooms: MeetingRoom[]): MeetingRoom[] {
  return rooms.map((room) => {
    const data = parseRoom(gist.files?.[roomFileName(room.id)]?.content)
    const authors = new Set(data.messages.map((m) => m.author).filter(Boolean))
    return { ...room, nParticipants: authors.size }
  })
}

export async function pullMeetingRooms(gistId: string, token: string): Promise<MeetingRoomsData> {
  const gist = await readGist(gistId, token)
  const parsed = parseRooms(gist.files?.[ROOMS_FILE]?.content)
  return { ...parsed, rooms: withParticipantCounts(gist, parsed.rooms) }
}

export async function pullMeetingRoom(gistId: string, token: string, roomId: string) {
  const gist = await readGist(gistId, token)
  const rooms = parseRooms(gist.files?.[ROOMS_FILE]?.content).rooms
  const room = rooms.find((r) => r.id === roomId) ?? {
    id: roomId,
    title: `Phòng ${roomId}`,
    createdBy: "unknown",
    createdAt: 0,
  }
  const data = parseRoom(gist.files?.[roomFileName(roomId)]?.content)
  const nParticipants = new Set(data.messages.map((m) => m.author).filter(Boolean)).size
  return { room: { ...room, nParticipants }, data }
}

async function patchGist(gistId: string, token: string, files: Record<string, unknown>) {
  const payload = Object.fromEntries(
    Object.entries(files).map(([name, content]) => [name, { content: JSON.stringify(content, null, 2) }])
  )
  return ghFetch(`/gists/${gistId}`, token, {
    method: "PATCH",
    body: JSON.stringify({ files: payload }),
  })
}

export async function createMeetingGist(token: string): Promise<string> {
  if (!token) throw new Error("Thiếu GitHub PAT")
  const initial: MeetingRoomsData = { version: 1, rooms: [], updatedAt: Date.now() }
  const gist = await ghFetch(`/gists`, token, {
    method: "POST",
    body: JSON.stringify({
      description: "Tan's Agents — Meeting Rooms",
      public: false,
      files: { [ROOMS_FILE]: { content: JSON.stringify(initial, null, 2) } },
    }),
  })
  return gist.id as string
}

export async function createMeetingRoom(gistId: string, token: string, title: string, createdBy: string) {
  const cleanTitle = title.trim().slice(0, 80) || "Phòng họp AI"
  const room: MeetingRoom = {
    id: createMeetingId(),
    title: cleanTitle,
    createdBy: createdBy || "anon",
    createdAt: Date.now(),
  }
  const gist = await readGist(gistId, token)
  const roomsData = parseRooms(gist.files?.[ROOMS_FILE]?.content)
  const nextRooms: MeetingRoomsData = {
    version: 1,
    rooms: [room, ...roomsData.rooms.filter((r) => r.id !== room.id)].slice(0, 100),
    updatedAt: Date.now(),
  }
  const roomData: MeetingRoomData = { version: 1, messages: [], updatedAt: Date.now() }
  await patchGist(gistId, token, { [ROOMS_FILE]: nextRooms, [roomFileName(room.id)]: roomData })
  return room
}

export async function appendMeetingMessages(
  gistId: string,
  token: string,
  roomId: string,
  messages: MeetingMessage[],
  maxRetries = 2
): Promise<MeetingRoomData> {
  if (!messages.length) return (await pullMeetingRoom(gistId, token, roomId)).data

  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const { data } = await pullMeetingRoom(gistId, token, roomId)
      const next: MeetingRoomData = {
        version: 1,
        messages: mergeMeetingMessages(data.messages, messages),
        updatedAt: Date.now(),
      }
      await patchGist(gistId, token, { [roomFileName(roomId)]: next })
      return next
    } catch (e: any) {
      lastError = e
      if (e?.status !== 409 && e?.status !== 412) break
      await new Promise((resolve) => setTimeout(resolve, 300 + attempt * 300))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

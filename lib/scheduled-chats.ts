import type { ProviderKey } from "@/lib/providers"

export type ScheduledChat = {
  id: string
  name: string
  prompt: string
  provider: ProviderKey
  model: string
  schedule: {
    type: "once" | "daily" | "weekly"
    datetime?: string
    time?: string
    dow?: number[]
  }
  lastRunAt?: number
  enabled: boolean
  createdAt: number
}

export type ScheduledResult = {
  id: string
  chatId: string
  ranAt: number
  output: string
  error?: string
}

const CHATS_KEY = "tans-agents:scheduled-chats-v1"
const RESULTS_KEY = "tans-agents:scheduled-results-v1"
const MAX_RESULTS = 100
const DAY_MS = 24 * 60 * 60 * 1000

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function listScheduled(): ScheduledChat[] {
  return readJson<ScheduledChat[]>(CHATS_KEY, []).sort((a, b) => b.createdAt - a.createdAt)
}

export function saveScheduled(chat: ScheduledChat) {
  const chats = readJson<ScheduledChat[]>(CHATS_KEY, [])
  const index = chats.findIndex((item) => item.id === chat.id)
  if (index >= 0) chats[index] = chat
  else chats.push(chat)
  writeJson(CHATS_KEY, chats)
}

export function deleteScheduled(id: string) {
  writeJson(CHATS_KEY, readJson<ScheduledChat[]>(CHATS_KEY, []).filter((chat) => chat.id !== id))
}

export function listResults(chatId?: string): ScheduledResult[] {
  const results = readJson<ScheduledResult[]>(RESULTS_KEY, [])
  return results
    .filter((result) => !chatId || result.chatId === chatId)
    .sort((a, b) => b.ranAt - a.ranAt)
}

export function clearResults() {
  writeJson(RESULTS_KEY, [])
}

export function deleteResult(id: string) {
  writeJson(RESULTS_KEY, readJson<ScheduledResult[]>(RESULTS_KEY, []).filter((result) => result.id !== id))
}

function saveResult(result: ScheduledResult) {
  const results = [result, ...readJson<ScheduledResult[]>(RESULTS_KEY, [])].slice(0, MAX_RESULTS)
  writeJson(RESULTS_KEY, results)
}

function updateLastRun(chat: ScheduledChat, ranAt: number) {
  saveScheduled({ ...chat, lastRunAt: ranAt })
}

function setTimeOnDate(base: Date, time: string) {
  const [hours = "0", minutes = "0"] = time.split(":")
  const date = new Date(base)
  date.setHours(Number(hours), Number(minutes), 0, 0)
  return date.getTime()
}

function latestDailyDue(chat: ScheduledChat, now: number) {
  const time = chat.schedule.time
  if (!time) return undefined
  let due = setTimeOnDate(new Date(now), time)
  if (due > now) due -= DAY_MS
  return due >= chat.createdAt ? due : undefined
}

function latestWeeklyDue(chat: ScheduledChat, now: number) {
  const time = chat.schedule.time
  const dows = chat.schedule.dow ?? []
  if (!time || dows.length === 0) return undefined

  let latest: number | undefined
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(now - offset * DAY_MS)
    if (!dows.includes(date.getDay())) continue
    const due = setTimeOnDate(date, time)
    if (due <= now && due >= chat.createdAt && (latest === undefined || due > latest)) latest = due
  }
  return latest
}

export function getNextDueTime(chat: ScheduledChat, now = Date.now()): number | undefined {
  if (chat.schedule.type === "once") {
    const due = chat.schedule.datetime ? Date.parse(chat.schedule.datetime) : Number.NaN
    return Number.isFinite(due) ? due : undefined
  }
  if (chat.schedule.type === "daily") return latestDailyDue(chat, now)
  return latestWeeklyDue(chat, now)
}

async function collectChatOutput(chat: ScheduledChat) {
  const response = await fetch("/api/chat-sse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: chat.prompt }],
      provider: chat.provider,
      model: chat.model,
      enabledTools: [],
    }),
  })

  if (!response.ok) throw new Error(await response.text())
  if (!response.body) throw new Error("Không nhận được stream từ model")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let output = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split("\n\n")
    buffer = blocks.pop() ?? ""

    for (const block of blocks) {
      const lines = block.split("\n").filter((line) => line.startsWith("data:"))
      for (const line of lines) {
        const data = line.slice(5).trim()
        if (!data || data === "[DONE]") continue
        try {
          const payload = JSON.parse(data)
          if (payload?.error?.message) throw new Error(payload.error.message)
          const content = payload?.choices?.[0]?.delta?.content
          if (typeof content === "string") output += content
        } catch (error) {
          if (error instanceof SyntaxError) continue
          throw error
        }
      }
    }
  }

  return output
}

export async function runDueScheduledChats() {
  const now = Date.now()
  const chats = listScheduled()

  for (const chat of chats) {
    if (!chat.enabled) continue
    const nextDue = getNextDueTime(chat, now)
    if (nextDue === undefined || now < nextDue || (chat.lastRunAt && chat.lastRunAt >= nextDue)) continue

    const ranAt = Date.now()
    try {
      const output = await collectChatOutput(chat)
      saveResult({ id: crypto.randomUUID(), chatId: chat.id, ranAt, output })
    } catch (error) {
      saveResult({
        id: crypto.randomUUID(),
        chatId: chat.id,
        ranAt,
        output: "",
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      updateLastRun(chat, nextDue)
    }
  }
}

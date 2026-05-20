export type ReactionValue = "up" | "down" | "heart" | null

export type Event = {
  time: number
  type: "message_sent" | "message_received" | "error" | "tool_call" | "reaction"
  model?: string
  provider?: string
  tool?: string
  tokensIn?: number
  tokensOut?: number
  latencyMs?: number
  messageId?: string
  reaction?: ReactionValue
}

const STORAGE_KEY = "tans-agents:events"
const MAX_EVENTS = 1000

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function isEvent(value: unknown): value is Event {
  if (!value || typeof value !== "object") return false
  const event = value as Partial<Event>
  return (
    typeof event.time === "number" &&
    (event.type === "message_sent" ||
      event.type === "message_received" ||
      event.type === "error" ||
      event.type === "tool_call" ||
      event.type === "reaction")
  )
}

export function getEvents(): Event[] {
  if (!canUseStorage()) return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isEvent).slice(-MAX_EVENTS)
  } catch {
    return []
  }
}

export function logEvent(event: Event) {
  if (!canUseStorage()) return

  const events = [...getEvents(), event].slice(-MAX_EVENTS)

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-Math.floor(MAX_EVENTS / 2))))
    } catch {
      // Ignore storage failures so analytics never interrupts chat.
    }
  }
}

export function trackReaction(messageId: string, reaction: ReactionValue): void {
  logEvent({ time: Date.now(), type: "reaction", messageId, reaction })
}

export function clearEvents() {
  if (!canUseStorage()) return
  window.localStorage.removeItem(STORAGE_KEY)
}

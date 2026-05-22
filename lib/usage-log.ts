export type UsageEntry = {
  ts: number
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export type UsageFilter = {
  provider?: string
  model?: string
  from?: number
  to?: number
}

export const USAGE_LOG_STORAGE_KEY = "tans-agents:usage-log-v1"
const MAX_USAGE_ENTRIES = 1000

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function isUsageEntry(value: unknown): value is UsageEntry {
  if (!value || typeof value !== "object") return false
  const entry = value as Partial<UsageEntry>
  return (
    typeof entry.ts === "number" &&
    typeof entry.provider === "string" &&
    typeof entry.model === "string" &&
    typeof entry.inputTokens === "number" &&
    typeof entry.outputTokens === "number" &&
    typeof entry.costUsd === "number"
  )
}

function readUsage(): UsageEntry[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(USAGE_LOG_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isUsageEntry).slice(-MAX_USAGE_ENTRIES)
  } catch {
    return []
  }
}

function normalizeEntry(entry: UsageEntry): UsageEntry {
  return {
    ts: Number.isFinite(entry.ts) ? entry.ts : Date.now(),
    provider: entry.provider || "unknown",
    model: entry.model || "_default",
    inputTokens: Math.max(0, Math.round(Number.isFinite(entry.inputTokens) ? entry.inputTokens : 0)),
    outputTokens: Math.max(0, Math.round(Number.isFinite(entry.outputTokens) ? entry.outputTokens : 0)),
    costUsd: Math.max(0, Number.isFinite(entry.costUsd) ? entry.costUsd : 0),
  }
}

export function logUsage(entry: UsageEntry): void {
  try {
    if (!canUseStorage()) return
    const entries = [...readUsage(), normalizeEntry(entry)].slice(-MAX_USAGE_ENTRIES)
    try {
      window.localStorage.setItem(USAGE_LOG_STORAGE_KEY, JSON.stringify(entries))
    } catch {
      window.localStorage.setItem(USAGE_LOG_STORAGE_KEY, JSON.stringify(entries.slice(-Math.floor(MAX_USAGE_ENTRIES / 2))))
    }
  } catch {
    // Usage tracking must never break chat.
  }
}

export function getUsage(filter: UsageFilter = {}): UsageEntry[] {
  try {
    return readUsage().filter((entry) => {
      if (filter.provider && entry.provider !== filter.provider) return false
      if (filter.model && entry.model !== filter.model) return false
      if (typeof filter.from === "number" && entry.ts < filter.from) return false
      if (typeof filter.to === "number" && entry.ts > filter.to) return false
      return true
    })
  } catch {
    return []
  }
}

export function clearUsage(): void {
  try {
    if (!canUseStorage()) return
    window.localStorage.removeItem(USAGE_LOG_STORAGE_KEY)
  } catch {
    // ignore storage failures
  }
}

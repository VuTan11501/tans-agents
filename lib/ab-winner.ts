// A/B comparison "winner" tracking. Persisted in localStorage.
// Each row records: user prompt category, models compared, winner model, timestamp.

export type AbWinnerRow = {
  promptKey: string // hashed/normalized prompt for grouping similar tasks
  modelA: string
  modelB: string
  winner: "A" | "B" | "tie"
  at: number
}

const STORAGE_KEY = "tans-agents:ab-winners-v1"
const MAX_ROWS = 500

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function normalizePromptKey(prompt: string): string {
  // Lowercase, strip punctuation, take first 8 significant words for a coarse "task category".
  const words = prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 8)
  return words.join(" ") || "misc"
}

function read(): AbWinnerRow[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (r): r is AbWinnerRow =>
        r &&
        typeof r === "object" &&
        typeof r.promptKey === "string" &&
        typeof r.modelA === "string" &&
        typeof r.modelB === "string" &&
        (r.winner === "A" || r.winner === "B" || r.winner === "tie") &&
        typeof r.at === "number"
    )
  } catch {
    return []
  }
}

function write(rows: AbWinnerRow[]): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-MAX_ROWS)))
  } catch {
    // ignore
  }
}

export function recordWinner(row: AbWinnerRow): void {
  const all = read()
  all.push(row)
  write(all)
}

export function getWinners(): AbWinnerRow[] {
  return read()
}

export function clearWinners(): void {
  if (!canUseStorage()) return
  window.localStorage.removeItem(STORAGE_KEY)
}

export type ModelWinrate = {
  model: string
  wins: number
  losses: number
  ties: number
  total: number
  winRate: number // 0..1
}

export function modelLeaderboard(rows = read()): ModelWinrate[] {
  const map = new Map<string, ModelWinrate>()
  const ensure = (model: string): ModelWinrate => {
    let entry = map.get(model)
    if (!entry) {
      entry = { model, wins: 0, losses: 0, ties: 0, total: 0, winRate: 0 }
      map.set(model, entry)
    }
    return entry
  }
  for (const r of rows) {
    const a = ensure(r.modelA)
    const b = ensure(r.modelB)
    a.total += 1
    b.total += 1
    if (r.winner === "A") { a.wins += 1; b.losses += 1 }
    else if (r.winner === "B") { b.wins += 1; a.losses += 1 }
    else { a.ties += 1; b.ties += 1 }
  }
  for (const m of map.values()) {
    m.winRate = m.total > 0 ? (m.wins + m.ties * 0.5) / m.total : 0
  }
  return [...map.values()].sort((a, b) => b.winRate - a.winRate)
}

export function suggestWinnerForPrompt(prompt: string): string | null {
  const key = normalizePromptKey(prompt)
  const rows = read().filter((r) => r.promptKey === key)
  if (rows.length < 2) return null
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (r.winner === "A") counts.set(r.modelA, (counts.get(r.modelA) ?? 0) + 1)
    else if (r.winner === "B") counts.set(r.modelB, (counts.get(r.modelB) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  return sorted.length > 0 ? sorted[0][0] : null
}

// Per-provider Time-To-First-Token (TTFT) tracker.
// Persisted to localStorage as a ring buffer (last 200 samples per provider).

export type TtftSample = {
  provider: string
  model: string
  ttftMs: number
  totalMs?: number
  at: number
}

const STORAGE_KEY = "tans-agents:ttft-samples-v1"
const MAX_SAMPLES_PER_PROVIDER = 200

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function read(): TtftSample[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (s): s is TtftSample =>
        s &&
        typeof s === "object" &&
        typeof s.provider === "string" &&
        typeof s.model === "string" &&
        typeof s.ttftMs === "number" &&
        typeof s.at === "number"
    )
  } catch {
    return []
  }
}

function write(samples: TtftSample[]): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(samples))
  } catch {
    // ignore quota errors
  }
}

export function recordTtft(sample: TtftSample): void {
  if (!Number.isFinite(sample.ttftMs) || sample.ttftMs < 0) return
  const all = read()
  all.push(sample)
  // Trim per-provider to MAX_SAMPLES_PER_PROVIDER, keep newest.
  const byProvider = new Map<string, TtftSample[]>()
  for (const s of all) {
    const list = byProvider.get(s.provider) ?? []
    list.push(s)
    byProvider.set(s.provider, list)
  }
  const trimmed: TtftSample[] = []
  for (const list of byProvider.values()) {
    list.sort((a, b) => a.at - b.at)
    trimmed.push(...list.slice(-MAX_SAMPLES_PER_PROVIDER))
  }
  write(trimmed)
}

export function getTtftSamples(): TtftSample[] {
  return read()
}

export function clearTtft(): void {
  if (!canUseStorage()) return
  window.localStorage.removeItem(STORAGE_KEY)
}

export type ProviderTtftStats = {
  provider: string
  samples: number
  p50Ms: number
  p95Ms: number
  meanMs: number
  lastAt: number
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

export function summarizeByProvider(samples = read()): ProviderTtftStats[] {
  const byProv = new Map<string, TtftSample[]>()
  for (const s of samples) {
    const list = byProv.get(s.provider) ?? []
    list.push(s)
    byProv.set(s.provider, list)
  }
  const out: ProviderTtftStats[] = []
  for (const [provider, list] of byProv.entries()) {
    const sorted = list.map((s) => s.ttftMs).sort((a, b) => a - b)
    const sum = sorted.reduce((acc, v) => acc + v, 0)
    out.push({
      provider,
      samples: sorted.length,
      p50Ms: Math.round(percentile(sorted, 50)),
      p95Ms: Math.round(percentile(sorted, 95)),
      meanMs: Math.round(sum / sorted.length),
      lastAt: list.reduce((acc, s) => Math.max(acc, s.at), 0),
    })
  }
  out.sort((a, b) => a.p50Ms - b.p50Ms)
  return out
}

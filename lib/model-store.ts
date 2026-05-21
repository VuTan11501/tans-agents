"use client"

import { useSyncExternalStore } from "react"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"

/**
 * Module-level shared store for ModelPicker:
 *  - `discovered`: live-scanned model ids per provider (persisted localStorage)
 *  - `usage`: per-model request counter for the current local-day (persisted localStorage)
 *  - `discovering`: which provider is currently being scanned
 *  - `discoverError`: per-provider error message of last scan
 *
 * Two independent React subtrees (Header vs A/B compare picker) subscribe via
 * `useModelStore()` so a scan / usage tick in one place updates ALL pickers.
 */

type State = {
  discovered: Partial<Record<ProviderKey, string[]>>
  discovering: ProviderKey | null
  discoverError: Partial<Record<ProviderKey, string>>
  /** Map<"<provider>:<model>:<YYYY-MM-DD>", count> */
  usage: Record<string, number>
  /** ms timestamp — bumped on any change so React snapshot equality works. */
  rev: number
}

const DISCOVERED_KEY = "tans:model-picker:discovered-v1"
const USAGE_KEY = "tans:model-picker:usage-v1"

function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function usageKey(provider: ProviderKey, model: string, date = todayLocal()) {
  return `${provider}:${model}:${date}`
}

function loadDiscovered(): Partial<Record<ProviderKey, string[]>> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(DISCOVERED_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function loadUsage(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(USAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    if (!parsed || typeof parsed !== "object") return {}
    // Garbage-collect entries older than 7 days to keep blob small.
    const today = todayLocal()
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() - 7)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const cleaned: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed)) {
      const date = k.split(":").pop() ?? ""
      if (date >= cutoffStr) cleaned[k] = v
    }
    return cleaned
  } catch {
    return {}
  }
}

const subscribers = new Set<() => void>()

let state: State = {
  discovered: typeof window !== "undefined" ? loadDiscovered() : {},
  discovering: null,
  discoverError: {},
  usage: typeof window !== "undefined" ? loadUsage() : {},
  rev: 0,
}

function notify() {
  // Replace state with a NEW object so useSyncExternalStore sees an Object.is
  // change. Mutating fields on the existing reference would silently skip
  // every re-render — that's why the spinner never appeared.
  state = { ...state, rev: state.rev + 1 }
  subscribers.forEach((cb) => cb())
}

function persistDiscovered() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(DISCOVERED_KEY, JSON.stringify(state.discovered))
  } catch {
    /* quota? ignore */
  }
}

function persistUsage() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(USAGE_KEY, JSON.stringify(state.usage))
  } catch {
    /* ignore */
  }
}

// Cross-tab sync — listen for storage events and merge in.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === DISCOVERED_KEY) {
      state.discovered = loadDiscovered()
      notify()
    } else if (e.key === USAGE_KEY) {
      state.usage = loadUsage()
      notify()
    }
  })
}

export const ModelStore = {
  /** Imperative read (non-reactive). */
  getSnapshot(): State {
    return state
  },
  subscribe(cb: () => void) {
    subscribers.add(cb)
    return () => subscribers.delete(cb)
  },
  setDiscovering(p: ProviderKey | null) {
    state.discovering = p
    notify()
  },
  setDiscoverError(p: ProviderKey, msg: string | undefined) {
    if (msg) state.discoverError = { ...state.discoverError, [p]: msg }
    else {
      const { [p]: _, ...rest } = state.discoverError
      state.discoverError = rest
    }
    notify()
  },
  setDiscovered(p: ProviderKey, ids: string[]) {
    state.discovered = { ...state.discovered, [p]: ids }
    persistDiscovered()
    notify()
  },
  getDiscovered(p: ProviderKey): string[] | undefined {
    return state.discovered[p]
  },
  getUsage(provider: ProviderKey, model: string): number {
    return state.usage[usageKey(provider, model)] ?? 0
  },
  incrementUsage(provider: ProviderKey, model: string) {
    const k = usageKey(provider, model)
    state.usage = { ...state.usage, [k]: (state.usage[k] ?? 0) + 1 }
    persistUsage()
    notify()
  },
  /** Reset today's counter for one model (debug / dev). */
  resetUsage(provider: ProviderKey, model: string) {
    const k = usageKey(provider, model)
    const { [k]: _, ...rest } = state.usage
    state.usage = rest
    persistUsage()
    notify()
  },
  /** Resolve provider for a model id by looking at static lists + live-discovered. */
  resolveProvider(modelId: string): ProviderKey | undefined {
    for (const [pKey, p] of Object.entries(PROVIDERS) as Array<[ProviderKey, { models: readonly string[] }]>) {
      if (p.models.includes(modelId)) return pKey
    }
    for (const [pKey, ids] of Object.entries(state.discovered) as Array<[ProviderKey, string[]]>) {
      if (ids?.includes(modelId)) return pKey
    }
    return undefined
  },
}

/**
 * React hook — subscribes to the store and returns a snapshot.
 * Use `state.rev` to force re-renders even though referenced fields are mutated in place.
 */
export function useModelStore(): State {
  return useSyncExternalStore(
    ModelStore.subscribe,
    ModelStore.getSnapshot,
    ModelStore.getSnapshot,
  )
}

/**
 * Centralised live-scan with dedupe — multiple pickers calling this concurrently
 * share the same in-flight promise so we don't fire 3 identical /models requests.
 */
const inflight = new Map<ProviderKey, Promise<void>>()

export async function discoverModels(
  provider: ProviderKey,
  userKey: string | undefined,
): Promise<void> {
  const existing = inflight.get(provider)
  if (existing) return existing

  const run = (async () => {
    ModelStore.setDiscovering(provider)
    ModelStore.setDiscoverError(provider, undefined)
    try {
      const res = await fetch(`/api/${provider}/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userKey: userKey ?? "" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      const ids = (data.models as Array<{ id: string }>).map((m) => m.id)
      ModelStore.setDiscovered(provider, ids)
    } catch (err) {
      ModelStore.setDiscoverError(provider, err instanceof Error ? err.message : String(err))
    } finally {
      ModelStore.setDiscovering(null)
      inflight.delete(provider)
    }
  })()

  inflight.set(provider, run)
  return run
}

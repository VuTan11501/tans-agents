"use client"
import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { SyncScope, SYNC_KEYS, SYNC_TS_KEY, readScopeFromLocal, writeScopeToLocal } from "@/lib/sync-keys"

const SCOPES: SyncScope[] = ["sessions", "settings", "collections"]
const PUSH_DEBOUNCE_MS = 3000
const TRACKED_KEYS = new Set(SCOPES.flatMap((s) => SYNC_KEYS[s]))

function scopeOfKey(key: string): SyncScope | null {
  for (const s of SCOPES) {
    if (SYNC_KEYS[s].includes(key)) return s
  }
  return null
}

export type SyncStatus = "idle" | "pulling" | "pushing" | "error" | "offline"

interface UseSyncResult {
  status: SyncStatus
  lastSyncAt: number | null
  error: string | null
  pullAll: () => Promise<void>
  pushAll: () => Promise<void>
}

export function useCloudSync(): UseSyncResult {
  const { data: session, status: authStatus } = useSession()
  const ghId = (session as any)?.ghId as string | undefined
  const authed = authStatus === "authenticated" && !!ghId

  const [status, setStatus] = useState<SyncStatus>("idle")
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dirtyScopes = useRef<Set<SyncScope>>(new Set())
  const pushTimer = useRef<NodeJS.Timeout | null>(null)
  const initialPullDone = useRef(false)

  async function pullScope(scope: SyncScope) {
    const res = await fetch(`/api/sync?scope=${scope}`, { credentials: "include" })
    if (!res.ok) throw new Error(`pull ${scope}: ${res.status}`)
    const remote = await res.json()
    const local = readScopeFromLocal(scope)
    // LWW: nếu server mới hơn → adopt remote. Bằng nhau hoặc local mới hơn → giữ local (sẽ push sau).
    if ((remote.updated_at ?? 0) > local.updated_at) {
      writeScopeToLocal(scope, remote)
      // Notify React app to re-read localStorage.
      window.dispatchEvent(new CustomEvent("tans:cloud-pull", { detail: { scope } }))
    } else if (local.updated_at > (remote.updated_at ?? 0) && Object.keys(local.data).length > 0) {
      dirtyScopes.current.add(scope)
    }
  }

  async function pushScope(scope: SyncScope) {
    const local = readScopeFromLocal(scope)
    if (!local.updated_at || Object.keys(local.data).length === 0) return
    const res = await fetch(`/api/sync?scope=${scope}`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(local),
    })
    if (!res.ok) throw new Error(`push ${scope}: ${res.status}`)
  }

  async function pullAll() {
    if (!authed) return
    setStatus("pulling")
    setError(null)
    try {
      for (const s of SCOPES) await pullScope(s)
      setLastSyncAt(Date.now())
      setStatus("idle")
    } catch (e: any) {
      setError(e?.message ?? "pull_error")
      setStatus("error")
    }
  }

  async function pushAll() {
    if (!authed) return
    const scopes = Array.from(dirtyScopes.current)
    if (scopes.length === 0) return
    dirtyScopes.current.clear()
    setStatus("pushing")
    setError(null)
    try {
      for (const s of scopes) await pushScope(s)
      setLastSyncAt(Date.now())
      setStatus("idle")
    } catch (e: any) {
      // Re-mark dirty so next attempt retries.
      for (const s of scopes) dirtyScopes.current.add(s)
      setError(e?.message ?? "push_error")
      setStatus("error")
    }
  }

  function schedulePush() {
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(() => {
      pushTimer.current = null
      void pushAll()
    }, PUSH_DEBOUNCE_MS)
  }

  // Wrap localStorage.setItem to detect mutations on tracked keys (other tabs use 'storage' event).
  useEffect(() => {
    if (!authed) return
    if (typeof window === "undefined") return
    const orig = window.localStorage.setItem.bind(window.localStorage)
    function patched(key: string, value: string) {
      orig(key, value)
      if (TRACKED_KEYS.has(key)) {
        const s = scopeOfKey(key)
        if (s) {
          dirtyScopes.current.add(s)
          // Bump local timestamp so push includes correct ts.
          orig(SYNC_TS_KEY(s), String(Date.now()))
          schedulePush()
        }
      }
    }
    ;(window.localStorage as any).setItem = patched
    return () => {
      ;(window.localStorage as any).setItem = orig
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  // Initial pull on auth.
  useEffect(() => {
    if (!authed) return
    if (initialPullDone.current) return
    initialPullDone.current = true
    void (async () => {
      await pullAll()
      // After pull, if any scope was kept-local-newer, push it.
      if (dirtyScopes.current.size > 0) await pushAll()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  // Pull on focus / visibility change.
  useEffect(() => {
    if (!authed) return
    function onFocus() {
      void pullAll()
    }
    function onVisibility() {
      if (document.visibilityState === "visible") void pullAll()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  return { status, lastSyncAt, error, pullAll, pushAll }
}

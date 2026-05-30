// Allowlist of localStorage keys for cloud sync, grouped by scope.
// LWW timestamp lưu ở `tans:sync:{scope}:updated_at`.
//
// LƯU Ý:
// - User-keys (`tans-agents:keys`) KHÔNG sync — chứa API key, giữ per-device.
// - RAG documents (IndexedDB) KHÔNG sync — quá lớn cho Upstash free tier.
//   Chỉ sync `tans:rag:activeCollection` để nhớ collection đang chọn.

export type SyncScope = "sessions" | "settings" | "collections"

export const SYNC_KEYS: Record<SyncScope, string[]> = {
  sessions: ["tans-agents:chat-history-v1"],
  settings: [
    "tans:provider-model",
    "tans:ab",
    "tans:auto-profile",
    "tans:density",
    "tans-agents:accent-color",
    "tans:self-critique",
    "tans:auto-compact",
    "tans:reactions",
    "tans-agents:prompts",
    "tans-agents:memory",
    "tans-agents:snippets",
    "tans-agents:active-workspace-pack",
    "tans-agents:playbook-context",
    "tans-agents:share-settings-v1",
    "tans:composer:preview",
    "tans:voice-mode:on",
    "tans:voice-mode:lang",
  ],
  collections: ["tans:rag:activeCollection"],
}

export const SYNC_TS_KEY = (scope: SyncScope) => `tans:sync:${scope}:updated_at`

export interface SyncBlob {
  data: Record<string, string>
  updated_at: number
}

export function readScopeFromLocal(scope: SyncScope): SyncBlob {
  const data: Record<string, string> = {}
  if (typeof window === "undefined") return { data, updated_at: 0 }
  for (const k of SYNC_KEYS[scope]) {
    const v = window.localStorage.getItem(k)
    if (v !== null) data[k] = v
  }
  const ts = Number(window.localStorage.getItem(SYNC_TS_KEY(scope)) ?? 0) || 0
  return { data, updated_at: ts }
}

export function writeScopeToLocal(scope: SyncScope, blob: SyncBlob) {
  if (typeof window === "undefined") return
  const allowed = new Set(SYNC_KEYS[scope])
  // Remove keys that are no longer present in remote (deletion sync).
  for (const k of SYNC_KEYS[scope]) {
    if (!(k in blob.data)) window.localStorage.removeItem(k)
  }
  for (const [k, v] of Object.entries(blob.data)) {
    if (!allowed.has(k)) continue
    window.localStorage.setItem(k, v)
  }
  window.localStorage.setItem(SYNC_TS_KEY(scope), String(blob.updated_at))
}

export function bumpScopeTimestamp(scope: SyncScope, ts: number = Date.now()) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SYNC_TS_KEY(scope), String(ts))
}

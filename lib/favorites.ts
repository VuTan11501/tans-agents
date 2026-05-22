const FAVORITES_KEY = "tans-agents:favorite-sessions-v1"
export const FAVORITES_CHANGED_EVENT = "tans:favorites-changed"

function readFavorites(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return Array.from(new Set(parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0)))
  } catch {
    return []
  }
}

function writeFavorites(ids: string[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT))
}

export function listFavorites(): string[] {
  return readFavorites()
}

export function isFavorite(id: string): boolean {
  return readFavorites().includes(id)
}

export function toggleFavorite(id: string): boolean {
  const favorites = readFavorites()
  const exists = favorites.includes(id)
  const next = exists ? favorites.filter((item) => item !== id) : [id, ...favorites]
  writeFavorites(next)
  return !exists
}

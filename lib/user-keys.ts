export type UserKeys = {
  groq?: string
  gemini?: string
  github?: string
  openrouter?: string
  brave?: string
}

export type UserKeyProvider = keyof UserKeys

export const USER_KEYS_STORAGE_KEY = "tans-agents:keys"

const PROVIDERS: UserKeyProvider[] = ["groq", "gemini", "github", "openrouter", "brave"]

function sanitizeKeys(value: unknown): UserKeys {
  if (!value || typeof value !== "object") return {}

  const source = value as Record<string, unknown>
  const keys: UserKeys = {}
  for (const provider of PROVIDERS) {
    const key = source[provider]
    if (typeof key === "string" && key.trim()) {
      keys[provider] = key.trim()
    }
  }
  return keys
}

export function loadUserKeys(): UserKeys {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(USER_KEYS_STORAGE_KEY)
    return raw ? sanitizeKeys(JSON.parse(raw)) : {}
  } catch {
    return {}
  }
}

export function saveUserKeys(keys: UserKeys) {
  if (typeof window === "undefined") return

  const sanitized = sanitizeKeys(keys)
  window.localStorage.setItem(USER_KEYS_STORAGE_KEY, JSON.stringify(sanitized))
}

export function hasAnyUserKey(keys: UserKeys) {
  return Object.values(keys).some(Boolean)
}

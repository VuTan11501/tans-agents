export type UserKeys = {
  groq?: string
  gemini?: string
  github?: string
  openrouter?: string
  cerebras?: string
  mistral?: string
  brave?: string
  ollamaBaseUrl?: string
}

export type UserKeyProvider = keyof UserKeys

export const USER_KEYS_STORAGE_KEY = "tans-agents:keys"
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434"

const API_KEY_PROVIDERS: UserKeyProvider[] = ["groq", "gemini", "github", "openrouter", "cerebras", "mistral", "brave"]

function sanitizeKeys(value: unknown): UserKeys {
  if (!value || typeof value !== "object") return {}

  const source = value as Record<string, unknown>
  const keys: UserKeys = {}
  for (const provider of API_KEY_PROVIDERS) {
    const key = source[provider]
    if (typeof key === "string" && key.trim()) {
      keys[provider] = key.trim()
    }
  }
  const ollamaBaseUrl = source.ollamaBaseUrl
  keys.ollamaBaseUrl = typeof ollamaBaseUrl === "string" && ollamaBaseUrl.trim()
    ? ollamaBaseUrl.trim().replace(/\/+$/, "")
    : DEFAULT_OLLAMA_BASE_URL
  return keys
}

export function loadUserKeys(): UserKeys {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(USER_KEYS_STORAGE_KEY)
    return raw ? sanitizeKeys(JSON.parse(raw)) : { ollamaBaseUrl: DEFAULT_OLLAMA_BASE_URL }
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
  return API_KEY_PROVIDERS.some((provider) => Boolean(keys[provider]))
}

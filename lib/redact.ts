const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[REDACTED_EMAIL]",
  },
  {
    pattern: /\b(sk-[a-zA-Z0-9_-]{16,})\b/g,
    replacement: "[REDACTED_API_KEY]",
  },
  {
    pattern: /\b(ghp_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,})\b/g,
    replacement: "[REDACTED_GITHUB_TOKEN]",
  },
  {
    pattern: /\b(Bearer\s+)[a-zA-Z0-9._-]{10,}\b/gi,
    replacement: "$1[REDACTED_TOKEN]",
  },
  {
    pattern: /\b(api[_-]?key|token|secret|password)\s*[:=]\s*["']?([a-zA-Z0-9._-]{6,})["']?/gi,
    replacement: "$1=[REDACTED]",
  },
]

export function redactSensitiveText(text: string): string {
  let output = text
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    output = output.replace(pattern, replacement)
  }
  return output
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactSensitiveText(value)
  if (Array.isArray(value)) return value.map((item) => redactValue(item))
  if (!value || typeof value !== "object") return value
  const entries = Object.entries(value as Record<string, unknown>)
  return Object.fromEntries(entries.map(([key, item]) => [key, redactValue(item)]))
}

export function redactSessionForShare<T>(session: T): T {
  return redactValue(session) as T
}

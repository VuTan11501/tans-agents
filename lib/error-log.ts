export interface LoggedError {
  time: number
  request: {
    provider?: string
    model?: string
    lastMessage?: string
    [key: string]: unknown
  }
  error: string
}

const STORAGE_KEY = "tans-agents:errors"
const MAX_ERRORS = 50

function readErrors(): LoggedError[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is LoggedError => {
      return (
        item &&
        typeof item.time === "number" &&
        typeof item.request === "object" &&
        typeof item.error === "string"
      )
    })
  } catch {
    return []
  }
}

function writeErrors(errors: LoggedError[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(errors.slice(0, MAX_ERRORS)))
}

export function logError(err: LoggedError) {
  const next = [err, ...readErrors()].slice(0, MAX_ERRORS)
  writeErrors(next)
}

export function getErrors() {
  return readErrors()
}

export function clearErrors() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function formatBugReport(errors: LoggedError[]) {
  if (errors.length === 0) return "## AI Error Log\n\nNo errors recorded."

  return [
    "## AI Error Log",
    "",
    ...errors.flatMap((entry, index) => [
      `### ${index + 1}. ${new Date(entry.time).toISOString()}`,
      "",
      `- Provider: ${entry.request.provider ?? "unknown"}`,
      `- Model: ${entry.request.model ?? "unknown"}`,
      `- Error: ${entry.error}`,
      "",
      "```json",
      JSON.stringify(entry.request, null, 2),
      "```",
      "",
    ]),
  ].join("\n")
}

export async function copyAsBugReport(errors: LoggedError[]) {
  const report = formatBugReport(errors)
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(report)
  }
  return report
}

export type ModelPricing = { in: number; out: number }

export const PRICING_TABLE: Record<string, ModelPricing> = {
  "llama-3.3-70b-versatile": { in: 0.59, out: 0.79 },
  "llama-3.1-8b-instant": { in: 0.05, out: 0.08 },
  "mixtral-8x7b-32768": { in: 0.24, out: 0.24 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "claude-3-5-sonnet": { in: 3, out: 15 },
  "claude-3-5-haiku": { in: 1, out: 5 },
  "mistral-small-latest": { in: 0.2, out: 0.6 },
  "mistral-large-latest": { in: 2, out: 6 },
  "gemini-1.5-pro": { in: 1.25, out: 5 },
  "gemini-1.5-flash": { in: 0.075, out: 0.3 },
  "llama3.1-8b": { in: 0.1, out: 0.1 },
  "llama3.1-70b": { in: 0.6, out: 0.6 },
  _default: { in: 0.5, out: 1.5 },
}

export function estimateTokens(text: string): number {
  if (!text) return 0
  const nonAscii = [...text].filter((char) => char.charCodeAt(0) > 127).length
  const ratio = nonAscii / Math.max(1, [...text].length)
  return Math.ceil(text.length / (ratio > 0.3 ? 2.5 : 4))
}

export function getModelPricing(model?: string | null): ModelPricing {
  if (!model) return PRICING_TABLE._default

  const normalized = model.toLowerCase().trim()
  const exact = PRICING_TABLE[normalized]
  if (exact) return exact

  const pathTail = normalized.split("/").at(-1)
  if (pathTail && PRICING_TABLE[pathTail]) return PRICING_TABLE[pathTail]

  const matched = Object.entries(PRICING_TABLE).find(([key]) => key !== "_default" && normalized.includes(key))
  return matched?.[1] ?? PRICING_TABLE._default
}

export function estimateCost(inputTokens: number, outputTokens: number, model?: string | null): number {
  const pricing = getModelPricing(model)
  return (inputTokens * pricing.in + outputTokens * pricing.out) / 1_000_000
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "$0.0000"
  return `$${value.toFixed(value < 1 ? 4 : 2)}`
}

export function formatTokens(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return "0"
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1).replace(/\.0$/, "")}k`
  return Math.round(tokens).toString()
}

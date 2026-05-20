import { encode } from "gpt-tokenizer"

// Approximate token count using cl100k. Same encoding for OpenAI/Llama/Gemini gives ±10% accuracy.
export function countTokens(text: string): number {
  if (!text) return 0
  try { return encode(text).length } catch { return Math.ceil(text.length / 4) }
}

// Cost per 1M tokens (input/output) for known models. Rough public pricing as of 2026-05.
// Used only for ESTIMATE — actual billing varies.
export const PRICING: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gemini-2.5-flash": { in: 0.075, out: 0.3 },
  "gemini-2.5-flash-lite": { in: 0.04, out: 0.15 },
  "gemini-2.5-pro": { in: 1.25, out: 5 },
  "gemini-2.0-flash": { in: 0.075, out: 0.3 },
  "gemini-2.0-flash-lite": { in: 0.04, out: 0.15 },
  "llama-3.3-70b-versatile": { in: 0.59, out: 0.79 },
  "llama-3.1-8b-instant": { in: 0.05, out: 0.08 },
  "openai/gpt-oss-120b": { in: 0.15, out: 0.6 },
  "openai/gpt-oss-20b": { in: 0.1, out: 0.5 },
  "qwen/qwen3-32b": { in: 0.29, out: 0.59 },
  "meta-llama/llama-4-scout-17b-16e-instruct": { in: 0.11, out: 0.34 },
}

// Estimate cost in USD for given tokens. Returns null if model unknown.
export function estimateCost(model: string, tokensIn: number, tokensOut: number): number | null {
  const p = PRICING[model]
  if (!p) return null
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000
}

export function formatCost(usd: number | null): string {
  if (usd == null) return "—"
  if (usd < 0.001) return `<$0.001`
  if (usd < 1) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(3)}`
}

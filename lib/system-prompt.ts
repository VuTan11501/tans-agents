import { getPersona, type PersonaId } from "@/lib/personas"

export interface MemoryFact {
  text: string
  confidence: number
  createdAt?: number
  expiresAt?: number
}

export interface MemoryState {
  about: string
  facts: MemoryFact[]
}

const DEFAULT_CONFIDENCE = 0.7

function clampConfidence(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(number)) return DEFAULT_CONFIDENCE
  return Math.min(1, Math.max(0, number))
}

export function isMemoryFactExpired(fact: MemoryFact, now = Date.now()): boolean {
  return typeof fact.expiresAt === "number" && fact.expiresAt <= now
}

export function normalizeMemoryFact(value: unknown): MemoryFact | null {
  if (typeof value === "string") {
    const text = value.trim()
    return text ? { text, confidence: DEFAULT_CONFIDENCE } : null
  }
  if (!value || typeof value !== "object") return null
  const fact = value as Partial<MemoryFact>
  const text = typeof fact.text === "string" ? fact.text.trim() : ""
  if (!text) return null
  return {
    text,
    confidence: clampConfidence(fact.confidence),
    createdAt: typeof fact.createdAt === "number" ? fact.createdAt : undefined,
    expiresAt: typeof fact.expiresAt === "number" ? fact.expiresAt : undefined,
  }
}

export function normalizeMemoryState(input: unknown): MemoryState {
  if (!input || typeof input !== "object") return { about: "", facts: [] }
  const raw = input as { about?: unknown; facts?: unknown }
  const about = typeof raw.about === "string" ? raw.about : ""
  const factsRaw = Array.isArray(raw.facts) ? raw.facts : []
  const facts = factsRaw
    .map((item) => normalizeMemoryFact(item))
    .filter((fact): fact is MemoryFact => Boolean(fact))
  return { about, facts }
}

export function buildSystemPrompt({
  persona,
  memory,
}: {
  persona: PersonaId
  memory?: MemoryState
}): string {
  const selectedPersona = getPersona(persona)
  const sections = [selectedPersona.systemPrompt]

  const normalizedMemory = normalizeMemoryState(memory)
  const about = normalizedMemory.about.trim()
  const facts = normalizedMemory.facts
    .filter((fact) => !isMemoryFactExpired(fact))
    .filter((fact) => fact.confidence >= 0.4)
    .map((fact) => ({
      ...fact,
      text: fact.text.trim(),
    }))
    .filter((fact) => Boolean(fact.text))

  if (about || facts.length > 0) {
    const memoryLines = [
      "Long-term memory about the user. Use it when relevant; do not reveal it unless asked.",
    ]
    if (about) memoryLines.push(`About: ${about}`)
    if (facts.length > 0) {
      memoryLines.push("Facts to remember:")
      memoryLines.push(...facts.map((fact) => `- ${fact.text} (confidence ${(fact.confidence * 100).toFixed(0)}%)`))
    }
    sections.push(memoryLines.join("\n"))
  }

  return sections.join("\n\n")
}

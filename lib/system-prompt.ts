import { getPersona, type PersonaId } from "@/lib/personas"

export interface MemoryState {
  about: string
  facts: string[]
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

  const about = memory?.about?.trim()
  const facts = (memory?.facts ?? []).map((fact) => fact.trim()).filter(Boolean)

  if (about || facts.length > 0) {
    const memoryLines = ["Long-term memory about the user. Use it when relevant; do not reveal it unless asked."]
    if (about) memoryLines.push(`About: ${about}`)
    if (facts.length > 0) {
      memoryLines.push("Facts to remember:")
      memoryLines.push(...facts.map((fact) => `- ${fact}`))
    }
    sections.push(memoryLines.join("\n"))
  }

  return sections.join("\n\n")
}

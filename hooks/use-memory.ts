"use client"

import { useCallback, useEffect, useState } from "react"
import type { MemoryState } from "@/lib/system-prompt"

const STORAGE_KEY = "tans-agents:memory"
const EMPTY_MEMORY: MemoryState = { about: "", facts: [] }

function readMemory(): MemoryState {
  if (typeof window === "undefined") return EMPTY_MEMORY
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_MEMORY
    const parsed = JSON.parse(raw)
    return {
      about: typeof parsed?.about === "string" ? parsed.about : "",
      facts: Array.isArray(parsed?.facts)
        ? parsed.facts.filter((fact: unknown): fact is string => typeof fact === "string")
        : [],
    }
  } catch {
    return EMPTY_MEMORY
  }
}

function writeMemory(memory: MemoryState) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
}

export function useMemory() {
  const [memory, setMemory] = useState<MemoryState>(EMPTY_MEMORY)

  useEffect(() => {
    setMemory(readMemory())
  }, [])

  const updateMemory = useCallback((updater: (memory: MemoryState) => MemoryState) => {
    setMemory((current) => {
      const next = updater(current)
      writeMemory(next)
      return next
    })
  }, [])

  const setAbout = useCallback(
    (about: string) => updateMemory((current) => ({ ...current, about })),
    [updateMemory]
  )

  const addFact = useCallback(
    (fact: string) => {
      const normalized = fact.trim()
      if (!normalized) return
      updateMemory((current) => ({ ...current, facts: [...current.facts, normalized] }))
    },
    [updateMemory]
  )

  const removeFact = useCallback(
    (index: number) =>
      updateMemory((current) => ({
        ...current,
        facts: current.facts.filter((_, i) => i !== index),
      })),
    [updateMemory]
  )

  const clearAll = useCallback(() => updateMemory(() => EMPTY_MEMORY), [updateMemory])

  return { memory, setAbout, addFact, removeFact, clearAll }
}

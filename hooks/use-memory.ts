"use client"

import { useCallback, useEffect, useState } from "react"
import type { MemoryFact, MemoryState } from "@/lib/system-prompt"
import { isMemoryFactExpired, normalizeMemoryState } from "@/lib/system-prompt"

const STORAGE_KEY = "tans-agents:memory"
const EMPTY_MEMORY: MemoryState = { about: "", facts: [] }

type AddFactOptions = {
  confidence?: number
  expiresInDays?: number | null
}

function writeMemory(memory: MemoryState) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
}

function cleanMemory(memory: MemoryState): MemoryState {
  const now = Date.now()
  return {
    about: memory.about,
    facts: memory.facts.filter((fact) => !isMemoryFactExpired(fact, now)),
  }
}

function readMemory(): MemoryState {
  if (typeof window === "undefined") return EMPTY_MEMORY
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_MEMORY
    return cleanMemory(normalizeMemoryState(JSON.parse(raw)))
  } catch {
    return EMPTY_MEMORY
  }
}

function clampConfidence(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.7
  return Math.min(1, Math.max(0, value))
}

function makeExpiresAt(expiresInDays?: number | null): number | undefined {
  if (typeof expiresInDays !== "number" || !Number.isFinite(expiresInDays)) return undefined
  if (expiresInDays <= 0) return undefined
  return Date.now() + expiresInDays * 24 * 60 * 60 * 1000
}

export function useMemory() {
  const [memory, setMemory] = useState<MemoryState>(EMPTY_MEMORY)

  useEffect(() => {
    const next = readMemory()
    setMemory(next)
    writeMemory(next)
  }, [])

  const updateMemory = useCallback((updater: (memory: MemoryState) => MemoryState) => {
    setMemory((current) => {
      const next = cleanMemory(updater(current))
      writeMemory(next)
      return next
    })
  }, [])

  const setAbout = useCallback(
    (about: string) => updateMemory((current) => ({ ...current, about })),
    [updateMemory]
  )

  const addFact = useCallback(
    (text: string, options?: AddFactOptions) => {
      const normalized = text.trim()
      if (!normalized) return
      const confidence = clampConfidence(options?.confidence)
      const expiresAt = makeExpiresAt(options?.expiresInDays)
      updateMemory((current) => {
        const exists = current.facts.some((fact) => fact.text.toLowerCase() === normalized.toLowerCase())
        if (exists) return current
        const fact: MemoryFact = {
          text: normalized,
          confidence,
          createdAt: Date.now(),
          expiresAt,
        }
        return { ...current, facts: [...current.facts, fact] }
      })
    },
    [updateMemory]
  )

  const updateFact = useCallback(
    (index: number, patch: Partial<MemoryFact>) =>
      updateMemory((current) => ({
        ...current,
        facts: current.facts.map((fact, i) =>
          i === index
            ? {
                ...fact,
                ...patch,
                confidence: clampConfidence(typeof patch.confidence === "number" ? patch.confidence : fact.confidence),
              }
            : fact
        ),
      })),
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

  return { memory, setAbout, addFact, updateFact, removeFact, clearAll }
}

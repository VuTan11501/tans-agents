"use client"

import { useCallback, useEffect, useState } from "react"

export interface PromptItem {
  id: string
  title: string
  body: string
  vars?: string[]
}

const STORAGE_KEY = "tans-agents:prompts"
const VAR_PATTERN = /{{\s*([a-zA-Z0-9_-]+)\s*}}/g

function newId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  )
}

export function extractPromptVars(body: string): string[] {
  const vars = new Set<string>()
  for (const match of body.matchAll(VAR_PATTERN)) {
    if (match[1]) vars.add(match[1])
  }
  return Array.from(vars)
}

function normalizePrompt(prompt: Omit<PromptItem, "vars"> & { vars?: string[] }): PromptItem {
  const vars = extractPromptVars(prompt.body)
  return {
    ...prompt,
    title: prompt.title.trim(),
    body: prompt.body,
    vars: vars.length > 0 ? vars : undefined,
  }
}

function readPrompts(): PromptItem[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is PromptItem => {
        return (
          item &&
          typeof item.id === "string" &&
          typeof item.title === "string" &&
          typeof item.body === "string"
        )
      })
      .map((item) => normalizePrompt(item))
  } catch {
    return []
  }
}

function writePrompts(prompts: PromptItem[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts))
}

export function usePrompts() {
  const [prompts, setPrompts] = useState<PromptItem[]>([])

  useEffect(() => {
    setPrompts(readPrompts())

    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) setPrompts(readPrompts())
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const savePrompts = useCallback((next: PromptItem[]) => {
    setPrompts(next)
    writePrompts(next)
  }, [])

  const addPrompt = useCallback(
    (prompt: { title: string; body: string }) => {
      const nextPrompt = normalizePrompt({
        id: newId(),
        title: prompt.title,
        body: prompt.body,
      })
      savePrompts([nextPrompt, ...prompts])
      return nextPrompt
    },
    [prompts, savePrompts]
  )

  const updatePrompt = useCallback(
    (id: string, patch: { title: string; body: string }) => {
      let updated: PromptItem | null = null
      const next = prompts.map((prompt) => {
        if (prompt.id !== id) return prompt
        updated = normalizePrompt({ ...prompt, ...patch })
        return updated
      })
      savePrompts(next)
      return updated
    },
    [prompts, savePrompts]
  )

  const deletePrompt = useCallback(
    (id: string) => {
      savePrompts(prompts.filter((prompt) => prompt.id !== id))
    },
    [prompts, savePrompts]
  )

  return { prompts, addPrompt, updatePrompt, deletePrompt }
}

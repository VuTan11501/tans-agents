"use client"

export interface SnippetItem {
  id: string
  name: string
  content: string
  vars: string[]
}

export const SNIPPETS_STORAGE_KEY = "tans-agents:snippets"

export function extractSnippetVars(content: string): string[] {
  const vars = new Set<string>()
  const re = /{{\s*([a-zA-Z0-9_-]+)\s*}}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(content))) vars.add(match[1])
  return Array.from(vars)
}

export function getSnippets(): SnippetItem[] {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SNIPPETS_STORAGE_KEY) ?? "[]")
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item && typeof item.name === "string" && typeof item.content === "string")
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
        name: item.name,
        content: item.content,
        vars: extractSnippetVars(item.content),
      }))
  } catch {
    return []
  }
}

export function saveSnippets(snippets: SnippetItem[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets))
  window.dispatchEvent(new Event("tans-agents:snippets-changed"))
}

export function addSnippet(input: { name: string; content: string }): SnippetItem {
  const snippet: SnippetItem = {
    id: crypto.randomUUID(),
    name: cleanSnippetName(input.name),
    content: input.content.trim(),
    vars: extractSnippetVars(input.content),
  }
  saveSnippets([...getSnippets(), snippet])
  return snippet
}

export function updateSnippet(id: string, input: { name: string; content: string }) {
  const snippets = getSnippets().map((snippet) =>
    snippet.id === id
      ? { ...snippet, name: cleanSnippetName(input.name), content: input.content.trim(), vars: extractSnippetVars(input.content) }
      : snippet
  )
  saveSnippets(snippets)
}

export function deleteSnippet(id: string) {
  saveSnippets(getSnippets().filter((snippet) => snippet.id !== id))
}

export function expandSnippet(snippet: SnippetItem): string {
  let result = snippet.content
  for (const variable of snippet.vars) {
    const value = typeof window === "undefined" ? "" : window.prompt(`Nhập giá trị cho {{${variable}}}`, "") ?? ""
    result = result.replace(new RegExp(`{{\\s*${escapeRegExp(variable)}\\s*}}`, "g"), value)
  }
  return result
}

export function snippetTrigger(name: string): string {
  return `/${cleanSnippetName(name).toLowerCase().replace(/\s+/g, "-")}`
}

function cleanSnippetName(name: string): string {
  return name.trim().replace(/^\/+/, "").replace(/\s+/g, " ")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

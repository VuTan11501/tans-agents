import type { ProviderKey } from "@/lib/providers"

export type WorkflowStep = {
  id: string
  name: string
  prompt: string
  model?: string
  provider?: string
}

export type Workflow = {
  id: string
  name: string
  steps: WorkflowStep[]
  createdAt: number
}

export type WorkflowRunChunk = {
  stepIndex: number
  partial: string
  done: boolean
}

export type WorkflowRunOptions = {
  provider?: ProviderKey
  model?: string
}

const STORAGE_KEY = "tans-agents:workflows-v1"

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function readAll(): Workflow[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(workflows: Workflow[]) {
  if (!canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows))
}

export function listWorkflows(): Workflow[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt)
}

export function saveWorkflow(wf: Workflow) {
  const workflows = readAll()
  const index = workflows.findIndex((item) => item.id === wf.id)
  if (index >= 0) workflows[index] = wf
  else workflows.push(wf)
  writeAll(workflows)
}

export function deleteWorkflow(id: string) {
  writeAll(readAll().filter((wf) => wf.id !== id))
}

export function getWorkflow(id: string): Workflow | undefined {
  return readAll().find((wf) => wf.id === id)
}

function substitutePrompt(prompt: string, previousOutput: string) {
  return prompt.replace(/\{\{\s*prev\s*\}\}/g, previousOutput)
}

async function streamChat(body: unknown): Promise<AsyncGenerator<string, void, void>> {
  async function* generator() {
    const response = await fetch("/api/chat-sse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!response.ok) throw new Error(await response.text())
    if (!response.body) throw new Error("Không nhận được stream từ model")

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const blocks = buffer.split("\n\n")
      buffer = blocks.pop() ?? ""

      for (const block of blocks) {
        const lines = block.split("\n").filter((line) => line.startsWith("data:"))
        for (const line of lines) {
          const data = line.slice(5).trim()
          if (!data || data === "[DONE]") continue
          try {
            const payload = JSON.parse(data)
            if (payload?.error?.message) throw new Error(payload.error.message)
            const content = payload?.choices?.[0]?.delta?.content
            if (typeof content === "string") yield content
          } catch (error) {
            if (error instanceof SyntaxError) continue
            throw error
          }
        }
      }
    }
  }

  return generator()
}

export async function* runWorkflow(
  wf: Workflow,
  initialInput: string,
  opts: WorkflowRunOptions = {},
): AsyncGenerator<WorkflowRunChunk, void, void> {
  let previousOutput = initialInput

  for (let stepIndex = 0; stepIndex < wf.steps.length; stepIndex += 1) {
    const step = wf.steps[stepIndex]
    const prompt = substitutePrompt(step.prompt, previousOutput)
    let output = ""
    const provider = (step.provider || opts.provider) as ProviderKey | undefined
    const model = step.model || opts.model

    const stream = await streamChat({
      messages: [{ role: "user", content: prompt }],
      provider,
      model,
      enabledTools: [],
    })

    for await (const delta of stream) {
      output += delta
      yield { stepIndex, partial: output, done: false }
    }

    previousOutput = output
    yield { stepIndex, partial: output, done: true }
  }
}

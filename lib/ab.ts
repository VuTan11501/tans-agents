import { PROVIDERS, type ProviderKey } from "@/lib/providers"

export type AbMessage = {
  role: "system" | "user" | "assistant" | "tool"
  content: unknown
}

export type AbStreamCallbacks = {
  onChunkA?: (chunk: string) => void
  onChunkB?: (chunk: string) => void
  onDoneA?: () => void
  onDoneB?: () => void
  onErrorA?: (error: Error) => void
  onErrorB?: (error: Error) => void
}

export type AbStreamOptions = {
  api?: string
  messages: AbMessage[]
  modelA: string
  modelB: string
  body?: Record<string, unknown>
  callbacks?: AbStreamCallbacks
}

export type AbStreamHandle = {
  abort: () => void
  done: Promise<void>
}

function providerForModel(modelId: string): ProviderKey | undefined {
  return (Object.entries(PROVIDERS) as Array<[ProviderKey, (typeof PROVIDERS)[ProviderKey]]>).find(([, config]) =>
    (config.models as readonly string[]).includes(modelId)
  )?.[0]
}

function toApiMessages(messages: AbMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: typeof message.content === "string" ? message.content : String(message.content ?? ""),
  }))
}

async function readSseStream({
  api,
  messages,
  model,
  body,
  signal,
  onChunk,
  onDone,
}: {
  api: string
  messages: AbMessage[]
  model: string
  body?: Record<string, unknown>
  signal: AbortSignal
  onChunk?: (chunk: string) => void
  onDone?: () => void
}) {
  const provider = providerForModel(model) ?? (body?.provider as ProviderKey | undefined)
  const res = await fetch(api, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      ...(body ?? {}),
      provider,
      model,
      messages: toApiMessages(messages),
    }),
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  let doneCalled = false
  const markDone = () => {
    if (doneCalled) return
    doneCalled = true
    onDone?.()
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      while (true) {
        const match = buffer.match(/\r?\n\r?\n/)
        if (!match || match.index === undefined) break
        const frame = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)

        for (const raw of frame.split(/\r?\n/)) {
          const line = raw.trim()
          if (!line || line.startsWith(":")) continue
          if (!line.startsWith("data:")) continue
          const data = line.slice(5).trim()
          if (data === "[DONE]") {
            markDone()
            continue
          }

          const json = JSON.parse(data)
          if (json.error) throw new Error(json.error.message ?? "stream error")
          const choice = json.choices?.[0]
          const content = choice?.delta?.content
          if (typeof content === "string" && content) onChunk?.(content)
          if (choice?.finish_reason) markDone()
        }
      }
    }
  } finally {
    markDone()
  }
}

export function streamAbComparison({
  api = "/api/chat-sse",
  messages,
  modelA,
  modelB,
  body,
  callbacks,
}: AbStreamOptions): AbStreamHandle {
  const controllerA = new AbortController()
  const controllerB = new AbortController()

  const runA = readSseStream({
    api,
    messages,
    model: modelA,
    body,
    signal: controllerA.signal,
    onChunk: callbacks?.onChunkA,
    onDone: callbacks?.onDoneA,
  }).catch((error) => {
    if ((error as any)?.name === "AbortError") return
    const err = error instanceof Error ? error : new Error(String(error))
    callbacks?.onErrorA?.(err)
  })

  const runB = readSseStream({
    api,
    messages,
    model: modelB,
    body,
    signal: controllerB.signal,
    onChunk: callbacks?.onChunkB,
    onDone: callbacks?.onDoneB,
  }).catch((error) => {
    if ((error as any)?.name === "AbortError") return
    const err = error instanceof Error ? error : new Error(String(error))
    callbacks?.onErrorB?.(err)
  })

  return {
    abort: () => {
      controllerA.abort()
      controllerB.abort()
    },
    done: Promise.allSettled([runA, runB]).then(() => undefined),
  }
}

import { PROVIDERS, type ProviderKey } from "@/lib/providers"

export type DebateRole = "system" | "user" | "assistant" | "tool"

export type DebateMessage = {
  role: DebateRole
  content: string
}

export type DebateModelSelection = {
  provider: ProviderKey
  model: string
}

export type DebatePaneResult = {
  content: string
  error?: string
}

export type DebateResult = {
  answerA: DebatePaneResult
  answerB: DebatePaneResult
  synthesis: DebatePaneResult
}

export type DebateCallbacks = {
  onChunkA?: (chunk: string) => void
  onChunkB?: (chunk: string) => void
  onChunkSynth?: (chunk: string) => void
  onDoneA?: () => void
  onDoneB?: () => void
  onDoneSynth?: () => void
  onErrorA?: (error: Error) => void
  onErrorB?: (error: Error) => void
  onErrorSynth?: (error: Error) => void
  onStage?: (stage: "debating" | "synthesizing" | "done") => void
}

export type RunDebateOptions = {
  question: string
  modelA: DebateModelSelection
  modelB: DebateModelSelection
  synthModel: DebateModelSelection
  api?: string
  signal?: AbortSignal
  callbacks?: DebateCallbacks
}

function toApiMessages(messages: DebateMessage[]) {
  return messages.map((message) => ({ role: message.role, content: message.content }))
}

async function readSseStream({
  api,
  messages,
  selection,
  signal,
  onChunk,
  onDone,
}: {
  api: string
  messages: DebateMessage[]
  selection: DebateModelSelection
  signal?: AbortSignal
  onChunk?: (chunk: string) => void
  onDone?: () => void
}): Promise<DebatePaneResult> {
  const res = await fetch(api, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      messages: toApiMessages(messages),
      provider: selection.provider,
      model: selection.model,
      enabledTools: [],
    }),
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  let content = ""
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
          const chunk = choice?.delta?.content
          if (typeof chunk === "string" && chunk) {
            content += chunk
            onChunk?.(chunk)
          }
          if (choice?.finish_reason) markDone()
        }
      }
    }
  } finally {
    markDone()
  }

  return { content }
}

function failedResult(error: unknown): DebatePaneResult {
  const err = error instanceof Error ? error : new Error(String(error))
  return { content: "", error: err.message }
}

export function defaultDebateSelections() {
  const entries = Object.entries(PROVIDERS) as Array<[ProviderKey, (typeof PROVIDERS)[ProviderKey]]>
  const first = entries[0]
  const second = entries.find(([provider]) => provider !== first[0]) ?? first
  const synth = entries.find(([provider]) => provider === "groq") ?? first

  return {
    modelA: { provider: first[0], model: first[1].default },
    modelB: { provider: second[0], model: second[1].default },
    synthModel: { provider: synth[0], model: (synth[1].models as readonly string[]).includes("llama-3.3-70b-versatile") ? "llama-3.3-70b-versatile" : synth[1].default },
  } satisfies Pick<RunDebateOptions, "modelA" | "modelB" | "synthModel">
}

export async function runDebate({
  question,
  modelA,
  modelB,
  synthModel,
  api = "/api/chat-sse",
  signal,
  callbacks,
}: RunDebateOptions): Promise<DebateResult> {
  if (modelA.provider === modelB.provider) {
    throw new Error("Mô hình A và B phải thuộc 2 provider khác nhau.")
  }

  callbacks?.onStage?.("debating")
  const messages: DebateMessage[] = [{ role: "user", content: question }]

  const [answerA, answerB] = await Promise.all([
    readSseStream({
      api,
      messages,
      selection: modelA,
      signal,
      onChunk: callbacks?.onChunkA,
      onDone: callbacks?.onDoneA,
    }).catch((error) => {
      const err = error instanceof Error ? error : new Error(String(error))
      callbacks?.onErrorA?.(err)
      return failedResult(err)
    }),
    readSseStream({
      api,
      messages,
      selection: modelB,
      signal,
      onChunk: callbacks?.onChunkB,
      onDone: callbacks?.onDoneB,
    }).catch((error) => {
      const err = error instanceof Error ? error : new Error(String(error))
      callbacks?.onErrorB?.(err)
      return failedResult(err)
    }),
  ])

  callbacks?.onStage?.("synthesizing")

  const usableA = answerA.content.trim()
  const usableB = answerB.content.trim()
  if (!usableA && !usableB) {
    const error = new Error("Cả hai mô hình đều lỗi, không thể tổng hợp.")
    callbacks?.onErrorSynth?.(error)
    callbacks?.onDoneSynth?.()
    callbacks?.onStage?.("done")
    return { answerA, answerB, synthesis: failedResult(error) }
  }

  const synthPrompt = `Hai mô hình AI đã trả lời câu hỏi: "${question}"

Model A (${modelA.provider}/${modelA.model}): ${usableA || `[Lỗi: ${answerA.error ?? "không có phản hồi"}]`}

Model B (${modelB.provider}/${modelB.model}): ${usableB || `[Lỗi: ${answerB.error ?? "không có phản hồi"}]`}

Hãy tổng hợp thành câu trả lời cuối cùng tốt nhất, đề cập điểm mạnh từ mỗi câu trả lời.${answerA.error || answerB.error ? " Nếu có mô hình lỗi, hãy ghi chú ngắn gọn và tận dụng câu trả lời còn lại." : ""}`

  const synthesis = await readSseStream({
    api,
    messages: [{ role: "user", content: synthPrompt }],
    selection: synthModel,
    signal,
    onChunk: callbacks?.onChunkSynth,
    onDone: callbacks?.onDoneSynth,
  }).catch((error) => {
    const err = error instanceof Error ? error : new Error(String(error))
    callbacks?.onErrorSynth?.(err)
    return failedResult(err)
  })

  callbacks?.onStage?.("done")
  return { answerA, answerB, synthesis }
}

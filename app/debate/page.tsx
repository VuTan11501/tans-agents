"use client"

import { useMemo, useRef, useState } from "react"
import { ArrowLeftRight, Loader2 } from "lucide-react"
import { DebateResult, type DebateCardState } from "@/components/debate-result"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { defaultDebateSelections, runDebate, type DebateModelSelection } from "@/lib/debate"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"

const providerEntries = Object.entries(PROVIDERS) as Array<[ProviderKey, (typeof PROVIDERS)[ProviderKey]]>

function modelLabel(selection: DebateModelSelection) {
  return `${PROVIDERS[selection.provider].label} / ${selection.model}`
}

function initialCard(label: string, selection: DebateModelSelection): DebateCardState {
  return {
    label,
    modelLabel: modelLabel(selection),
    content: "",
    loading: false,
    done: false,
  }
}

export default function DebatePage() {
  const defaults = useMemo(() => defaultDebateSelections(), [])
  const [modelA, setModelA] = useState<DebateModelSelection>(defaults.modelA)
  const [modelB, setModelB] = useState<DebateModelSelection>(defaults.modelB)
  const [synthModel, setSynthModel] = useState<DebateModelSelection>(defaults.synthModel)
  const [question, setQuestion] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [stage, setStage] = useState<"idle" | "debating" | "synthesizing" | "done">("idle")
  const [formError, setFormError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const [answerA, setAnswerA] = useState<DebateCardState>(() => initialCard("Mô hình A", defaults.modelA))
  const [answerB, setAnswerB] = useState<DebateCardState>(() => initialCard("Mô hình B", defaults.modelB))
  const [synthesis, setSynthesis] = useState<DebateCardState>(() => initialCard("Tổng hợp", defaults.synthModel))

  const sameProvider = modelA.provider === modelB.provider
  const canSubmit = question.trim().length > 0 && !sameProvider && !isRunning

  function updateSelection(setter: (next: DebateModelSelection) => void, provider: ProviderKey, model?: string) {
    setter({ provider, model: model ?? PROVIDERS[provider].default })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed) {
      setFormError("Vui lòng nhập Câu hỏi.")
      return
    }
    if (sameProvider) {
      setFormError("Mô hình A và Mô hình B phải thuộc 2 provider khác nhau.")
      return
    }

    setFormError(null)
    setCopied(false)
    setIsRunning(true)
    setStage("debating")
    setAnswerA({ ...initialCard("Mô hình A", modelA), loading: true })
    setAnswerB({ ...initialCard("Mô hình B", modelB), loading: true })
    setSynthesis({ ...initialCard("Tổng hợp", synthModel), loading: false })

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      await runDebate({
        question: trimmed,
        modelA,
        modelB,
        synthModel,
        signal: controller.signal,
        callbacks: {
          onStage: setStage,
          onChunkA: (chunk) => setAnswerA((prev) => ({ ...prev, content: prev.content + chunk })),
          onChunkB: (chunk) => setAnswerB((prev) => ({ ...prev, content: prev.content + chunk })),
          onChunkSynth: (chunk) => setSynthesis((prev) => ({ ...prev, content: prev.content + chunk })),
          onDoneA: () => setAnswerA((prev) => ({ ...prev, loading: false, done: true })),
          onDoneB: () => setAnswerB((prev) => ({ ...prev, loading: false, done: true })),
          onDoneSynth: () => setSynthesis((prev) => ({ ...prev, loading: false, done: true })),
          onErrorA: (error) => setAnswerA((prev) => ({ ...prev, loading: false, done: true, error: error.message })),
          onErrorB: (error) => setAnswerB((prev) => ({ ...prev, loading: false, done: true, error: error.message })),
          onErrorSynth: (error) => setSynthesis((prev) => ({ ...prev, loading: false, done: true, error: error.message })),
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setFormError(message)
    } finally {
      setIsRunning(false)
      setStage("done")
      abortRef.current = null
    }
  }

  async function copySynthesis() {
    if (!synthesis.content.trim()) return
    await navigator.clipboard.writeText(synthesis.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          🥊 Debate
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Chế độ Tranh luận AI</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Chọn 2 mô hình từ 2 provider khác nhau, nhận câu trả lời song song, rồi dùng Mô hình tổng hợp để chốt khuyến nghị cuối cùng.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Thiết lập tranh luận</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <ModelPicker label="Mô hình A" value={modelA} onChange={setModelA} />
              <ModelPicker label="Mô hình B" value={modelB} onChange={setModelB} />
              <ModelPicker label="Mô hình tổng hợp" value={synthModel} onChange={setSynthModel} />
            </div>

            {sameProvider ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Mô hình A và Mô hình B phải thuộc 2 provider khác nhau.
              </p>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="debate-question">Câu hỏi</label>
              <Textarea
                id="debate-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Nhập câu hỏi hoặc vấn đề cần hai AI tranh luận..."
                className="min-h-32 resize-y"
                disabled={isRunning}
              />
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
                <span>{stage === "debating" ? "Đang chạy A/B song song..." : stage === "synthesizing" ? "Tổng hợp..." : stage === "done" ? "Hoàn tất" : "Đang chờ..."}</span>
              </div>
              <Button type="submit" className="gap-2" disabled={!canSubmit}>
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : "🥊"} Tranh luận
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <DebateResult
        answerA={answerA}
        answerB={answerB}
        synthesis={{ ...synthesis, loading: stage === "synthesizing" && isRunning && !synthesis.done && !synthesis.error }}
        onCopy={copySynthesis}
      />
      {copied ? <p className="text-center text-sm text-emerald-500">Đã copy kết quả.</p> : null}
    </main>
  )
}

function ModelPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: DebateModelSelection
  onChange: (next: DebateModelSelection) => void
}) {
  const models = PROVIDERS[value.provider].models

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Select value={value.provider} onValueChange={(provider) => onChange({ provider: provider as ProviderKey, model: PROVIDERS[provider as ProviderKey].default })}>
        <SelectTrigger aria-label={`${label} provider`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {providerEntries.map(([provider, config]) => (
            <SelectItem key={provider} value={provider}>{config.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={value.model} onValueChange={(model) => onChange({ ...value, model })}>
        <SelectTrigger aria-label={`${label} model`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model} value={model}>{model}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

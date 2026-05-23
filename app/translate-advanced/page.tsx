"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const LANGUAGES = [
  { value: "vietnamese", label: "🇻🇳 Vietnamese" },
  { value: "english", label: "🇬🇧 English" },
  { value: "spanish", label: "🇪🇸 Spanish" },
  { value: "french", label: "🇫🇷 French" },
  { value: "japanese", label: "🇯🇵 Japanese" },
  { value: "chinese", label: "🇨🇳 Chinese" },
  { value: "german", label: "🇩🇪 German" },
  { value: "portuguese", label: "🇵🇹 Portuguese" },
] as const

type TranslationHistory = {
  id: string
  date: string
  sourceLanguage: string
  targetLanguage: string
  sourceText: string
  translatedText: string
  terminology?: string
}

export default function TranslateAdvancedPage() {
  const [sourceText, setSourceText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [sourceLanguage, setSourceLanguage] = useState<(typeof LANGUAGES)[number]["value"]>("english")
  const [targetLanguage, setTargetLanguage] = useState<(typeof LANGUAGES)[number]["value"]>("vietnamese")
  const [terminology, setTerminology] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState<TranslationHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("tans-agents:translations-v1")
    if (stored) {
      try {
        setHistory(JSON.parse(stored))
      } catch {
        // ignore
      }
    }
  }, [])

  async function handleTranslate() {
    const text = sourceText.trim()
    if (!text || isStreaming) return

    const controller = new AbortController()
    abortRef.current = controller
    setIsStreaming(true)
    setTranslatedText("")
    setError(null)
    setCopied(false)

    try {
      const systemPrompt = buildSystemPrompt()
      const userMessage = buildUserMessage(text)

      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          enabledTools: [],
          messages: [{ role: "user", content: userMessage }],
          personaSystemPrompt: systemPrompt,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("No stream from server")

      let result = ""
      await readSseStream(response.body, (chunk) => {
        result += chunk
        setTranslatedText(result)
      })

      // Save to history
      if (result.trim()) {
        const newEntry: TranslationHistory = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          sourceLanguage,
          targetLanguage,
          sourceText: text,
          translatedText: result,
          terminology: terminology || undefined,
        }
        const updatedHistory = [newEntry, ...history]
        setHistory(updatedHistory)
        localStorage.setItem("tans-agents:translations-v1", JSON.stringify(updatedHistory.slice(0, 50)))
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError("Translation stopped.")
      } else {
        setError(err?.message ?? "Translation error occurred.")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsStreaming(false)
    }
  }

  function buildSystemPrompt(): string {
    let prompt = `You are a professional translator specializing in accurate, context-aware translation.`

    if (terminology.trim()) {
      prompt += ` Use the following terminology references:\n${terminology}\n`
    }

    prompt += `Translate from ${sourceLanguage} to ${targetLanguage}. Return only the translation, no explanations.`
    return prompt
  }

  function buildUserMessage(text: string): string {
    if (terminology.trim()) {
      return `Translate the following text, respecting the terminology guide:\n\nTerminology:\n${terminology}\n\nText to translate:\n${text}`
    }
    return `Translate:\n${text}`
  }

  function abortTranslate() {
    abortRef.current?.abort()
  }

  function swapLanguages() {
    setSourceLanguage(targetLanguage)
    setTargetLanguage(sourceLanguage)
    setTranslatedText("")
  }

  async function copyTranslation() {
    if (!translatedText) return
    await navigator.clipboard.writeText(translatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function downloadTranslation() {
    if (!translatedText) return
    const text = `Source (${sourceLanguage}):\n${sourceText}\n\n---\n\nTranslation (${targetLanguage}):\n${translatedText}`
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `translation-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  function deleteHistoryItem(id: string) {
    const updated = history.filter((h) => h.id !== id)
    setHistory(updated)
    localStorage.setItem("tans-agents:translations-v1", JSON.stringify(updated))
  }

  function loadHistoryItem(item: TranslationHistory) {
    setSourceLanguage(item.sourceLanguage as typeof sourceLanguage)
    setTargetLanguage(item.targetLanguage as typeof targetLanguage)
    setSourceText(item.sourceText)
    setTranslatedText(item.translatedText)
    if (item.terminology) {
      setTerminology(item.terminology)
    }
    setShowHistory(false)
  }

  const canTranslate = sourceText.trim().length > 0 && !isStreaming

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <Card>
          <CardHeader className="gap-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <CardDescription>Advanced Translation Engine</CardDescription>
                <CardTitle className="mt-1 text-2xl">📝 Document Translation with Memory</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Provider: <code>{PROVIDER}</code> • Model: <code>{MODEL}</code>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isStreaming ? (
                  <Button type="button" variant="destructive" onClick={abortTranslate}>
                    Stop
                  </Button>
                ) : (
                  <Button type="button" onClick={handleTranslate} disabled={!canTranslate}>
                    Translate
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowHistory(!showHistory)}
                  disabled={history.length === 0}
                >
                  📚 History ({history.length})
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* History Panel */}
        {showHistory && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
            <CardHeader>
              <CardTitle className="text-lg">Translation History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {history.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-2 rounded border p-2 hover:bg-white/50 dark:hover:bg-black/20">
                    <button
                      className="flex-1 text-left hover:underline"
                      onClick={() => loadHistoryItem(item)}
                    >
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString()}
                      </p>
                      <p className="line-clamp-2 text-sm font-medium">{item.sourceText}</p>
                      <div className="mt-1 flex gap-1">
                        <Badge variant="outline" className="text-xs">{item.sourceLanguage}</Badge>
                        <Badge variant="outline" className="text-xs">→</Badge>
                        <Badge variant="outline" className="text-xs">{item.targetLanguage}</Badge>
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteHistoryItem(item.id)}
                      className="text-destructive hover:bg-red-100 dark:hover:bg-red-950"
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Translation Area */}
        <section className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
          {/* Source Panel */}
          <Card className="min-h-[34rem]">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Source Text</CardTitle>
                  <CardDescription>{sourceText.length.toLocaleString()} characters</CardDescription>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="source-language" className="text-sm font-medium">
                  Source Language
                </label>
                <Select value={sourceLanguage} onValueChange={(value) => setSourceLanguage(value as typeof sourceLanguage)}>
                  <SelectTrigger id="source-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                className="min-h-[20rem] resize-y bg-background text-sm leading-relaxed"
                placeholder="Paste your text here..."
              />
              <div className="space-y-2">
                <label htmlFor="terminology" className="text-sm font-medium">
                  Terminology Memory (optional)
                </label>
                <Textarea
                  id="terminology"
                  value={terminology}
                  onChange={(e) => setTerminology(e.target.value)}
                  className="min-h-[6rem] resize-y bg-background text-xs leading-relaxed"
                  placeholder="Add terminology references (e.g., business_term: 'kinh doanh', company: 'công ty')"
                />
              </div>
            </CardContent>
          </Card>

          {/* Swap Button */}
          <div className="flex justify-center lg:pt-28">
            <Button
              type="button"
              variant="secondary"
              onClick={swapLanguages}
              disabled={isStreaming}
              aria-label="Swap languages"
              className="text-xl"
            >
              ⇄
            </Button>
          </div>

          {/* Target Panel */}
          <Card className="min-h-[34rem]">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Translation</CardTitle>
                  <CardDescription>{translatedText.length.toLocaleString()} characters</CardDescription>
                </div>
                {isStreaming && <span className="text-xs text-muted-foreground">Translating...</span>}
              </div>
              <div className="space-y-2">
                <label htmlFor="target-language" className="text-sm font-medium">
                  Target Language
                </label>
                <Select value={targetLanguage} onValueChange={(value) => setTargetLanguage(value as typeof targetLanguage)}>
                  <SelectTrigger id="target-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={translatedText}
                onChange={(e) => setTranslatedText(e.target.value)}
                className="min-h-[20rem] resize-y bg-background text-sm leading-relaxed"
                placeholder="Translation will appear here..."
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={copyTranslation}
                  disabled={!translatedText}
                  className="flex-1"
                >
                  {copied ? "✓ Copied" : "📋 Copy"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={downloadTranslation}
                  disabled={!translatedText}
                  className="flex-1"
                >
                  💾 Download
                </Button>
              </div>
              <div className="min-h-5 text-sm">
                {error && <span className="text-destructive">{error}</span>}
                {isStreaming && <span className="text-muted-foreground">AI is translating...</span>}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}

async function readSseStream(body: ReadableStream<Uint8Array>, onContent: (content: string) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""

    for (const event of events) {
      parseSseEvent(event, onContent)
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) parseSseEvent(buffer, onContent)
}

function parseSseEvent(event: string, onContent: (content: string) => void) {
  const dataLines = event
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())

  for (const data of dataLines) {
    if (!data || data === "[DONE]") continue

    const payload = JSON.parse(data)
    if (payload?.error?.message) throw new Error(payload.error.message)

    const content = payload?.choices?.[0]?.delta?.content
    if (typeof content === "string") onContent(content)
  }
}

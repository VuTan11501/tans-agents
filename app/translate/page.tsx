"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const LANGUAGES = [
  { value: "Auto-detect", label: "Auto-detect" },
  { value: "Tiếng Việt", label: "Tiếng Việt" },
  { value: "English", label: "English" },
  { value: "日本語", label: "日本語" },
  { value: "中文", label: "中文" },
  { value: "Français", label: "Français" },
  { value: "Deutsch", label: "Deutsch" },
  { value: "Español", label: "Español" },
  { value: "한국어", label: "한국어" },
] as const

export default function TranslatePage() {
  const [sourceText, setSourceText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [sourceLanguage, setSourceLanguage] = useState<(typeof LANGUAGES)[number]["value"]>("Auto-detect")
  const [targetLanguage, setTargetLanguage] = useState<(typeof LANGUAGES)[number]["value"]>("English")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const canTranslate = useMemo(() => sourceText.trim().length > 0 && !isStreaming, [sourceText, isStreaming])

  async function translate() {
    const text = sourceText.trim()
    if (!text || isStreaming) return

    const controller = new AbortController()
    abortRef.current = controller
    setIsStreaming(true)
    setTranslatedText("")
    setError(null)
    setCopied(false)

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          enabledTools: [],
          messages: [{ role: "user", content: text }],
          personaSystemPrompt: `Bạn là một dịch giả chuyên nghiệp. Dịch văn bản từ ${sourceLanguage} sang ${targetLanguage}. Chỉ trả về bản dịch, không giải thích.`,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => {
        setTranslatedText((current) => current + chunk)
      })
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setError("Đã dừng dịch.")
      } else {
        setError(err?.message ?? "Có lỗi khi gọi AI.")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsStreaming(false)
    }
  }

  function abortTranslate() {
    abortRef.current?.abort()
  }

  function swapLanguages() {
    setSourceLanguage(targetLanguage)
    setTargetLanguage(sourceLanguage)
  }

  async function copyTranslation() {
    if (!translatedText) return
    await navigator.clipboard.writeText(translatedText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <Card>
          <CardHeader className="gap-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <CardDescription>Dịch thuật AI</CardDescription>
                <CardTitle className="mt-1 text-2xl">Dịch văn bản song song</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Provider: <code>{PROVIDER}</code> • Model: <code>{MODEL}</code>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isStreaming ? (
                  <Button type="button" variant="destructive" onClick={abortTranslate}>
                    Dừng
                  </Button>
                ) : (
                  <Button type="button" onClick={translate} disabled={!canTranslate}>
                    Dịch
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={copyTranslation} disabled={!translatedText}>
                  {copied ? "Đã sao chép" : "Sao chép bản dịch"}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <section className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
          <Card className="min-h-[34rem]">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Văn bản nguồn</CardTitle>
                  <CardDescription>{sourceText.length.toLocaleString("vi-VN")} ký tự</CardDescription>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="source-language" className="text-sm font-medium">
                  Ngôn ngữ nguồn
                </label>
                <Select value={sourceLanguage} onValueChange={(value) => setSourceLanguage(value as typeof sourceLanguage)}>
                  <SelectTrigger id="source-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((language) => (
                      <SelectItem key={language.value} value={language.value}>
                        {language.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                className="min-h-[24rem] resize-y bg-background text-sm leading-relaxed"
                placeholder="Nhập hoặc dán văn bản cần dịch..."
              />
            </CardContent>
          </Card>

          <div className="flex justify-center lg:pt-28">
            <Button type="button" variant="secondary" onClick={swapLanguages} disabled={isStreaming} aria-label="Đổi ngôn ngữ">
              ⇄
            </Button>
          </div>

          <Card className="min-h-[34rem]">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Bản dịch</CardTitle>
                  <CardDescription>{translatedText.length.toLocaleString("vi-VN")} ký tự</CardDescription>
                </div>
                {isStreaming && <span className="text-xs text-muted-foreground">Đang dịch...</span>}
              </div>
              <div className="space-y-2">
                <label htmlFor="target-language" className="text-sm font-medium">
                  Ngôn ngữ đích
                </label>
                <Select value={targetLanguage} onValueChange={(value) => setTargetLanguage(value as typeof targetLanguage)}>
                  <SelectTrigger id="target-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((language) => (
                      <SelectItem key={language.value} value={language.value}>
                        {language.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={translatedText}
                onChange={(event) => setTranslatedText(event.target.value)}
                className="min-h-[24rem] resize-y bg-background text-sm leading-relaxed"
                placeholder="Bản dịch sẽ được stream tại đây..."
              />
              <div className="mt-3 min-h-5 text-sm">
                {error && <span className="text-destructive">{error}</span>}
                {isStreaming && <span className="text-muted-foreground">AI đang trả bản dịch theo thời gian thực.</span>}
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

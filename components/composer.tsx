"use client"
import { useRef, useEffect, useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react"
import { ArrowUp, Eye, FileText, Mic, Paperclip, Square, X } from "lucide-react"
import { MarkdownPreview } from "@/components/markdown-preview"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { matchSlash, SLASH_COMMANDS, type SlashCommand } from "@/lib/slash"
import { countTokens } from "@/lib/tokens"
import { useSpeechRecognition } from "@/hooks/use-voice"
import { cn } from "@/lib/utils"

type QuoteEventDetail = {
  text?: string
  sourceMessageId?: string
}

interface ComposerProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: FormEvent) => void
  onStop?: () => void
  isStreaming: boolean
  disabled?: boolean
  placeholder?: string
  tokenStats?: { input: number; output: number; cost: string | null }
  messages?: Array<{ content?: unknown }>
  model?: string
  files?: File[]
  onFilesChange?: (files: File[]) => void
}

const MAX_FILES = 4
const ACCEPTED_FILE_TYPES = "image/*,application/pdf,text/*"
const PREVIEW_STORAGE_KEY = "tans:composer:preview"
const DEFAULT_CONTEXT_LIMIT = 128_000
const CONTEXT_LIMITS: Record<string, number> = {
  auto: DEFAULT_CONTEXT_LIMIT,
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "gemini-2.5-flash-lite": 1_000_000,
  "gemini-2.5-flash": 1_000_000,
  "gemini-2.5-pro": 1_000_000,
  "gemini-2.0-flash": 1_000_000,
  "gemini-2.0-flash-lite": 1_000_000,
  "llama-3.3-70b-versatile": 131_072,
  "llama-3.1-8b-instant": 131_072,
  "openai/gpt-oss-120b": 131_072,
  "openai/gpt-oss-20b": 131_072,
  "qwen/qwen3-32b": 131_072,
  "meta-llama/llama-4-scout-17b-16e-instruct": 131_072,
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function isAcceptedFile(file: File) {
  return file.type.startsWith("image/") || file.type === "application/pdf" || file.type.startsWith("text/")
}

function formatQuotedMessage(quote: string, input: string) {
  const quotedMarkdown = `> ${quote.trim().split("\n").join("\n> ")}`
  return [quotedMarkdown, input.trim()].filter(Boolean).join("\n\n")
}

export function Composer({ value, onChange, onSubmit, onStop, isStreaming, disabled, placeholder, tokenStats, messages = [], model, files = [], onFilesChange }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const voiceBaseRef = useRef("")
  const { supported: voiceSupported, listening: voiceListening, transcript: voiceTranscript, start: startVoice, stop: stopVoice } = useSpeechRecognition({ lang: "vi-VN" })
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [isNarrow, setIsNarrow] = useState(false)
  const [quotedText, setQuotedText] = useState<string | null>(null)
  const [pendingQuotedSubmit, setPendingQuotedSubmit] = useState<string | null>(null)
  const [markdownPreviewOpen, setMarkdownPreviewOpen] = useState(false)
  const [previewValue, setPreviewValue] = useState(value)
  useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(max-width: 640px)")
    const update = () => setIsNarrow(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  useEffect(() => {
    if (typeof window === "undefined") return
    setMarkdownPreviewOpen(window.localStorage.getItem(PREVIEW_STORAGE_KEY) === "true")
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, String(markdownPreviewOpen))
  }, [markdownPreviewOpen])

  useEffect(() => {
    const timeout = window.setTimeout(() => setPreviewValue(value), 100)
    return () => window.clearTimeout(timeout)
  }, [value])

  const slash = matchSlash(value)
  const slashMatches = slashOpen && slash ? slash.matches : []
  const showSlash = slashMatches.length > 0
  const composedValue = quotedText ? formatQuotedMessage(quotedText, value) : value
  const canSubmit = (!!value.trim() || !!quotedText || files.length > 0) && !disabled
  const contextUsage = useMemo(() => {
    const used = messages.reduce((sum, message) => {
      return sum + countTokens(typeof message.content === "string" ? message.content : "")
    }, countTokens(composedValue))
    const limit = (model && CONTEXT_LIMITS[model]) || DEFAULT_CONTEXT_LIMIT
    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0
    return { used, limit, pct, barPct: Math.min(100, Math.max(0, pct)) }
  }, [messages, model, composedValue])
  const contextBarClass = contextUsage.pct < 50 ? "bg-primary" : contextUsage.pct <= 80 ? "bg-amber-500" : "bg-red-500"

  // Auto-grow
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 240) + "px"
  }, [value])

  useEffect(() => {
    if (!showSlash) return
    if (slashIndex >= slashMatches.length) setSlashIndex(0)
  }, [showSlash, slashMatches.length, slashIndex])

  useEffect(() => {
    function handleQuote(event: Event) {
      const detail = (event as CustomEvent<QuoteEventDetail>).detail
      const text = detail?.text?.trim()
      if (!text) return
      setQuotedText(text)
      setSlashOpen(false)
      window.requestAnimationFrame(() => {
        ref.current?.focus()
        const end = ref.current?.value.length ?? 0
        ref.current?.setSelectionRange(end, end)
      })
    }

    window.addEventListener("tans:quote", handleQuote)
    return () => window.removeEventListener("tans:quote", handleQuote)
  }, [])

  useEffect(() => {
    if (!pendingQuotedSubmit || value !== pendingQuotedSubmit) return
    setPendingQuotedSubmit(null)
    onSubmit({ preventDefault() {} } as FormEvent)
  }, [onSubmit, pendingQuotedSubmit, value])

  useEffect(() => {
    const urls: Record<string, string> = {}
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        urls[fileKey(file)] = URL.createObjectURL(file)
      }
    }
    setPreviewUrls(urls)
    return () => {
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [files])

  function selectSlashCommand(cmd: SlashCommand) {
    const next = cmd.template("")
    onChange(next)
    setSlashOpen(false)
    setSlashIndex(0)
    window.requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(next.length, next.length)
    })
  }

  function handleChange(next: string) {
    onChange(next)
    const nextSlash = matchSlash(next)
    setSlashOpen(!!nextSlash && nextSlash.matches.length > 0)
    setSlashIndex(0)
  }

  useEffect(() => {
    if (!voiceTranscript) return
    const base = voiceBaseRef.current
    const separator = base.trim() && !base.endsWith(" ") ? " " : ""
    handleChange(`${base}${separator}${voiceTranscript}`)
  }, [voiceTranscript])

  function handleVoiceToggle() {
    if (voiceListening) {
      stopVoice()
      return
    }
    voiceBaseRef.current = value
    startVoice()
    ref.current?.focus()
  }

  function addFiles(nextFiles: File[]) {
    if (!onFilesChange) return
    const accepted = nextFiles.filter(isAcceptedFile)
    if (accepted.length === 0) return
    onFilesChange([...files, ...accepted].slice(0, MAX_FILES))
  }

  function removeFile(index: number) {
    onFilesChange?.(files.filter((_, i) => i !== index))
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ""
  }

  function handleDragOver(e: DragEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLFormElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragging(false)
    }
  }

  function handleDrop(e: DragEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    addFiles(Array.from(e.dataTransfer.files ?? []))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!quotedText) {
      onSubmit(e)
      return
    }

    const finalMessage = formatQuotedMessage(quotedText, value)
    if (!finalMessage.trim() && files.length === 0) return

    setPendingQuotedSubmit(finalMessage)
    setQuotedText(null)
    setSlashOpen(false)
    onChange(finalMessage)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (showSlash) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSlashIndex((i) => (i + 1) % slashMatches.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSlashIndex((i) => (i - 1 + slashMatches.length) % slashMatches.length)
        return
      }
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault()
        selectSlashCommand(slashMatches[slashIndex] ?? slashMatches[0])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setSlashOpen(false)
        return
      }
    }

    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (canSubmit && !isStreaming) {
        handleSubmit(e as unknown as FormEvent)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="relative">
      {showSlash && (
        <div className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
          {slashMatches.map((cmd, index) => (
            <button
              key={cmd.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                selectSlashCommand(cmd)
              }}
              onMouseEnter={() => setSlashIndex(index)}
              className={cn(
                "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors",
                index === slashIndex && "bg-accent text-accent-foreground"
              )}
            >
              <span className="min-w-20 text-sm font-medium">{cmd.label}</span>
              <span className="text-xs text-muted-foreground">{cmd.description}</span>
            </button>
          ))}
          <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
            ↑↓ chọn, Enter, Esc đóng · {SLASH_COMMANDS.length} lệnh
          </div>
        </div>
      )}
      <div
        className={cn(
          "group relative rounded-3xl border border-border/80 bg-card/80 p-2 pl-4 shadow-lg backdrop-blur-md transition-all",
          "focus-within:border-foreground/30 focus-within:shadow-xl",
          isDragging && "border-violet-400 bg-violet-500/10"
        )}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-violet-400 bg-background/70 text-sm font-medium text-violet-500 backdrop-blur-sm">
            Thả file vào đây (tối đa {MAX_FILES})
          </div>
        )}

        <div className="mb-2 flex items-center gap-2 pr-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              style={{ width: `${contextUsage.barPct}%` }}
              className={cn("h-full rounded-full transition-all", contextBarClass)}
            />
          </div>
          <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
            Đang dùng {contextUsage.used.toLocaleString()} / {contextUsage.limit.toLocaleString()} token ({contextUsage.pct}%)
          </span>
        </div>

        {quotedText && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-l-4 border-border border-l-violet-500 bg-muted/45 px-3 py-2 pr-2 text-sm text-muted-foreground">
            <div className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed">{quotedText}</div>
            <button
              type="button"
              onClick={() => setQuotedText(null)}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
              aria-label="Bỏ trích dẫn"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 pr-2">
            {files.map((file, index) => {
              const key = fileKey(file)
              const isImage = file.type.startsWith("image/")
              return (
                <div key={key} className="flex max-w-[220px] items-center gap-2 rounded-xl border bg-background/80 px-2 py-1 text-xs shadow-sm">
                  {isImage ? (
                    <img src={previewUrls[key]} alt={file.name} className="h-9 w-9 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                  )}
                  <span className="truncate" title={file.name}>{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Xóa ${file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className={cn("min-w-0 flex-1", markdownPreviewOpen && "grid grid-cols-1 gap-2 md:grid-cols-2")}>
            <Textarea
              ref={ref}
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || (isNarrow ? "Hỏi gì đó..." : "Hỏi bất cứ điều gì... (Shift + Enter để xuống dòng)")}
              disabled={disabled}
              rows={1}
              className="min-h-[28px] max-h-60 resize-none border-0 bg-transparent p-0 py-2 pb-5 text-[15px] shadow-none focus-visible:ring-0"
              autoFocus
            />
            {markdownPreviewOpen && <MarkdownPreview value={previewValue} className="max-h-60" />}
          </div>

          <div className="absolute bottom-1 left-4 flex gap-1" title="Số token ước tính (cl100k)">
            <Badge variant="outline" className="text-[10px] font-mono">
              {countTokens(composedValue)} tokens
            </Badge>
            {tokenStats && (
              <Badge variant="outline" className="text-[10px] font-mono">
                ↑ {tokenStats.input} ↓ {tokenStats.output} · {tokenStats.cost ?? "—"}
              </Badge>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            onChange={handleFileInput}
            className="hidden"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={disabled}
                onClick={() => setMarkdownPreviewOpen((open) => !open)}
                aria-pressed={markdownPreviewOpen}
                className={cn(
                  "h-9 w-9 shrink-0 rounded-full",
                  markdownPreviewOpen && "bg-muted text-primary hover:bg-muted/80 hover:text-primary"
                )}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Xem trước Markdown</TooltipContent>
          </Tooltip>

          {voiceSupported && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={disabled}
              onClick={handleVoiceToggle}
              className={cn(
                "h-9 w-9 shrink-0 rounded-full",
                voiceListening && "animate-pulse bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-600"
              )}
              title={voiceListening ? "Dừng ghi âm" : "Nhập bằng giọng nói"}
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}

          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={disabled || files.length >= MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
            className="h-9 w-9 shrink-0 rounded-full"
            title="Đính kèm file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          {isStreaming ? (
            <Button
              type="button"
              onClick={onStop}
              size="icon"
              variant="default"
              className="h-9 w-9 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!canSubmit}
              className={cn(
                "send-glow h-9 w-9 shrink-0 rounded-full",
                canSubmit
                  ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

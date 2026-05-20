"use client"
import { useRef, useEffect, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react"
import { ArrowUp, FileText, Mic, Paperclip, Square, X } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { matchSlash, SLASH_COMMANDS, type SlashCommand } from "@/lib/slash"
import { countTokens } from "@/lib/tokens"
import { useSpeechRecognition } from "@/hooks/use-voice"
import { cn } from "@/lib/utils"

interface ComposerProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: FormEvent) => void
  onStop?: () => void
  isStreaming: boolean
  disabled?: boolean
  placeholder?: string
  tokenStats?: { input: number; output: number; cost: string | null }
  files?: File[]
  onFilesChange?: (files: File[]) => void
}

const MAX_FILES = 4
const ACCEPTED_FILE_TYPES = "image/*,application/pdf,text/*"

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function isAcceptedFile(file: File) {
  return file.type.startsWith("image/") || file.type === "application/pdf" || file.type.startsWith("text/")
}

export function Composer({ value, onChange, onSubmit, onStop, isStreaming, disabled, placeholder, tokenStats, files = [], onFilesChange }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const voiceBaseRef = useRef("")
  const { supported: voiceSupported, listening: voiceListening, transcript: voiceTranscript, start: startVoice, stop: stopVoice } = useSpeechRecognition({ lang: "vi-VN" })
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const slash = matchSlash(value)
  const slashMatches = slashOpen && slash ? slash.matches : []
  const showSlash = slashMatches.length > 0
  const canSubmit = (!!value.trim() || files.length > 0) && !disabled

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
        onSubmit(e as unknown as FormEvent)
      }
    }
  }

  return (
    <form onSubmit={onSubmit} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="relative">
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
          <Textarea
            ref={ref}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Hỏi bất cứ điều gì... (Shift + Enter để xuống dòng)"}
            disabled={disabled}
            rows={1}
            className="min-h-[28px] flex-1 resize-none border-0 bg-transparent p-0 py-2 pb-5 text-[15px] shadow-none focus-visible:ring-0"
            autoFocus
          />

          <div className="absolute bottom-1 left-4 flex gap-1" title="Số token ước tính (cl100k)">
            <Badge variant="outline" className="text-[10px] font-mono">
              {countTokens(value)} tokens
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

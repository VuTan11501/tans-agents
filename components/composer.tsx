"use client"
import { useRef, useEffect, useState, type FormEvent, type KeyboardEvent } from "react"
import { ArrowUp, Square } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { matchSlash, SLASH_COMMANDS, type SlashCommand } from "@/lib/slash"
import { cn } from "@/lib/utils"

interface ComposerProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: FormEvent) => void
  onStop?: () => void
  isStreaming: boolean
  disabled?: boolean
  placeholder?: string
}

export function Composer({ value, onChange, onSubmit, onStop, isStreaming, disabled, placeholder }: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashIndex, setSlashIndex] = useState(0)
  const slash = matchSlash(value)
  const slashMatches = slashOpen && slash ? slash.matches : []
  const showSlash = slashMatches.length > 0

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
      if (value.trim() && !isStreaming) {
        onSubmit(e as any)
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative">
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
          "group relative flex items-end gap-2 rounded-3xl border border-border/80 bg-card/80 p-2 pl-4 shadow-lg backdrop-blur-md transition-all",
          "focus-within:border-foreground/30 focus-within:shadow-xl"
        )}
      >
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Hỏi bất cứ điều gì... (Shift + Enter để xuống dòng)"}
          disabled={disabled}
          rows={1}
          className="min-h-[28px] flex-1 resize-none border-0 bg-transparent p-0 py-2 text-[15px] shadow-none focus-visible:ring-0"
          autoFocus
        />

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
            disabled={!value.trim() || disabled}
            className={cn(
              "send-glow h-9 w-9 shrink-0 rounded-full",
              value.trim()
                ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white hover:from-violet-400 hover:to-fuchsia-400"
                : "bg-muted text-muted-foreground"
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  )
}

"use client"
import { useRef, useEffect, type FormEvent, type KeyboardEvent } from "react"
import { ArrowUp, Square } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
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

  // Auto-grow
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 240) + "px"
  }, [value])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (value.trim() && !isStreaming) {
        onSubmit(e as any)
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative">
      <div
        className={cn(
          "group relative flex items-end gap-2 rounded-3xl border border-border/80 bg-card/80 p-2 pl-4 shadow-lg backdrop-blur-md transition-all",
          "focus-within:border-foreground/30 focus-within:shadow-xl"
        )}
      >
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
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

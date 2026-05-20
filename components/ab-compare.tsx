"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type AbPaneState = {
  model: string
  content: string
  done: boolean
  error?: string
}

interface AbCompareProps {
  a: AbPaneState
  b: AbPaneState
  onPick: (side: "a" | "b") => void
}

export function AbCompare({ a, b, onPick }: AbCompareProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <AbCard label="Mô hình A" state={a} onPick={() => onPick("a")} />
      <AbCard label="Mô hình B" state={b} onPick={() => onPick("b")} />
    </div>
  )
}

function AbCard({ label, state, onPick }: { label: string; state: AbPaneState; onPick: () => void }) {
  const canPick = state.done && !!state.content.trim() && !state.error

  return (
    <Card className={cn("overflow-hidden border-border/70 bg-card/80", !state.done && "ring-1 ring-primary/20")}>
      <CardHeader className="space-y-2 border-b border-border/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{label}</span>
          {!state.done && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="truncate font-mono text-xs text-muted-foreground" title={state.model}>{state.model}</div>
      </CardHeader>
      <CardContent className="min-h-40 p-3">
        {state.error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {state.error}
          </div>
        ) : state.content ? (
          <div className="prose-chat text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Đang chờ phản hồi...</p>
        )}
      </CardContent>
      <CardFooter className="border-t border-border/60 p-3">
        {state.done ? (
          <Button type="button" size="sm" className="w-full gap-2" onClick={onPick} disabled={!canPick}>
            <Check className="h-4 w-4" /> ✓ Chọn câu này
          </Button>
        ) : (
          <div className="flex w-full items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang trả lời...
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

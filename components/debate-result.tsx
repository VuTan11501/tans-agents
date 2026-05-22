"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { CheckCircle2, Copy, Loader2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type DebateCardState = {
  label: string
  modelLabel: string
  content: string
  loading: boolean
  done: boolean
  error?: string
}

export function DebateResult({
  answerA,
  answerB,
  synthesis,
  onCopy,
}: {
  answerA: DebateCardState
  answerB: DebateCardState
  synthesis: DebateCardState
  onCopy: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DebateAnswerCard state={answerA} />
        <DebateAnswerCard state={answerB} />
      </div>
      <DebateAnswerCard state={synthesis} featured footer={
        <Button type="button" variant="secondary" className="gap-2" onClick={onCopy} disabled={!synthesis.content.trim()}>
          <Copy className="h-4 w-4" /> Copy kết quả
        </Button>
      } />
    </div>
  )
}

function DebateAnswerCard({
  state,
  featured = false,
  footer,
}: {
  state: DebateCardState
  featured?: boolean
  footer?: React.ReactNode
}) {
  return (
    <Card className={cn("overflow-hidden border-border/70 bg-card/80", state.loading && "ring-1 ring-primary/25", featured && "border-primary/30")}>
      <CardHeader className="space-y-2 border-b border-border/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{state.label}</CardTitle>
          <StatusIcon state={state} />
        </div>
        <div className="truncate font-mono text-xs text-muted-foreground" title={state.modelLabel}>{state.modelLabel}</div>
      </CardHeader>
      <CardContent className="min-h-44 p-4">
        {state.error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="mb-1 flex items-center gap-2 font-medium"><TriangleAlert className="h-4 w-4" /> Lỗi</div>
            <p className="break-words [overflow-wrap:anywhere]">{state.error}</p>
          </div>
        ) : state.content ? (
          <div className="prose-chat text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.content}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {state.loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Đang chờ...</span>
          </div>
        )}
      </CardContent>
      {footer ? <CardFooter className="border-t border-border/60 p-4">{footer}</CardFooter> : null}
    </Card>
  )
}

function StatusIcon({ state }: { state: DebateCardState }) {
  if (state.loading) return <Loader2 className="h-4 w-4 animate-spin text-primary" />
  if (state.error) return <TriangleAlert className="h-4 w-4 text-destructive" />
  if (state.done) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
}

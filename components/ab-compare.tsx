"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  const canDiff = a.done && b.done && !a.error && !b.error && a.content.trim() && b.content.trim()
  const diff = canDiff ? summarizeDiff(a.content, b.content) : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <AbCard label="Mô hình A" state={a} onPick={() => onPick("a")} />
        <AbCard label="Mô hình B" state={b} onPick={() => onPick("b")} />
      </div>
      {diff && (
        <Card className="border-border/70 bg-card/80">
          <CardHeader className="space-y-2 border-b border-border/60 p-3">
            <p className="text-sm font-semibold">So sánh nhanh A/B</p>
            <p className="text-xs text-muted-foreground">
              Độ tương đồng nội dung: <span className="font-medium">{diff.similarity}%</span>
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 p-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Ý chỉ có ở A</p>
              <ScrollArea className="max-h-40 rounded-md border border-border/60 p-2">
                <ul className="space-y-1 text-xs">
                  {diff.onlyA.length === 0 ? (
                    <li className="text-muted-foreground">Không có</li>
                  ) : (
                    diff.onlyA.map((line, index) => (
                      <li key={`a-${index}`} className="break-words [overflow-wrap:anywhere]">
                        • {line}
                      </li>
                    ))
                  )}
                </ul>
              </ScrollArea>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Ý chỉ có ở B</p>
              <ScrollArea className="max-h-40 rounded-md border border-border/60 p-2">
                <ul className="space-y-1 text-xs">
                  {diff.onlyB.length === 0 ? (
                    <li className="text-muted-foreground">Không có</li>
                  ) : (
                    diff.onlyB.map((line, index) => (
                      <li key={`b-${index}`} className="break-words [overflow-wrap:anywhere]">
                        • {line}
                      </li>
                    ))
                  )}
                </ul>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function summarizeDiff(contentA: string, contentB: string) {
  const linesA = contentA
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const linesB = contentB
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const setA = new Set(linesA)
  const setB = new Set(linesB)
  const onlyA = linesA.filter((line) => !setB.has(line)).slice(0, 8)
  const onlyB = linesB.filter((line) => !setA.has(line)).slice(0, 8)
  const unionSize = new Set([...setA, ...setB]).size || 1
  const intersection = [...setA].filter((line) => setB.has(line)).length
  const similarity = Math.round((intersection / unionSize) * 100)
  return { onlyA, onlyB, similarity }
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
          <div
            className="max-h-40 overflow-y-auto overscroll-contain rounded-md border border-destructive/30 bg-destructive/5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-destructive/30"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div className="px-3 py-2 text-xs text-destructive break-words [overflow-wrap:anywhere]">
              {state.error}
            </div>
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
            <Check className="h-4 w-4" /> Chọn câu này
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

"use client"
import { useState } from "react"
import { ChevronRight, Wrench, Check, Loader2, AlertCircle } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { PythonRunner } from "@/components/python-runner"
import { cn } from "@/lib/utils"

interface ToolCallProps {
  name: string
  state: string
  args?: any
  result?: any
}

const TOOL_LABELS: Record<string, string> = {
  webSearch: "Tìm kiếm web",
  calculator: "Máy tính",
  currentTime: "Thời gian hiện tại",
  runPython: "Chạy Python",
}

export function ToolCall({ name, state, args, result }: ToolCallProps) {
  const [open, setOpen] = useState(false)
  const isStreaming = state === "call" || state === "partial-call"
  const isDone = state === "result"
  const hasError = isDone && result && typeof result === "object" && "error" in result
  const pythonCode = name === "runPython" && isDone ? getPythonCode(result, args) : ""

  const label = TOOL_LABELS[name] ?? name

  if (pythonCode) {
    return (
      <div className="w-full basis-full">
        <PythonRunner code={pythonCode} />
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "group inline-flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium transition-all hover:border-border hover:bg-muted/50"
        )}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-background/50">
          {isStreaming ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : hasError ? (
            <AlertCircle className="h-3 w-3 text-destructive" />
          ) : isDone ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Wrench className="h-3 w-3 text-muted-foreground" />
          )}
        </span>
        <span className="font-mono text-foreground/80">{label}</span>
        <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", open && "rotate-90")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1">
        <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-card/40 p-3 text-xs">
          {args && Object.keys(args).length > 0 && (
            <div>
              <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">Input</div>
              <pre className="overflow-x-auto rounded-md bg-muted/40 p-2 font-mono">{JSON.stringify(args, null, 2)}</pre>
            </div>
          )}
          {isDone && (
            <div>
              <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
                {hasError ? "Error" : "Output"}
              </div>
              <pre className={cn(
                "overflow-x-auto rounded-md bg-muted/40 p-2 font-mono",
                hasError && "text-destructive"
              )}>
                {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function getPythonCode(result: any, args: any): string {
  const parsedResult = parseMaybeJson(result)
  if (parsedResult && typeof parsedResult === "object" && typeof parsedResult.code === "string") return parsedResult.code
  if (args && typeof args === "object" && typeof args.code === "string") return args.code
  return ""
}

function parseMaybeJson(value: any): any {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

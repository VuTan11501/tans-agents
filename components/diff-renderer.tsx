"use client"

import { useMemo, useState } from "react"
import { Check, Copy } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type CopyMode = "additions" | "all" | null

type DiffLineKind = "addition" | "deletion" | "hunk" | "normal"

type DiffLine = {
  text: string
  kind: DiffLineKind
}

function classifyLine(text: string): DiffLineKind {
  if (text.startsWith("@@")) return "hunk"
  if (text.startsWith("+")) return "addition"
  if (text.startsWith("-")) return "deletion"
  return "normal"
}

function getAdditionText(lines: string[]): string {
  return lines
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n")
}

export function DiffRenderer({ code }: { code: string }) {
  const lines = useMemo<DiffLine[]>(() => {
    const diffLines = code.length > 0 ? code.split("\n") : [""]
    return diffLines.map((text) => ({ text, kind: classifyLine(text) }))
  }, [code])
  const additions = useMemo(() => getAdditionText(code.length > 0 ? code.split("\n") : [""]), [code])
  const [copiedMode, setCopiedMode] = useState<CopyMode>(null)

  function copyText(value: string, mode: CopyMode) {
    navigator.clipboard.writeText(value)
    setCopiedMode(mode)
    setTimeout(() => setCopiedMode(null), 1500)
  }

  return (
    <div className="my-4 w-full overflow-hidden rounded-xl border border-border bg-card text-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => copyText(additions, "additions")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Sao chép phần thêm"
              >
                {copiedMode === "additions" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedMode === "additions" ? "Đã sao chép" : "Phần thêm"}
              </button>
            </TooltipTrigger>
            <TooltipContent>Sao chép phần thêm</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => copyText(code, "all")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Sao chép toàn bộ"
              >
                {copiedMode === "all" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedMode === "all" ? "Đã sao chép" : "Toàn bộ"}
              </button>
            </TooltipTrigger>
            <TooltipContent>Sao chép toàn bộ</TooltipContent>
          </Tooltip>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">diff</span>
      </div>
      <div className="max-h-[480px] overflow-auto bg-transparent">
        <div className="min-w-max py-2 font-mono text-sm">
          {lines.map((line, index) => (
            <div
              key={index}
              className={cn(
                "grid grid-cols-[3.25rem_1.75rem_minmax(0,1fr)] border-l-2 border-transparent leading-6",
                line.kind === "addition" && "border-l-green-500 bg-green-500/15",
                line.kind === "deletion" && "border-l-red-500 bg-red-500/15",
                line.kind === "hunk" && "bg-muted/60 text-muted-foreground",
              )}
            >
              <span className="select-none border-r border-border/60 px-3 text-right text-xs text-muted-foreground/70">
                {index + 1}
              </span>
              <span
                className={cn(
                  "select-none px-2 text-center text-xs font-semibold text-muted-foreground/70",
                  line.kind === "addition" && "text-green-600 dark:text-green-400",
                  line.kind === "deletion" && "text-red-600 dark:text-red-400",
                )}
              >
                {line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : ""}
              </span>
              <span className={cn("whitespace-pre px-4", line.kind === "hunk" ? "text-muted-foreground" : "text-foreground")}>{line.text || " "}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

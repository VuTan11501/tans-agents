"use client"
import { useState } from "react"
import { ChevronRight, Wrench, Check, Loader2, AlertCircle, ArrowDownRight, ArrowUpRight, Mail } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { PythonRunner } from "@/components/python-runner"
import { JsRunner } from "@/components/js-runner"
import { cn } from "@/lib/utils"

interface ToolCallProps {
  name: string
  state: string
  args?: any
  result?: any
}

const TOOL_LABELS: Record<string, string> = {
  webSearch: "T?m ki?m web",
  calculator: "M?y t?nh",
  currentTime: "Th?i gian hi?n t?i",
  runPython: "Ch?y Python",
  runJs: "Ch?y JavaScript",
  cryptoPrice: "Gi? crypto",
  stockPrice: "Gi? c? phi?u",
  translate: "D?ch v?n b?n",
  githubQuery: "Truy v?n GitHub",
  emailCompose: "So?n email",
}

export function ToolCall({ name, state, args, result }: ToolCallProps) {
  const [open, setOpen] = useState(false)
  const isStreaming = state === "call" || state === "partial-call"
  const isDone = state === "result"
  const parsedResult = parseMaybeJson(result)
  const hasError = isDone && parsedResult && typeof parsedResult === "object" && "error" in parsedResult
  const pythonCode = name === "runPython" && isDone ? getCode(parsedResult, args) : ""
  const jsCode = name === "runJs" && isDone ? getCode(parsedResult, args) : ""

  const label = TOOL_LABELS[name] ?? name

  if (pythonCode) {
    return (
      <div className="w-full basis-full">
        <PythonRunner code={pythonCode} />
      </div>
    )
  }

  if (jsCode) {
    return (
      <div className="w-full basis-full">
        <JsRunner code={jsCode} />
      </div>
    )
  }

  if (isDone && !hasError && (name === "cryptoPrice" || name === "stockPrice")) {
    return <PriceCard kind={name} data={parsedResult} />
  }

  if (isDone && !hasError && name === "translate") {
    return <TranslateCard data={parsedResult} originalText={args?.text} />
  }

  if (isDone && !hasError && name === "emailCompose") {
    return <EmailCard data={parsedResult} />
  }

  if (isDone && !hasError && name === "githubQuery") {
    return <GitHubCard data={parsedResult} />
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
                {typeof parsedResult === "string" ? parsedResult : JSON.stringify(parsedResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function PriceCard({ kind, data }: { kind: string; data: any }) {
  const isCrypto = kind === "cryptoPrice"
  const title = isCrypto ? String(data.symbol ?? "Crypto").toUpperCase() : String(data.ticker ?? "Stock")
  const change = Number(isCrypto ? data.change24h : data.changePct)
  const isUp = Number.isFinite(change) && change >= 0
  const price = isCrypto ? formatCurrency(data.usd, "USD") : formatCurrency(data.price, data.currency || "USD")

  return (
    <div className="w-full rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{isCrypto ? "Gi? crypto" : "Gi? c? phi?u"}</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{title}</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{price}</div>
          {isCrypto && <div className="mt-1 text-sm text-muted-foreground"> {formatCurrency(data.vnd, "VND")}</div>}
        </div>
        <div className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold", isUp ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
          {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          {Number.isFinite(change) ? `${change.toFixed(2)}%` : "N/A"}
        </div>
      </div>
      {!isCrypto && Number.isFinite(Number(data.change)) && (
        <div className="mt-2 text-sm text-muted-foreground">Thay ??i: {Number(data.change).toFixed(2)} {data.currency}</div>
      )}
    </div>
  )
}

function TranslateCard({ data, originalText }: { data: any; originalText?: string }) {
  return (
    <div className="w-full rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        D?ch v?n b?n  {data.sourceLang ?? "auto"}  {data.targetLang ?? "?"}
      </div>
      {originalText && <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{originalText}</div>}
      <div className="mt-3 rounded-lg bg-emerald-500/10 p-3 text-sm font-medium text-foreground">{data.translatedText}</div>
    </div>
  )
}

function EmailCard({ data }: { data: any }) {
  return (
    <div className="w-full rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-foreground"> B?n nh?p email</div>
        <a href={data.mailto} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:bg-muted">
          <Mail className="h-3.5 w-3.5" />
          M? trong app email
        </a>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        {data.to && <div><span className="font-medium">To:</span> {data.to}</div>}
        {data.cc && <div><span className="font-medium">Cc:</span> {data.cc}</div>}
        <div><span className="font-medium">Subject:</span> {data.subject}</div>
        <pre className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 font-sans text-sm">{data.body}</pre>
      </div>
    </div>
  )
}

function GitHubCard({ data }: { data: any }) {
  const items = data.items ?? data.issues ?? data.prs
  return (
    <div className="w-full rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="text-sm font-semibold text-foreground"> K?t qu? GitHub</div>
      {data.name || data.login ? (
        <div className="mt-3 space-y-1 text-sm">
          <a href={data.url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">{data.name ?? data.login}</a>
          {data.description && <div className="text-muted-foreground">{data.description}</div>}
          {data.bio && <div className="text-muted-foreground">{data.bio}</div>}
          <div className="text-xs text-muted-foreground">
            {[data.language, data.stars !== undefined ? ` ${data.stars}` : undefined, data.followers !== undefined ? `${data.followers} followers` : undefined, data.publicRepos !== undefined ? `${data.publicRepos} repos` : undefined].filter(Boolean).join("  ")}
          </div>
        </div>
      ) : Array.isArray(items) ? (
        <div className="mt-3 space-y-2">
          {items.length === 0 && <div className="text-sm text-muted-foreground">Kh?ng c? k?t qu?.</div>}
          {items.map((item: any, index: number) => (
            <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="block rounded-lg bg-muted/40 p-3 text-sm transition hover:bg-muted/60">
              <div className="font-medium text-foreground">{item.number ? `#${item.number} ` : ""}{item.title ?? item.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{[item.repo, item.path, item.author, item.branch].filter(Boolean).join("  ")}</div>
            </a>
          ))}
        </div>
      ) : (
        <pre className="mt-3 overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  )
}

function getCode(result: any, args: any): string {
  if (result && typeof result === "object" && typeof result.code === "string") return result.code
  if (args && typeof args === "object" && typeof args.code === "string") return args.code
  return ""
}

function formatCurrency(value: unknown, currency: string): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return "N/A"
  try {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: currency === "VND" ? 0 : 6 }).format(amount)
  } catch {
    return `${amount.toLocaleString("vi-VN")} ${currency}`
  }
}

function parseMaybeJson(value: any): any {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

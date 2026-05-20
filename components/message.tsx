"use client"
import { Children, cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from "react"
import type { ReactElement, ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Check, Copy, ExternalLink, Heart, MoreHorizontal, Pencil, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ToolCall } from "@/components/tool-call"
import { MermaidRenderer } from "@/components/mermaid-renderer"
import { DiffRenderer } from "@/components/diff-renderer"
import { ChartRenderer, type ChartData } from "@/components/chart-renderer"
import { useTypewriter } from "@/hooks/use-typewriter"
import { trackReaction } from "@/lib/analytics"
import { cn } from "@/lib/utils"

interface MessageProps {
  role: string
  content: string
  parts?: any[]
  index?: number
  isStreaming?: boolean
  isLastAssistant?: boolean
  onRegenerate?: () => void
  onEdit?: (index: number, newContent: string) => void
  onContinue?: () => void
  wasTruncated?: boolean
}

type CitationSource = {
  title: string
  url: string
  snippet?: string
}

type Reaction = "up" | "down" | "heart" | null

type QuoteButtonState = {
  text: string
  top: number
  left: number
}

const REACTIONS_KEY = "tans:reactions"
const SANDBOX_LANGUAGES = new Set(["js", "jsx", "javascript", "ts", "tsx", "typescript", "html", "css", "py", "python"])

export function isLikelyTruncated(content: string): boolean {
  if (!content || content.length < 200) return false
  const trimmed = content.trimEnd()
  const last = trimmed.slice(-1)
  // Câu hoàn chỉnh thường kết thúc bằng . ! ? " ' ` ) ] } ;
  return !/[.!?"'`)\]};]/.test(last)
}

export function MessageBubble({
  role,
  content,
  parts,
  index = 0,
  isStreaming,
  isLastAssistant,
  onRegenerate,
  onEdit,
  onContinue,
  wasTruncated,
}: MessageProps) {
  const isUser = role === "user"
  const toolInvocations = (parts || []).filter((p) => p.type === "tool-invocation")
  const citationSources = useMemo(() => extractCitationSources(toolInvocations), [toolInvocations])
  const chartResults = useMemo(() => extractChartResults(toolInvocations), [toolInvocations])
  const messageId = useMemo(() => createMessageId(index, content), [index, content])
  const displayedContent = useTypewriter(isUser ? "" : content, !isStreaming)
  const showCursor = !!isStreaming || (!isUser && displayedContent.length < content.length)
  const showContinue = isLastAssistant && !!onContinue && (wasTruncated ?? isLikelyTruncated(content))
  const assistantMessageRef = useRef<HTMLDivElement>(null)
  const [quoteButton, setQuoteButton] = useState<QuoteButtonState | null>(null)

  useEffect(() => {
    if (isUser) return
    function handleSelectionChange() {
      const selection = window.getSelection()
      const container = assistantMessageRef.current
      if (!selection || selection.isCollapsed || !container || !isSelectionInside(selection, container)) {
        setQuoteButton(null)
      }
    }

    document.addEventListener("selectionchange", handleSelectionChange)
    return () => document.removeEventListener("selectionchange", handleSelectionChange)
  }, [isUser])

  function handleAssistantMouseUp() {
    const selection = window.getSelection()
    const container = assistantMessageRef.current
    const selectedText = selection?.toString().trim()
    if (!selection || !container || !selectedText || !isSelectionInside(selection, container) || selection.rangeCount === 0) {
      setQuoteButton(null)
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getClientRects()[0] ?? range.getBoundingClientRect()
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      setQuoteButton(null)
      return
    }

    const aboveSelection = rect.top > 48
    const left = Math.min(Math.max(rect.left + rect.width / 2, 80), window.innerWidth - 80)
    const top = aboveSelection ? rect.top - 42 : rect.bottom + 8
    setQuoteButton({ text: selectedText, left, top })
  }

  function dispatchQuote() {
    if (!quoteButton) return
    window.dispatchEvent(new CustomEvent("tans:quote", { detail: { text: quoteButton.text, sourceMessageId: messageId } }))
    window.getSelection()?.removeAllRanges()
    setQuoteButton(null)
  }

  // User message: support edit + copy
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(content)

  if (isUser) {
    if (editing) {
      return (
        <div className="fade-up flex justify-end">
          <div className="flex w-full max-w-[85%] flex-col gap-2">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[72px] w-full resize-none rounded-2xl rounded-tr-md border border-border bg-muted/40 px-4 py-2.5 text-[15px] leading-relaxed outline-none focus:border-foreground/30"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs"
                onClick={() => {
                  setEditing(false)
                  setDraft(content)
                }}
              >
                <X className="h-3 w-3" /> Hủy
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs"
                disabled={!draft.trim() || draft === content}
                onClick={() => {
                  onEdit?.(index, draft)
                  setEditing(false)
                }}
              >
                Gửi
              </Button>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="fade-up flex justify-end">
        <div className="group flex max-w-[85%] items-start gap-3">
          <div className="flex flex-col items-end gap-1">
            <div className="rounded-2xl rounded-tr-md bg-muted/60 px-4 py-2.5 text-[15px] leading-relaxed">
              <p className="whitespace-pre-wrap">{content}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {onEdit && (
                <ActionIcon
                  label="Chỉnh sửa"
                  onClick={() => {
                    setDraft(content)
                    setEditing(true)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </ActionIcon>
              )}
              <CopyAction text={content} />
            </div>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
            <User className="h-4 w-4" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-up group flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-orange-500/20">
        <Sparkles className="h-4 w-4 text-foreground" />
      </div>

      <div ref={assistantMessageRef} onMouseUp={handleAssistantMouseUp} className="min-w-0 flex-1 space-y-3 pt-1">
        {quoteButton && (
          <div
            className="fixed z-40 -translate-x-1/2"
            style={{ top: quoteButton.top, left: quoteButton.left }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-full border border-border/70 bg-background/95 px-3 text-xs text-foreground shadow-lg backdrop-blur hover:bg-muted"
              onClick={dispatchQuote}
            >
              💬 Trích & hỏi
            </Button>
          </div>
        )}

        {toolInvocations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {toolInvocations.map((p, i) => (
              <ToolCall
                key={i}
                name={p.toolInvocation?.toolName}
                state={p.toolInvocation?.state}
                args={p.toolInvocation?.args}
                result={p.toolInvocation?.result}
              />
            ))}
          </div>
        )}

        {chartResults.map((chart, i) => (
          <ChartRenderer key={`${chart.title}-${i}`} data={chart} />
        ))}

        {content ? (
          <div className={cn("prose-chat", showCursor && "prose-chat-streaming")}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                pre: (props: any) => <CodeBlock {...props} />,
                p: ({ children, ...props }: any) => <p {...props}>{linkCitationMarkers(children, citationSources)}</p>,
                li: ({ children, ...props }: any) => <li {...props}>{linkCitationMarkers(children, citationSources)}</li>,
                blockquote: ({ children, ...props }: any) => <blockquote {...props}>{linkCitationMarkers(children, citationSources)}</blockquote>,
                strong: ({ children, ...props }: any) => <strong {...props}>{linkCitationMarkers(children, citationSources)}</strong>,
                em: ({ children, ...props }: any) => <em {...props}>{linkCitationMarkers(children, citationSources)}</em>,
                td: ({ children, ...props }: any) => <td {...props}>{linkCitationMarkers(children, citationSources)}</td>,
                th: ({ children, ...props }: any) => <th {...props}>{linkCitationMarkers(children, citationSources)}</th>,
              }}
            >
              {displayedContent || ""}
            </ReactMarkdown>
          </div>
        ) : (
          toolInvocations.length === 0 && <ThinkingDots />
        )}

        {citationSources.length > 0 && <CitationSources sources={citationSources} />}

        {content && !showCursor && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
              <CopyAction text={content} />
              {isLastAssistant && onRegenerate && (
                <ActionIcon label="Tạo lại câu trả lời" onClick={onRegenerate}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </ActionIcon>
              )}
              {showContinue && (
                <ActionIcon label="Tiếp tục" onClick={onContinue}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </ActionIcon>
              )}
            </div>
            <AssistantReactions messageId={messageId} />
          </div>
        )}
      </div>
    </div>
  )
}

function ActionIcon({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => {
            navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Đã copy" : "Sao chép"}</TooltipContent>
    </Tooltip>
  )
}

export function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <span className="dot-1 h-2 w-2 rounded-full bg-muted-foreground/60" />
      <span className="dot-2 h-2 w-2 rounded-full bg-muted-foreground/60" />
      <span className="dot-3 h-2 w-2 rounded-full bg-muted-foreground/60" />
    </div>
  )
}

function CodeBlock({ children }: any) {
  const rawText = extractText(children)
  const text = rawText.endsWith("\n") ? rawText.slice(0, -1) : rawText
  const language = getCodeLanguage(children)
  const normalizedLanguage = language.toLowerCase()
  const lines = text.length > 0 ? text.split("\n") : [""]
  const [expanded, setExpanded] = useState(lines.length <= 30)
  const [copied, setCopied] = useState(false)
  const visibleLines = expanded ? lines : lines.slice(0, 30)

  if (normalizedLanguage === "mermaid") {
    return <MermaidRenderer code={text} />
  }

  if (normalizedLanguage === "diff") {
    return <DiffRenderer code={text} />
  }

  function copyCode() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function openCodeSandbox() {
    copyCode()
    window.open("https://codesandbox.io/s/new", "_blank", "noopener,noreferrer")
  }

  return (
    <div className="group/code my-4 overflow-hidden rounded-xl border border-border bg-card text-sm">
      <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {SANDBOX_LANGUAGES.has(normalizedLanguage) && (
            <button
              type="button"
              onClick={openCodeSandbox}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" /> Mở trong CodeSandbox
            </button>
          )}
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? "Đã sao chép" : "Sao chép"}
          </button>
        </div>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{language || "text"}</span>
      </div>
      <pre className="m-0 overflow-x-auto bg-transparent p-0">
        <code className={cn("block py-2 font-mono text-sm", language && `language-${language}`)}>
          {visibleLines.map((line, i) => (
            <span key={i} className="table-row">
              <span className="table-cell w-10 select-none border-r border-border/60 px-3 text-right text-xs leading-6 text-muted-foreground/70">
                {i + 1}
              </span>
              <span className="table-cell whitespace-pre px-4 leading-6 text-foreground">{line || " "}</span>
            </span>
          ))}
        </code>
      </pre>
      {lines.length > 30 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full border-t border-border bg-muted/20 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          Hiển thị tất cả ({lines.length} dòng)
        </button>
      )}
    </div>
  )
}

function AssistantReactions({ messageId }: { messageId: string }) {
  const [reaction, setReaction] = useState<Reaction>(null)

  useEffect(() => {
    setReaction(readStoredReaction(messageId))
  }, [messageId])

  function toggle(nextReaction: Exclude<Reaction, null>) {
    const next = reaction === nextReaction ? null : nextReaction
    setReaction(next)
    writeStoredReaction(messageId, next)
    trackReaction(messageId, next)
  }

  return (
    <div className="flex items-center gap-1">
      <ReactionButton label="Hữu ích" selected={reaction === "up"} onClick={() => toggle("up")}>
        <ThumbsUp className={cn("h-3.5 w-3.5", reaction === "up" && "fill-current")} />
      </ReactionButton>
      <ReactionButton label="Không hữu ích" selected={reaction === "down"} onClick={() => toggle("down")}>
        <ThumbsDown className={cn("h-3.5 w-3.5", reaction === "down" && "fill-current")} />
      </ReactionButton>
      <ReactionButton label="Yêu thích" selected={reaction === "heart"} onClick={() => toggle("heart")}>
        <Heart className={cn("h-3.5 w-3.5", reaction === "heart" && "fill-current")} />
      </ReactionButton>
    </div>
  )
}

function ReactionButton({
  label,
  selected,
  onClick,
  children,
}: {
  label: string
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-pressed={selected}
          className={cn(
            "h-7 w-7 text-muted-foreground hover:bg-muted hover:text-foreground",
            selected && "bg-muted text-primary hover:text-primary"
          )}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function CitationSources({ sources }: { sources: CitationSource[] }) {
  return (
    <div className="border-t border-border/60 pt-2">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">Nguồn:</div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source, index) => (
          <a
            key={`${source.url}-${index}`}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            title={source.title}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            [{index + 1}]
          </a>
        ))}
      </div>
    </div>
  )
}

function extractText(node: any): string {
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractText).join("")
  if (node?.props?.children) return extractText(node.props.children)
  return ""
}

function getCodeLanguage(children: any): string {
  const child = Array.isArray(children) ? children[0] : children
  const className = child?.props?.className ?? ""
  const match = /language-([^\s]+)/.exec(className)
  return match?.[1] ?? ""
}

function extractCitationSources(toolInvocations: any[]): CitationSource[] {
  const sources: CitationSource[] = []
  const seen = new Set<string>()

  for (const part of toolInvocations) {
    const invocation = part?.toolInvocation
    if (invocation?.toolName !== "webSearch") continue

    const result = parseToolResult(invocation.result)
    const results = Array.isArray(result?.results) ? result.results : []

    for (const item of results) {
      if (!item?.url || seen.has(item.url)) continue
      seen.add(item.url)
      sources.push({
        title: String(item.title || item.url),
        url: String(item.url),
        snippet: item.snippet ? String(item.snippet) : undefined,
      })
    }
  }

  return sources
}

function extractChartResults(toolInvocations: any[]): ChartData[] {
  return toolInvocations
    .map((part) => part?.toolInvocation)
    .filter((invocation) => invocation?.toolName === "chartGen" && invocation?.state === "result")
    .map((invocation) => parseToolResult(invocation.result))
    .filter(isChartData)
}

function parseToolResult(result: any): any {
  if (typeof result !== "string") return result
  try {
    return JSON.parse(result)
  } catch {
    return result
  }
}

function isChartData(value: any): value is ChartData {
  return (
    value &&
    typeof value === "object" &&
    (value.type === "line" || value.type === "bar" || value.type === "pie") &&
    typeof value.title === "string" &&
    Array.isArray(value.labels) &&
    Array.isArray(value.data)
  )
}

function isSelectionInside(selection: Selection, container: HTMLElement) {
  const { anchorNode, focusNode } = selection
  return !!anchorNode && !!focusNode && container.contains(anchorNode) && container.contains(focusNode)
}

function linkCitationMarkers(children: ReactNode, sources: CitationSource[]): ReactNode {
  if (sources.length === 0) return children

  return Children.map(children, (child) => {
    if (typeof child === "string") return splitCitationText(child, sources)
    if (!isValidElement(child)) return child
    if (typeof child.type === "string" && ["a", "code", "pre"].includes(child.type)) return child

    const element = child as ReactElement<{ children?: ReactNode }>
    if (!element.props.children) return child
    return cloneElement(element, undefined, linkCitationMarkers(element.props.children, sources))
  })
}

function splitCitationText(text: string, sources: CitationSource[]): ReactNode {
  const parts: ReactNode[] = []
  const regex = /\[(\d+)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text))) {
    const sourceIndex = Number(match[1]) - 1
    const source = sources[sourceIndex]

    if (!source) continue
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push(
      <a
        key={`${source.url}-${match.index}`}
        href={source.url}
        target="_blank"
        rel="noreferrer"
        title={source.title}
        className="font-medium text-primary underline-offset-2 hover:underline"
      >
        {match[0]}
      </a>
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex === 0) return text
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

function readStoredReaction(messageId: string): Reaction {
  if (typeof window === "undefined") return null

  try {
    const parsed = JSON.parse(window.localStorage.getItem(REACTIONS_KEY) || "{}")
    const reaction = parsed?.[messageId]
    return reaction === "up" || reaction === "down" || reaction === "heart" ? reaction : null
  } catch {
    return null
  }
}

function writeStoredReaction(messageId: string, reaction: Reaction) {
  if (typeof window === "undefined") return

  try {
    const parsed = JSON.parse(window.localStorage.getItem(REACTIONS_KEY) || "{}")
    window.localStorage.setItem(REACTIONS_KEY, JSON.stringify({ ...parsed, [messageId]: reaction }))
  } catch {
    window.localStorage.setItem(REACTIONS_KEY, JSON.stringify({ [messageId]: reaction }))
  }
}

function createMessageId(index: number, content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i += 1) {
    hash = (hash * 31 + content.charCodeAt(i)) | 0
  }
  return `assistant:${index}:${Math.abs(hash)}`
}

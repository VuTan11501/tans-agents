"use client"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Copy, Check, Sparkles, User, RefreshCw, ThumbsUp, ThumbsDown, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ToolCall } from "@/components/tool-call"
import { useTypewriter } from "@/hooks/use-typewriter"
import { cn } from "@/lib/utils"

interface MessageProps {
  role: string
  content: string
  parts?: any[]
  isStreaming?: boolean
  isLastAssistant?: boolean
  onRegenerate?: () => void
  onEditUser?: (newContent: string) => void
}

export function MessageBubble({
  role,
  content,
  parts,
  isStreaming,
  isLastAssistant,
  onRegenerate,
  onEditUser,
}: MessageProps) {
  const isUser = role === "user"
  const toolInvocations = (parts || []).filter((p) => p.type === "tool-invocation")
  const displayedContent = useTypewriter(isUser ? "" : content)
  const showCursor = !!isStreaming || (!isUser && displayedContent.length < content.length)

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
                  onEditUser?.(draft)
                  setEditing(false)
                }}
              >
                Gửi lại
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
              {onEditUser && (
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

      <div className="min-w-0 flex-1 space-y-3 pt-1">
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

        {content ? (
          <div className={cn("prose-chat", showCursor && "prose-chat-streaming")}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                pre: (props: any) => <CodeBlock {...props} />,
              }}
            >
              {displayedContent || ""}
            </ReactMarkdown>
          </div>
        ) : (
          toolInvocations.length === 0 && <ThinkingDots />
        )}

        {content && !showCursor && (
          <div className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
            <CopyAction text={content} />
            {isLastAssistant && onRegenerate && (
              <ActionIcon label="Tạo lại câu trả lời" onClick={onRegenerate}>
                <RefreshCw className="h-3.5 w-3.5" />
              </ActionIcon>
            )}
            <ActionIcon label="Hữu ích">
              <ThumbsUp className="h-3.5 w-3.5" />
            </ActionIcon>
            <ActionIcon label="Không hữu ích">
              <ThumbsDown className="h-3.5 w-3.5" />
            </ActionIcon>
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
  children: React.ReactNode
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
      <TooltipContent>{copied ? "Đã copy" : "Copy"}</TooltipContent>
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

function CodeBlock({ children, ...props }: any) {
  const text = extractText(children)
  return (
    <div className="group/code relative">
      <pre {...props}>{children}</pre>
      <button
        onClick={() => navigator.clipboard.writeText(text)}
        className="absolute right-2 top-2 rounded-md border border-border bg-background/80 px-2 py-1 text-xs opacity-0 backdrop-blur transition-opacity hover:bg-background group-hover/code:opacity-100"
      >
        Copy
      </button>
    </div>
  )
}

function extractText(node: any): string {
  if (typeof node === "string") return node
  if (Array.isArray(node)) return node.map(extractText).join("")
  if (node?.props?.children) return extractText(node.props.children)
  return ""
}

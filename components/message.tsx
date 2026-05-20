"use client"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Copy, Check, Sparkles, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ToolCall } from "@/components/tool-call"
import { cn } from "@/lib/utils"

interface MessageProps {
  role: string
  content: string
  parts?: any[]
}

export function MessageBubble({ role, content, parts }: MessageProps) {
  const isUser = role === "user"
  const toolInvocations = (parts || []).filter((p) => p.type === "tool-invocation")

  if (isUser) {
    return (
      <div className="fade-up flex justify-end">
        <div className="group flex max-w-[85%] items-start gap-3">
          <div className="rounded-2xl rounded-tr-md bg-muted/60 px-4 py-2.5 text-[15px] leading-relaxed">
            <p className="whitespace-pre-wrap">{content}</p>
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
          <div className="prose-chat">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                pre: (props: any) => <CodeBlock {...props} />,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          toolInvocations.length === 0 && <ThinkingDots />
        )}

        {content && (
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton text={content} />
          </div>
        )}
      </div>
    </div>
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
          onClick={() => {
            navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Đã copy" : "Copy"}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy message</TooltipContent>
    </Tooltip>
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

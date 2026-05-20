"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

interface MarkdownPreviewProps {
  value: string
  className?: string
}

export function MarkdownPreview({ value, className }: MarkdownPreviewProps) {
  const content = value.trim()

  return (
    <div className={cn("prose-chat min-h-[72px] overflow-y-auto rounded-2xl border bg-background/70 p-3 text-[15px]", className)}>
      {content ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
      ) : (
        <p className="text-sm text-muted-foreground">Nhập markdown để xem trước...</p>
      )}
    </div>
  )
}

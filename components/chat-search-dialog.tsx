"use client"
import { useEffect, useMemo, useState } from "react"
import { Search, X } from "lucide-react"
import { useChatHistory } from "@/hooks/use-chat-history"
import { searchSessions, highlightSnippet, type SearchHit } from "@/lib/chat-search"

interface ChatSearchDialogProps {
  open: boolean
  onClose: () => void
  onJump: (sessionId: string, messageIndex: number) => void
}

export function ChatSearchDialog({ open, onClose, onJump }: ChatSearchDialogProps) {
  const { sessions } = useChatHistory()
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  const hits = useMemo(() => searchSessions(sessions, query, 80), [sessions, query])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 backdrop-blur-sm pt-[10vh] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            placeholder="Tìm kiếm trong tất cả cuộc trò chuyện..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!query.trim() ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              Nhập từ khoá để tìm trong {sessions.length} cuộc trò chuyện
            </p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">Không tìm thấy kết quả</p>
          ) : (
            <ul className="space-y-1">
              {hits.map((h, i) => (
                <HitItem key={i} hit={h} onJump={onJump} onClose={onClose} />
              ))}
            </ul>
          )}
        </div>
        <div className="border-t px-4 py-2 text-[10px] text-muted-foreground">
          {hits.length > 0 && `${hits.length} kết quả`}
        </div>
      </div>
    </div>
  )
}

function HitItem({ hit, onJump, onClose }: { hit: SearchHit; onJump: (sid: string, idx: number) => void; onClose: () => void }) {
  const { before, match, after } = highlightSnippet(hit.snippet, hit.matchStart, hit.matchEnd)
  return (
    <li>
      <button
        onClick={() => {
          onJump(hit.sessionId, hit.messageIndex)
          onClose()
        }}
        className="block w-full rounded-md px-3 py-2 text-left hover:bg-muted"
      >
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="line-clamp-1 font-medium">{hit.sessionTitle}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {hit.role === "title" ? "tiêu đề" : hit.role === "user" ? "👤 user" : "🤖 ai"}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {before}
          <mark className="rounded bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-700">{match}</mark>
          {after}
        </p>
      </button>
    </li>
  )
}

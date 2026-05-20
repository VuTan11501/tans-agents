"use client"

import { useState } from "react"
import {
  MessageSquare,
  Plus,
  Trash2,
  Sparkles,
  Search,
  MoreHorizontal,
  Pencil,
  Copy as CopyIcon,
  Download,
  Check,
  X as XIcon,
} from "lucide-react"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { downloadBlob, safeFilename, sessionToJSON, sessionToMarkdown } from "@/lib/export"
import type { ChatSession } from "@/hooks/use-chat-history"

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessions: ChatSession[]
  currentId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onDuplicate: (id: string) => void
  onClearAll: () => void
  trigger: React.ReactNode
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "vừa xong"
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`
  const d = Math.floor(s / 86400)
  if (d < 7) return `${d} ngày trước`
  return new Date(ts).toLocaleDateString("vi-VN")
}

function groupSessions(sessions: ChatSession[]) {
  const now = Date.now()
  const day = 86400_000
  const groups: Record<string, ChatSession[]> = {
    "Hôm nay": [],
    "Hôm qua": [],
    "7 ngày trước": [],
    "30 ngày trước": [],
    "Cũ hơn": [],
  }
  for (const s of sessions) {
    const age = now - s.updatedAt
    if (age < day) groups["Hôm nay"].push(s)
    else if (age < day * 2) groups["Hôm qua"].push(s)
    else if (age < day * 7) groups["7 ngày trước"].push(s)
    else if (age < day * 30) groups["30 ngày trước"].push(s)
    else groups["Cũ hơn"].push(s)
  }
  return groups
}

export function Sidebar({
  open,
  onOpenChange,
  sessions,
  currentId,
  onSelect,
  onNewChat,
  onDelete,
  onRename,
  onDuplicate,
  onClearAll,
  trigger,
}: SidebarProps) {
  const [q, setQ] = useState("")
  const filtered = q
    ? sessions.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()))
    : sessions
  const groups = groupSessions(filtered)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="left" className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-orange-500/20">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            Tan&apos;s Agent
          </SheetTitle>
        </SheetHeader>

        <div className="px-4">
          <SheetClose asChild>
            <Button
              onClick={onNewChat}
              className="w-full justify-start gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" /> Cuộc trò chuyện mới
            </Button>
          </SheetClose>
        </div>

        <div className="px-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm cuộc trò chuyện…"
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {sessions.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                Chưa có cuộc trò chuyện nào. Bắt đầu gõ để tạo cái đầu tiên.
              </p>
            </div>
          ) : (
            Object.entries(groups).map(
              ([label, list]) =>
                list.length > 0 && (
                  <div key={label} className="mb-2">
                    <div className="px-2 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      {label}
                    </div>
                    <div className="space-y-0.5">
                      {list.map((s) => (
                        <SessionItem
                          key={s.id}
                          session={s}
                          isActive={s.id === currentId}
                          onSelect={() => {
                            onSelect(s.id)
                            onOpenChange(false)
                          }}
                          onDelete={() => onDelete(s.id)}
                          onRename={(title) => onRename(s.id, title)}
                          onDuplicate={() => onDuplicate(s.id)}
                        />
                      ))}
                    </div>
                  </div>
                )
            )
          )}
        </div>

        <div className="border-t border-border/50 p-2">
          <div className="px-1 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
            Giao diện
          </div>
          <ThemeToggle variant="menu-item" />
          {sessions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-start gap-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (confirm("Xóa toàn bộ lịch sử trò chuyện?")) onClearAll()
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Xóa toàn bộ lịch sử
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
  onDuplicate,
}: {
  session: ChatSession
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (title: string) => void
  onDuplicate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(session.title)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function commit() {
    const t = draft.trim()
    if (t && t !== session.title) onRename(t)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") {
              setDraft(session.title)
              setEditing(false)
            }
          }}
          onBlur={commit}
          className="h-7 px-2 text-sm"
        />
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={commit}>
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => {
            setDraft(session.title)
            setEditing(false)
          }}
        >
          <XIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60",
        isActive && "bg-muted"
      )}
    >
      <button
        onClick={onSelect}
        onDoubleClick={() => setEditing(true)}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
      >
        <span className="line-clamp-1 w-full text-sm">{session.title}</span>
        <span className="text-[10px] text-muted-foreground">
          {timeAgo(session.updatedAt)} · {session.messages.length} tin nhắn ·{" "}
          {session.model.split("/").pop()}
        </span>
      </button>
      <DropdownMenu
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(false)
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem className="gap-2 text-xs" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Đổi tên
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={onDuplicate}>
            <CopyIcon className="h-3.5 w-3.5" /> Nhân bản
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 text-xs"
            onClick={() =>
              downloadBlob(
                sessionToMarkdown(session),
                safeFilename(session.title, "md"),
                "text/markdown;charset=utf-8"
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Xuất Markdown
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 text-xs"
            onClick={() =>
              downloadBlob(
                sessionToJSON(session),
                safeFilename(session.title, "json"),
                "application/json"
              )
            }
          >
            <Download className="h-3.5 w-3.5" /> Xuất JSON
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-xs text-destructive focus:text-destructive"
            onSelect={(e) => {
              if (!confirmDelete) {
                e.preventDefault()
                setConfirmDelete(true)
              } else {
                onDelete()
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirmDelete ? "Bấm lần nữa để xóa" : "Xóa"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

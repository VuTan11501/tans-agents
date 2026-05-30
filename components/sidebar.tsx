"use client"

import { useMemo, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import * as Dialog from "@radix-ui/react-dialog"
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
  Star,
  StarOff,
  Tags,
  Wrench,
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
import { CloudSyncButton } from "@/components/cloud-sync-button"
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
import { TOOL_LABELS, TOOL_NAMES } from "@/lib/tools"
import {
  setSessionEnabledTools,
  setSessionSmartRetry,
  setSessionTags,
  togglePinnedSession,
  type ChatSession,
} from "@/hooks/use-chat-history"

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
  trigger: ReactNode
}

const SENSITIVE_TOOLS = ["runPython", "runJs", "runSql", "fetchUrl", "githubQuery"] as const
const SHARE_SETTINGS_KEY = "tans-agents:share-settings-v1"
const DEFAULT_SHARE_SETTINGS = {
  redact: true,
  expiresInDays: 7,
  openAfterCreate: false,
}

type ShareSettings = {
  redact: boolean
  expiresInDays: number
  openAfterCreate: boolean
}

function clampShareDays(value: unknown): number {
  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim()
  if (!text) return DEFAULT_SHARE_SETTINGS.expiresInDays
  const parsed = Math.floor(Number(text))
  if (!Number.isFinite(parsed)) return DEFAULT_SHARE_SETTINGS.expiresInDays
  return Math.min(90, Math.max(1, parsed))
}

function readShareSettings(): ShareSettings {
  if (typeof window === "undefined") return DEFAULT_SHARE_SETTINGS
  try {
    const raw = window.localStorage.getItem(SHARE_SETTINGS_KEY)
    if (!raw) return DEFAULT_SHARE_SETTINGS
    const parsed = JSON.parse(raw) as Partial<ShareSettings>
    return {
      redact: parsed.redact !== false,
      expiresInDays: clampShareDays(parsed.expiresInDays),
      openAfterCreate: parsed.openAfterCreate === true,
    }
  } catch {
    return DEFAULT_SHARE_SETTINGS
  }
}

function writeShareSettings(settings: ShareSettings) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(SHARE_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore localStorage quota/privacy errors for non-critical setting
  }
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

function groupSessions(sessions: ChatSession[]): Array<[string, ChatSession[]]> {
  const now = Date.now()
  const day = 86400_000
  const pinned: ChatSession[] = []
  const timeGroups: Array<[string, ChatSession[]]> = [
    ["Hôm nay", []],
    ["Hôm qua", []],
    ["7 ngày trước", []],
    ["30 ngày trước", []],
    ["Cũ hơn", []],
  ]

  for (const s of sessions) {
    if (s.pinned) {
      pinned.push(s)
      continue
    }

    const age = now - s.updatedAt
    if (age < day) timeGroups[0][1].push(s)
    else if (age < day * 2) timeGroups[1][1].push(s)
    else if (age < day * 7) timeGroups[2][1].push(s)
    else if (age < day * 30) timeGroups[3][1].push(s)
    else timeGroups[4][1].push(s)
  }

  return pinned.length > 0 ? [["📌 Đã ghim", pinned], ...timeGroups] : timeGroups
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) return content.map(textFromContent).filter(Boolean).join(" ")
  if (content && typeof content === "object") {
    const value = content as { text?: unknown; content?: unknown }
    return textFromContent(value.text ?? value.content ?? "")
  }
  return ""
}

function sessionMessageText(session: ChatSession) {
  return session.messages.map((m) => textFromContent(m?.content)).join(" ")
}

function getMessageSnippet(session: ChatSession, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return null

  const text = sessionMessageText(session).replace(/\s+/g, " ").trim()
  const index = text.toLowerCase().indexOf(normalizedQuery)
  if (index < 0) return null

  const radius = 30
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + normalizedQuery.length + radius)
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`
}

function highlightText(text: string, query: string): ReactNode {
  const q = query.trim()
  if (!q) return text

  const parts: ReactNode[] = []
  const lowerText = text.toLowerCase()
  const lowerQuery = q.toLowerCase()
  let cursor = 0
  let index = lowerText.indexOf(lowerQuery)

  while (index >= 0) {
    if (index > cursor) parts.push(text.slice(cursor, index))
    parts.push(
      <mark key={`${index}-${parts.length}`} className="rounded bg-yellow-200 px-0.5 text-yellow-950 dark:bg-yellow-400/30 dark:text-yellow-100">
        {text.slice(index, index + q.length)}
      </mark>
    )
    cursor = index + q.length
    index = lowerText.indexOf(lowerQuery, cursor)
  }

  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

function tagHue(tag: string) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) % 360
  return hash
}

function tagStyle(tag: string): CSSProperties {
  const hue = tagHue(tag)
  return {
    backgroundColor: `hsl(${hue} 80% 92%)`,
    borderColor: `hsl(${hue} 65% 78%)`,
    color: `hsl(${hue} 40% 28%)`,
  }
}

function parseTags(input: string) {
  return Array.from(new Set(input.split(",").map((tag) => tag.trim()).filter(Boolean)))
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
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const allTags = useMemo(
    () => Array.from(new Set(sessions.flatMap((s) => s.tags ?? []))).sort((a, b) => a.localeCompare(b, "vi")),
    [sessions]
  )
  const { filtered, snippets } = useMemo(() => {
    const query = q.trim().toLowerCase()
    const snippetMap = new Map<string, string>()
    const list = sessions.filter((s) => {
      if (activeTag && !(s.tags ?? []).includes(activeTag)) return false
      if (!query) return true

      const titleMatches = s.title.toLowerCase().includes(query)
      if (titleMatches) return true

      const snippet = getMessageSnippet(s, query)
      if (!snippet) return false
      snippetMap.set(s.id, snippet)
      return true
    })

    return { filtered: list, snippets: snippetMap }
  }, [activeTag, q, sessions])
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

        <div className="space-y-2 px-4">
          {allTags.length > 0 && (
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {allTags.map((tag) => {
                const active = activeTag === tag
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTag(active ? null : tag)}
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80",
                      active && "ring-1 ring-primary ring-offset-1 ring-offset-background"
                    )}
                    style={tagStyle(tag)}
                    title={`Lọc theo nhãn ${tag}`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tiêu đề hoặc nội dung…"
              className="h-9 pl-8 pr-8 text-sm"
            />
            <button
              type="button"
              onClick={() => setQ("")}
              className={cn(
                "absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors",
                q.trim() ? "hover:bg-muted hover:text-foreground" : "pointer-events-none opacity-0"
              )}
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="min-h-4 px-1 text-[11px] text-muted-foreground">
            {q.trim()
              ? `Kết quả: ${filtered.length}/${sessions.length}`
              : activeTag
              ? `Đang lọc nhãn: ${activeTag}`
              : ""}
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
          ) : filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">Không tìm thấy cuộc trò chuyện phù hợp.</p>
            </div>
          ) : (
            groups.map(
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
                          searchQuery={q}
                          messageSnippet={snippets.get(s.id)}
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
          <div className="mt-2 border-t border-border/60 pt-2">
            <CloudSyncButton />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SessionItem({
  session,
  isActive,
  searchQuery,
  messageSnippet,
  onSelect,
  onDelete,
  onRename,
  onDuplicate,
}: {
  session: ChatSession
  isActive: boolean
  searchQuery: string
  messageSnippet?: string
  onSelect: () => void
  onDelete: () => void
  onRename: (title: string) => void
  onDuplicate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(session.title)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareNotice, setShareNotice] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [shareRedact, setShareRedact] = useState(DEFAULT_SHARE_SETTINGS.redact)
  const [shareExpiresInDays, setShareExpiresInDays] = useState(String(DEFAULT_SHARE_SETTINGS.expiresInDays))
  const [sharePassword, setSharePassword] = useState("")
  const [shareOpenAfterCreate, setShareOpenAfterCreate] = useState(DEFAULT_SHARE_SETTINGS.openAfterCreate)
  const [toolDraft, setToolDraft] = useState<string[]>(() => [...(session.enabledTools ?? TOOL_NAMES)])
  const [smartRetryDraft, setSmartRetryDraft] = useState(session.smartRetry !== false)

  function handleSetTags() {
    const input = prompt("Nhập nhãn, phân tách bằng dấu phẩy", (session.tags ?? []).join(", "))
    if (input === null) return
    setSessionTags(session.id, parseTags(input))
  }

  function showShareToast(message: string, type: "success" | "error" = "success") {
    setShareNotice({ message, type })
    window.setTimeout(() => setShareNotice(null), 3000)
  }

  function openShareDialog() {
    const settings = readShareSettings()
    setShareRedact(settings.redact)
    setShareExpiresInDays(String(settings.expiresInDays))
    setShareOpenAfterCreate(settings.openAfterCreate)
    setSharePassword("")
    setShareOpen(true)
  }

  async function handleCreateShare() {
    if (sharing) return
    const expiresInDays = clampShareDays(shareExpiresInDays)
    const password = sharePassword.trim()
    setSharing(true)

    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session,
          redact: shareRedact,
          expiresInDays,
          password: password || undefined,
        }),
      })

      if (!response.ok) throw new Error("Share request failed")

      const data = (await response.json()) as {
        id?: string
        url?: string
        protected?: boolean
        expiresInDays?: number
      }
      const sharePath = data.url ?? (data.id ? `/share/${data.id}` : null)
      if (!sharePath) throw new Error("Share URL missing")

      const shareUrl = new URL(sharePath, window.location.origin).toString()
      await navigator.clipboard.writeText(shareUrl)
      writeShareSettings({
        redact: shareRedact,
        expiresInDays,
        openAfterCreate: shareOpenAfterCreate,
      })
      if (shareOpenAfterCreate) {
        window.open(shareUrl, "_blank", "noopener,noreferrer")
      }
      setShareOpen(false)
      showShareToast(
        `Đã copy link chia sẻ (${data.expiresInDays ?? expiresInDays} ngày${data.protected ? ", có mật khẩu" : ""})`
      )
    } catch (error) {
      console.error(error)
      showShareToast("Không thể tạo link chia sẻ", "error")
    } finally {
      setSharing(false)
    }
  }

  function openToolsDialog() {
    setToolDraft([...(session.enabledTools ?? TOOL_NAMES)])
    setSmartRetryDraft(session.smartRetry !== false)
    setToolsOpen(true)
  }

  function toggleTool(toolName: string) {
    setToolDraft((prev) =>
      prev.includes(toolName) ? prev.filter((name) => name !== toolName) : [...prev, toolName]
    )
  }

  function saveTools() {
    const currentTools = session.enabledTools ?? TOOL_NAMES
    const newlyEnabledSensitive = SENSITIVE_TOOLS.filter(
      (toolName) => toolDraft.includes(toolName) && !currentTools.includes(toolName)
    )
    if (newlyEnabledSensitive.length > 0) {
      const labels = newlyEnabledSensitive
        .map((toolName) => TOOL_LABELS[toolName] ?? toolName)
        .join(", ")
      const confirmed = window.confirm(
        `Bạn đang bật tool nhạy cảm: ${labels}.\nCác tool này có thể gọi code/URL/API bên ngoài.\nTiếp tục?`
      )
      if (!confirmed) return
    }
    const enabledTools = toolDraft.length === TOOL_NAMES.length ? undefined : toolDraft
    setSessionEnabledTools(session.id, enabledTools)
    setSessionSmartRetry(session.id, smartRetryDraft ? undefined : false)
    setToolsOpen(false)
  }

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
    <>
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
        <span className="flex w-full min-w-0 items-center gap-1">
          {session.parentId && (
            <span className="shrink-0 text-[10px] text-muted-foreground" title="Cuộc trò chuyện nhánh">🔱</span>
          )}
          <span className="line-clamp-1 min-w-0 text-sm">{session.title}</span>
          {(session.tags ?? []).slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="shrink-0 rounded-full border px-1.5 py-0 text-[9px] font-medium leading-4"
              style={tagStyle(tag)}
            >
              {tag}
            </span>
          ))}
          {(session.tags?.length ?? 0) > 2 && (
            <span className="shrink-0 text-[9px] text-muted-foreground">+{session.tags!.length - 2}</span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {messageSnippet ? (
            <>{highlightText(messageSnippet, searchQuery)}</>
          ) : (
            <>
              {timeAgo(session.updatedAt)} · {session.messages.length} tin nhắn · {session.model.split("/").pop()}
            </>
          )}
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
          <DropdownMenuItem className="gap-2 text-xs" onClick={() => togglePinnedSession(session.id)}>
            {session.pinned ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
            {session.pinned ? "Bỏ ghim" : "Ghim"}
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={handleSetTags}>
            <Tags className="h-3.5 w-3.5" /> Đặt nhãn...
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 text-xs"
            onSelect={(e) => {
              e.preventDefault()
              openToolsDialog()
            }}
          >
            <Wrench className="h-3.5 w-3.5" /> 🔧 Công cụ
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Đổi tên
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-xs" onClick={onDuplicate}>
            <CopyIcon className="h-3.5 w-3.5" /> Nhân bản
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 text-xs"
            disabled={sharing}
            onSelect={(e) => {
              e.preventDefault()
              openShareDialog()
            }}
          >
            🔗 {sharing ? "Đang chia sẻ..." : "Chia sẻ..."}
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
    {shareNotice && (
      <div
        className={cn(
          "fixed bottom-4 right-4 z-30 rounded-lg border px-3 py-2 text-xs shadow-lg",
          shareNotice.type === "success"
            ? "border-emerald-500/30 bg-emerald-500 text-white"
            : "border-destructive/30 bg-destructive text-destructive-foreground"
        )}
        role="status"
      >
        {shareNotice.message}
      </div>
    )}
    <Dialog.Root open={shareOpen} onOpenChange={setShareOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200">
          <Dialog.Title className="text-base font-semibold">🔗 Chia sẻ cuộc trò chuyện</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Tùy chỉnh mức riêng tư trước khi tạo link. Link sẽ được copy vào clipboard.
          </Dialog.Description>

          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              void handleCreateShare()
            }}
          >
            <label className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
              <span>Ẩn dữ liệu nhạy cảm</span>
              <input
                type="checkbox"
                checked={shareRedact}
                onChange={(event) => setShareRedact(event.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
            </label>

            <label className="block space-y-1 text-xs text-muted-foreground">
              <span>Thời hạn link (1-90 ngày)</span>
              <input
                type="number"
                min={1}
                max={90}
                value={shareExpiresInDays}
                onChange={(event) => setShareExpiresInDays(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              />
            </label>

            <label className="block space-y-1 text-xs text-muted-foreground">
              <span>Mật khẩu (tuỳ chọn)</span>
              <Input
                type="password"
                value={sharePassword}
                onChange={(event) => setSharePassword(event.target.value)}
                placeholder="Để trống nếu không cần"
              />
            </label>

            <label className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
              <span>Mở link ngay sau khi tạo</span>
              <input
                type="checkbox"
                checked={shareOpenAfterCreate}
                onChange={(event) => setShareOpenAfterCreate(event.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setShareOpen(false)} disabled={sharing}>
                Hủy
              </Button>
              <Button type="submit" size="sm" disabled={sharing}>
                {sharing ? "Đang tạo..." : "Tạo link & copy"}
              </Button>
            </div>
          </form>

          <Dialog.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">
            <XIcon className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <Dialog.Root open={toolsOpen} onOpenChange={setToolsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200">
          <Dialog.Title className="text-base font-semibold">🔧 Công cụ</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Chọn các tool được phép dùng trong session này. Mặc định bật tất cả.
          </Dialog.Description>

          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
            {TOOL_NAMES.map((toolName) => (
              <label
                key={toolName}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted/60"
              >
                <input
                  type="checkbox"
                  checked={toolDraft.includes(toolName)}
                  onChange={() => toggleTool(toolName)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="text-xs font-medium">{TOOL_LABELS[toolName as keyof typeof TOOL_LABELS] ?? toolName}</span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground">{toolName}</span>
                </span>
                {SENSITIVE_TOOLS.includes(toolName as (typeof SENSITIVE_TOOLS)[number]) && (
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                    nhạy cảm
                  </span>
                )}
              </label>
            ))}
          </div>

          <label className="mt-3 flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
            <span>Smart Retry khi timeout/rate limit</span>
            <input
              type="checkbox"
              checked={smartRetryDraft}
              onChange={(event) => setSmartRetryDraft(event.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
          </label>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setToolDraft([...TOOL_NAMES])}>
              Bật tất cả
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setToolsOpen(false)}>
                Hủy
              </Button>
              <Button size="sm" onClick={saveTools}>
                Lưu
              </Button>
            </div>
          </div>

          <Dialog.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted">
            <XIcon className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    </>
  )
}

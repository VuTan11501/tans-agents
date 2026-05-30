"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

type CommandItem = {
  href: string
  title: string
  icon: string
}

type CommandPaletteProps = {
  open?: boolean
}

const COMMAND_ITEMS: CommandItem[] = [
  { href: "/", title: "Trang chính", icon: "💬" },
  { href: "/debate", title: "Tranh luận AI", icon: "⚔️" },
  { href: "/voice", title: "Giọng nói TTS", icon: "🔊" },
  { href: "/scheduled", title: "Chat hẹn giờ", icon: "⏰" },
  { href: "/workflows", title: "Workflow builder", icon: "🧩" },
  { href: "/clip", title: "AI Clipboard", icon: "📋" },
  { href: "/translate", title: "Dịch thuật", icon: "🌐" },
  { href: "/tone", title: "Phân tích tông giọng", icon: "🎚️" },
  { href: "/url-summary", title: "Tóm tắt URL", icon: "🔗" },
  { href: "/writing", title: "Trợ lý viết", icon: "✍️" },
  { href: "/flashcards", title: "Flashcards AI", icon: "🃏" },
  { href: "/mindmap-ai", title: "Mindmap AI", icon: "🧠" },
  { href: "/resume", title: "CV/Resume", icon: "📄" },
  { href: "/personas-mp", title: "Persona Marketplace", icon: "🎭" },
  { href: "/templates", title: "Prompt templates", icon: "✨" },
  { href: "/email", title: "Viết email", icon: "✉️" },
  { href: "/search", title: "Tìm kiếm hội thoại", icon: "🔎" },
  { href: "/pinned", title: "Đã ghim", icon: "📌" },
  { href: "/favorites", title: "Yêu thích", icon: "⭐" },
  { href: "/tags", title: "Lọc theo nhãn", icon: "🏷️" },
  { href: "/notes", title: "Ghi chú", icon: "📝" },
  { href: "/export", title: "Xuất Markdown", icon: "📤" },
  { href: "/mind-map", title: "Sơ đồ phân nhánh", icon: "🧠" },
  { href: "/team", title: "Team workspace", icon: "👥" },
  { href: "/meeting", title: "Phòng họp đa người", icon: "🎙️" },
  { href: "/meeting/demo", title: "Phòng họp theo ID", icon: "🚪" },
  { href: "/share/demo", title: "Chia sẻ", icon: "🔗" },
  { href: "/meeting-notes", title: "Ghi chú họp", icon: "📝" },
  { href: "/interview", title: "Phỏng vấn mock", icon: "🎤" },
  { href: "/recipe", title: "Nấu ăn", icon: "🍳" },
  { href: "/travel", title: "Lên kế hoạch du lịch", icon: "✈️" },
  { href: "/study", title: "Lộ trình học", icon: "📚" },
  { href: "/music", title: "Gợi ý nhạc", icon: "🎵" },
  { href: "/names", title: "Tạo tên", icon: "🏷️" },
  { href: "/stats", title: "Dashboard sử dụng", icon: "📊" },
  { href: "/json", title: "JSON tools", icon: "{}" },
  { href: "/text", title: "Xử lý văn bản", icon: "🔤" },
  { href: "/encode", title: "Mã hoá", icon: "🔐" },
  { href: "/hash", title: "Băm", icon: "#️⃣" },
  { href: "/random", title: "Ngẫu nhiên", icon: "🎲" },
  { href: "/sql", title: "SQL", icon: "🗄️" },
  { href: "/image", title: "Ảnh", icon: "🖼️" },
  { href: "/qr", title: "QR", icon: "▣" },
  { href: "/fun", title: "ASCII/Emoji", icon: "😄" },
  { href: "/regex", title: "Regex tester", icon: ".*" },
  { href: "/colors", title: "Color tools", icon: "🎨" },
  { href: "/time", title: "Timezone converter", icon: "🌏" },
  { href: "/md", title: "Markdown preview", icon: "⬇️" },
  { href: "/doc", title: "Tiptap editor", icon: "📄" },
  { href: "/sse-test", title: "SSE test", icon: "🧪" },
  { href: "/hub", title: "Trung tâm tính năng", icon: "🗂️" },
  { href: "/help", title: "Slash commands help", icon: "📘" },
  { href: "/shortcuts", title: "Phím tắt", icon: "⌨️" },
]

function normalize(value: string) {
  return value.toLocaleLowerCase("vi-VN").trim()
}

export function CommandPalette({ open = false }: CommandPaletteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(open)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const hotkeyLabel = useMemo(() => {
    if (typeof navigator === "undefined") return "Ctrl + K"
    return /(Mac|iPhone|iPad|iPod)/i.test(navigator.platform) ? "⌘K" : "Ctrl + K"
  }, [])
  const triggerBottom = pathname === "/" ? "calc(env(safe-area-inset-bottom) + 5.5rem)" : "calc(env(safe-area-inset-bottom) + 1rem)"

  function openPalette() {
    setIsOpen(true)
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        openPalette()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    setSelectedIndex(0)
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [isOpen])

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalize(query)
    if (!normalizedQuery) return COMMAND_ITEMS

    return COMMAND_ITEMS.filter((item) => normalize(`${item.title} ${item.href}`).includes(normalizedQuery))
  }, [query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  function close() {
    setIsOpen(false)
    setQuery("")
    setSelectedIndex(0)
  }

  function navigateTo(item: CommandItem) {
    close()
    router.push(item.href)
  }

  function handlePaletteKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      close()
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setSelectedIndex((current) => (filteredItems.length === 0 ? 0 : (current + 1) % filteredItems.length))
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setSelectedIndex((current) => (filteredItems.length === 0 ? 0 : (current - 1 + filteredItems.length) % filteredItems.length))
      return
    }

    if (event.key === "Enter" && filteredItems[selectedIndex]) {
      event.preventDefault()
      navigateTo(filteredItems[selectedIndex])
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={openPalette}
        className="fixed left-4 z-40 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/95 px-3 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur transition hover:bg-muted"
        style={{ bottom: triggerBottom }}
        aria-label={`Mở command palette (${hotkeyLabel})`}
      >
        <span className="rounded-full border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none">
          {hotkeyLabel}
        </span>
        <span className="hidden sm:inline">Mở nhanh</span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 p-4 backdrop-blur" onClick={close} onKeyDown={handlePaletteKeyDown}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="mx-auto mt-20 w-full max-w-2xl overflow-hidden rounded-xl border bg-card shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b p-4">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm trang hoặc nhập đường dẫn..."
            className="h-12 w-full rounded-lg border bg-background px-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            aria-label="Tìm kiếm trang"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Không tìm thấy trang phù hợp.</div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, index) => {
                const isSelected = index === selectedIndex

                return (
                  <button
                    key={`${item.href}-${item.title}`}
                    type="button"
                    onClick={() => navigateTo(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                      isSelected ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-lg font-semibold">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="block truncate font-mono text-xs text-muted-foreground">{item.href}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          <span>↑↓ chọn</span>
          <span>Enter mở · Esc đóng</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette

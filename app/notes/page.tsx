"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Save } from "lucide-react"
import { getNotes, setNotes, listSessionsWithNotes } from "@/lib/session-notes"
import { useChatHistory } from "@/hooks/use-chat-history"

export default function NotesPage() {
  const { sessions } = useChatHistory()
  const [selectedId, setSelectedId] = useState<string>("")
  const [content, setContent] = useState("")
  const [saved, setSaved] = useState(false)
  const [withNotes, setWithNotes] = useState<{ sessionId: string; preview: string; length: number }[]>([])

  useEffect(() => {
    const refresh = () => setWithNotes(listSessionsWithNotes())
    refresh()
    window.addEventListener("tans:notes-changed", refresh)
    return () => window.removeEventListener("tans:notes-changed", refresh)
  }, [])

  useEffect(() => {
    if (selectedId) setContent(getNotes(selectedId))
  }, [selectedId])

  const handleSave = () => {
    if (!selectedId) return
    setNotes(selectedId, content)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const sessionTitle = (id: string) => sessions.find((s) => s.id === id)?.title ?? "(đã xoá)"

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <FileText className="h-5 w-5" /> Ghi chú theo phiên
        </h1>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Quay lại
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <aside className="space-y-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">Chọn phiên</h2>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded border bg-background px-2 py-2 text-sm"
          >
            <option value="">-- Chọn --</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          {withNotes.length > 0 && (
            <>
              <h2 className="mt-4 text-xs font-semibold uppercase text-muted-foreground">
                Phiên đã có ghi chú ({withNotes.length})
              </h2>
              <ul className="space-y-1">
                {withNotes.map((n) => (
                  <li key={n.sessionId}>
                    <button
                      onClick={() => setSelectedId(n.sessionId)}
                      className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted ${
                        n.sessionId === selectedId ? "bg-muted" : ""
                      }`}
                    >
                      <div className="line-clamp-1 font-medium">{sessionTitle(n.sessionId)}</div>
                      <div className="line-clamp-1 text-[10px] text-muted-foreground">{n.preview}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        <section className="space-y-2">
          {selectedId ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">{sessionTitle(selectedId)}</h2>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90"
                >
                  <Save className="h-3 w-3" />
                  {saved ? "✅ Đã lưu" : "Lưu"}
                </button>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Viết ghi chú markdown ở đây... (tự lưu khi bấm Lưu)"
                className="h-[60vh] w-full rounded border bg-background p-3 font-mono text-sm leading-relaxed"
              />
              <p className="text-[10px] text-muted-foreground">
                {content.length.toLocaleString("vi-VN")} ký tự · Lưu cục bộ trên trình duyệt
              </p>
            </>
          ) : (
            <div className="flex h-[60vh] items-center justify-center rounded border border-dashed text-sm text-muted-foreground">
              ← Chọn một phiên để bắt đầu ghi chú
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

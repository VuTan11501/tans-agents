"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Pin, PinOff, Trash2 } from "lucide-react"
import { listPinned, togglePin, clearAllPins, type PinnedMessage } from "@/lib/pinned-messages"
import { useChatHistory } from "@/hooks/use-chat-history"

export default function PinnedPage() {
  const { sessions } = useChatHistory()
  const [items, setItems] = useState<PinnedMessage[]>([])

  useEffect(() => {
    const refresh = () => setItems(listPinned())
    refresh()
    window.addEventListener("tans:pinned-changed", refresh)
    return () => window.removeEventListener("tans:pinned-changed", refresh)
  }, [])

  const sessionTitle = (id: string) => sessions.find((s) => s.id === id)?.title ?? "(đã xoá)"

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Pin className="h-5 w-5" /> Tin nhắn đã ghim
        </h1>
        <div className="flex gap-2">
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            ← Quay lại
          </Link>
          {items.length > 0 && (
            <button
              onClick={() => confirm("Bỏ ghim tất cả?") && clearAllPins()}
              className="rounded border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="mr-1 inline h-3 w-3" />
              Xoá hết
            </button>
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          <Pin className="mx-auto mb-2 h-8 w-8 opacity-50" />
          Chưa có tin nhắn nào được ghim.
          <br />
          Mẹo: bấm icon 📌 cạnh tin nhắn để ghim.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => (
            <li key={`${p.sessionId}-${p.messageId}`} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                <Link href={`/?session=${p.sessionId}`} className="line-clamp-1 font-medium text-primary hover:underline">
                  {sessionTitle(p.sessionId)}
                </Link>
                <span className="shrink-0 text-muted-foreground">
                  {p.role === "user" ? "👤" : "🤖"} · {new Date(p.pinnedAt).toLocaleString("vi-VN")}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{p.preview}</p>
              <button
                onClick={() => togglePin({ sessionId: p.sessionId, messageId: p.messageId, preview: p.preview, role: p.role })}
                className="mt-2 text-xs text-muted-foreground hover:text-destructive"
              >
                <PinOff className="mr-1 inline h-3 w-3" />
                Bỏ ghim
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

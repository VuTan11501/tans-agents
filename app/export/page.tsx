"use client"

import Link from "next/link"
import { downloadAsMarkdown, sessionToMarkdown } from "@/lib/export-md"
import { useChatHistory, type ChatSession } from "@/hooks/use-chat-history"

function formatDate(value: number) {
  return new Date(value).toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function downloadCombined(sessions: ChatSession[]) {
  if (typeof window === "undefined" || sessions.length === 0) return

  const content = sessions.map(sessionToMarkdown).join("\n\n---\n\n")
  const date = new Date()
  const stamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `all-sessions-${stamp}.md`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default function ExportPage() {
  const { sessions } = useChatHistory()

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Xuất hội thoại</h1>
          <p className="text-sm text-muted-foreground">
            Tải các phiên chat thành tệp Markdown để lưu trữ hoặc chia sẻ.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            ← Quay lại
          </Link>
          <button
            type="button"
            onClick={() => downloadCombined(sessions)}
            disabled={sessions.length === 0}
            className="rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Tải tất cả
          </button>
        </div>
      </header>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Danh sách phiên chat</h2>
          <p className="text-xs text-muted-foreground">{sessions.length} phiên đã lưu</p>
        </div>

        {sessions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Chưa có phiên chat nào để xuất.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Tiêu đề</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Cập nhật</th>
                  <th className="px-4 py-3 text-right font-medium">Tải xuống</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="max-w-[320px] px-4 py-3">
                      <div className="truncate font-medium">{session.title || "Cuộc trò chuyện"}</div>
                      <div className="text-xs text-muted-foreground">{session.messages.length} tin nhắn</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {session.provider} / {session.model}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(session.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => downloadAsMarkdown(session)}
                        className="rounded-lg border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        Tải .md
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useChatHistory, type ChatSession } from "@/hooks/use-chat-history"

type TagStat = {
  name: string
  count: number
}

function formatDate(value: number) {
  return new Date(value).toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

function sessionTags(session: ChatSession) {
  return session.tags?.filter(Boolean) ?? []
}

export default function TagsPage() {
  const { sessions } = useChatHistory()
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const tagStats = useMemo<TagStat[]>(() => {
    const counts = new Map<string, number>()
    sessions.forEach((session) => {
      new Set(sessionTags(session)).forEach((tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      })
    })
    return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) =>
      a.name.localeCompare(b.name, "vi")
    )
  }, [sessions])

  const filteredSessions = useMemo(() => {
    const taggedSessions = sessions.filter((session) => sessionTags(session).length > 0)
    if (!selectedTag) return taggedSessions
    return taggedSessions.filter((session) => sessionTags(session).includes(selectedTag))
  }, [sessions, selectedTag])

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">🏷️ Bộ lọc tag</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Xem nhanh các hội thoại theo tag đã lưu trong lịch sử chat.
          </p>
        </div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Quay lại
        </Link>
      </header>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Tất cả tag</h2>
          <span className="rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {tagStats.length} tag
          </span>
        </div>

        {tagStats.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Chưa có hội thoại nào được gắn tag.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                selectedTag === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              Tất cả
              <span className="ml-2 rounded-full bg-background/20 px-1.5 text-xs">
                {sessions.filter((session) => sessionTags(session).length > 0).length}
              </span>
            </button>
            {tagStats.map((tag) => (
              <button
                key={tag.name}
                type="button"
                onClick={() => setSelectedTag(tag.name)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  selectedTag === tag.name
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {tag.name}
                <span className="ml-2 rounded-full bg-background/20 px-1.5 text-xs">
                  {tag.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">
            {selectedTag ? `Hội thoại có tag “${selectedTag}”` : "Tất cả hội thoại có tag"}
          </h2>
          <span className="text-xs text-muted-foreground">{filteredSessions.length} hội thoại</span>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            Không có hội thoại phù hợp.
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredSessions.map((session) => (
              <li key={session.id} className="rounded-lg border bg-card p-4 shadow-sm transition hover:bg-muted/30">
                <Link href={`/?session=${encodeURIComponent(session.id)}`} className="block space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 font-medium">{session.title}</h3>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(session.updatedAt)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sessionTags(session).map((tag) => (
                      <span key={tag} className="rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useChatHistory } from "@/hooks/use-chat-history"
import { FAVORITES_CHANGED_EVENT, listFavorites, toggleFavorite } from "@/lib/favorites"

function formatDate(value: number) {
  return new Date(value).toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  })
}

export default function FavoritesPage() {
  const { sessions } = useChatHistory()
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])

  useEffect(() => {
    const refresh = () => setFavoriteIds(listFavorites())
    refresh()
    window.addEventListener(FAVORITES_CHANGED_EVENT, refresh)
    window.addEventListener("storage", refresh)
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, refresh)
      window.removeEventListener("storage", refresh)
    }
  }, [])

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  const visibleSessions = useMemo(
    () => [...sessions].sort((a, b) => Number(favoriteSet.has(b.id)) - Number(favoriteSet.has(a.id)) || b.updatedAt - a.updatedAt),
    [sessions, favoriteSet]
  )
  const favoriteCount = sessions.filter((session) => favoriteSet.has(session.id)).length

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">⭐ Hội thoại yêu thích</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Đánh dấu sao các phiên chat quan trọng để xem lại nhanh trên trang này.
          </p>
        </div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Quay lại
        </Link>
      </header>

      {favoriteCount === 0 && (
        <section className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          <div className="mb-2 text-3xl">☆</div>
          Chưa có hội thoại yêu thích.
          <br />
          Mẹo: bấm nút “Đánh dấu sao” ở danh sách bên dưới để thêm vào mục này.
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Danh sách hội thoại</h2>
          <span className="text-xs text-muted-foreground">
            {favoriteCount}/{sessions.length} đã đánh dấu
          </span>
        </div>

        {visibleSessions.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            Chưa có lịch sử hội thoại để đánh dấu.
          </div>
        ) : (
          <ul className="space-y-3">
            {visibleSessions.map((session) => {
              const starred = favoriteSet.has(session.id)
              return (
                <li
                  key={session.id}
                  className={`rounded-lg border bg-card p-4 shadow-sm transition ${
                    starred ? "hover:bg-muted/30" : "opacity-55 grayscale hover:opacity-80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/?session=${encodeURIComponent(session.id)}`} className="min-w-0 flex-1 space-y-1">
                      <h3 className="line-clamp-2 font-medium">{session.title}</h3>
                      <p className="text-xs text-muted-foreground">Cập nhật: {formatDate(session.updatedAt)}</p>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        toggleFavorite(session.id)
                        setFavoriteIds(listFavorites())
                      }}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                        starred
                          ? "bg-primary text-primary-foreground hover:opacity-90"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {starred ? "★ Đã sao" : "☆ Đánh dấu sao"}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}

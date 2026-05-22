"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  addComment,
  canDeleteComment,
  deleteComment,
  listComments,
  type ShareComment,
} from "@/lib/share-comments"

export function ShareComments({ shareId }: { shareId: string }) {
  const [comments, setComments] = useState<ShareComment[]>([])
  const [author, setAuthor] = useState("")
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    try {
      const next = await listComments(shareId)
      setComments(next)
      setError("")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không tải được bình luận")
    } finally {
      setLoading(false)
    }
  }, [shareId])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 30_000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    try {
      setAuthor(localStorage.getItem("tans-agents:share-comment-author-v1") ?? "")
    } catch {}
  }, [])

  const ownIds = useMemo(() => new Set(comments.filter(canDeleteComment).map((item) => item.id)), [comments])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!content.trim() || submitting) return
    setSubmitting(true)
    setError("")
    try {
      const saved = await addComment(shareId, author, content)
      try {
        localStorage.setItem("tans-agents:share-comment-author-v1", saved.author)
      } catch {}
      setAuthor(saved.author)
      setContent("")
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không gửi được bình luận")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    setError("")
    setComments((current) => current.filter((item) => item.id !== id))
    try {
      await deleteComment(shareId, id)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không xoá được bình luận")
      await load()
    }
  }

  return (
    <section className="space-y-5 pb-8" aria-labelledby="share-comments-title">
      <div className="space-y-1">
        <h2 id="share-comments-title" className="text-xl font-semibold tracking-tight">
          Bình luận
        </h2>
        <p className="text-sm text-muted-foreground">Chia sẻ cảm nghĩ hoặc góp ý về phiên chat này.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
        <Input
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
          placeholder="Tên của bạn (tuỳ chọn)"
          maxLength={60}
        />
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Viết bình luận..."
          className="min-h-24 resize-none"
          maxLength={2000}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{content.trim().length}/2000 ký tự</p>
          <Button type="submit" disabled={!content.trim() || submitting}>
            {submitting ? "Đang gửi..." : "Gửi"}
          </Button>
        </div>
      </form>

      {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Đang tải bình luận...</p>
        ) : comments.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Chưa có bình luận nào. Hãy là người đầu tiên góp ý.
          </p>
        ) : (
          comments.map((comment) => (
            <article key={comment.id} className="flex gap-3 rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {comment.author.trim().charAt(0).toUpperCase() || "A"}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{comment.author}</p>
                    <time className="text-xs text-muted-foreground" dateTime={new Date(comment.createdAt).toISOString()}>
                      {new Date(comment.createdAt).toLocaleString("vi-VN")}
                    </time>
                  </div>
                  {ownIds.has(comment.id) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Xoá bình luận"
                      onClick={() => void handleDelete(comment.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{comment.content}</p>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

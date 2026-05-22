"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { MessageBubble } from "@/components/message"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ChatSession = {
  id: string
  title: string
  messages: any[]
  [key: string]: unknown
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) return content.map(textFromContent).filter(Boolean).join("\n")
  if (content && typeof content === "object") {
    const value = content as { text?: unknown; content?: unknown }
    return textFromContent(value.text ?? value.content ?? "")
  }
  return ""
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; session: ChatSession }
  | { kind: "needs-password"; title?: string; error?: string }
  | { kind: "not-found" }

export function ShareView({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" })
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(
    async (pwd?: string) => {
      try {
        const url = new URL(`/api/share`, window.location.origin)
        url.searchParams.set("id", id)
        if (pwd) url.searchParams.set("password", pwd)
        const res = await fetch(url.toString(), { cache: "no-store" })
        if (res.status === 401) {
          const body = await res.json().catch(() => ({}))
          setState({ kind: "needs-password", title: body?.title, error: body?.error })
          return
        }
        if (!res.ok) {
          setState({ kind: "not-found" })
          return
        }
        const data = await res.json()
        if (data?.session) setState({ kind: "ok", session: data.session })
        else setState({ kind: "not-found" })
      } catch {
        setState({ kind: "not-found" })
      }
    },
    [id]
  )

  useEffect(() => {
    void load()
  }, [load])

  if (state.kind === "loading") {
    return <Centered>Đang tải...</Centered>
  }

  if (state.kind === "not-found") {
    return <Centered>Chat không tồn tại hoặc đã hết hạn</Centered>
  }

  if (state.kind === "needs-password") {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
          <div className="w-full space-y-4 rounded-lg border bg-card p-6 shadow-sm">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">🔒 Cuộc trò chuyện riêng tư</h2>
              <p className="text-sm text-muted-foreground">
                {state.title ? `"${state.title}"` : "Chat này"} yêu cầu mật khẩu.
              </p>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!password.trim() || submitting) return
                setSubmitting(true)
                await load(password.trim())
                setSubmitting(false)
              }}
              className="space-y-3"
            >
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                autoFocus
              />
              {state.error && <p className="text-xs text-destructive">{state.error}</p>}
              <Button type="submit" className="w-full" disabled={!password.trim() || submitting}>
                {submitting ? "Đang xác thực..." : "Mở chat"}
              </Button>
            </form>
            <Link
              href="/"
              className="block text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Về trang chủ
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const session = state.session
  const messages = session.messages?.filter((m: any) => m?.role !== "system") ?? []

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
        <header className="border-b border-border/60 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Chia sẻ cuộc trò chuyện
          </p>
          <h1 className="mt-2 line-clamp-2 text-2xl font-semibold tracking-tight">
            {session.title ?? "Tan's Agent"}
          </h1>
        </header>

        <section className="flex-1 py-8">
          {messages.length === 0 ? (
            <Centered>Cuộc trò chuyện này chưa có tin nhắn.</Centered>
          ) : (
            <div className="space-y-8">
              {messages.map((message: any, index: number) => (
                <MessageBubble
                  key={message.id ?? index}
                  role={message.role}
                  content={textFromContent(message.content)}
                  parts={message.parts}
                />
              ))}
            </div>
          )}
        </section>

        <footer className="border-t border-border/60 py-5 text-center text-sm text-muted-foreground">
          <Link href="/" className="font-medium text-foreground underline-offset-4 hover:underline">
            Quay về Tan&apos;s Agent
          </Link>
        </footer>
      </div>
    </main>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 text-center text-sm text-muted-foreground">
        {children}
      </div>
    </main>
  )
}

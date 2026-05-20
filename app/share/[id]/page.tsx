import Link from "next/link"
import { headers } from "next/headers"
import { MessageBubble } from "@/components/message"

type ChatSession = {
  id: string
  title: string
  messages: any[]
  provider: string
  model: string
  createdAt: number
  updatedAt: number
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

async function getOrigin() {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  if (!host) return null

  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http"
  return `${proto}://${host}`
}

async function getSharedSession(id: string): Promise<ChatSession | null> {
  const origin = await getOrigin()
  if (!origin) return null

  const url = new URL("/api/share", origin)
  url.searchParams.set("id", id)

  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) return null

  const data = (await response.json().catch(() => null)) as { session?: ChatSession } | null
  return data?.session ?? null
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSharedSession(id)
  const messages = session?.messages?.filter((message) => message?.role !== "system") ?? []

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4">
        <header className="border-b border-border/60 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Chia sẻ cuộc trò chuyện</p>
          <h1 className="mt-2 line-clamp-2 text-2xl font-semibold tracking-tight">
            {session?.title ?? "Tan's Agent"}
          </h1>
        </header>

        <section className="flex-1 py-8">
          {!session ? (
            <div className="flex min-h-[40vh] items-center justify-center text-center text-sm text-muted-foreground">
              Chat không tồn tại hoặc đã hết hạn
            </div>
          ) : messages.length === 0 ? (
            <div className="flex min-h-[40vh] items-center justify-center text-center text-sm text-muted-foreground">
              Cuộc trò chuyện này chưa có tin nhắn.
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map((message, index) => (
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

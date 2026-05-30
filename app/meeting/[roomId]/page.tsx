"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import {
  appendMeetingMessages,
  createMeetingMessage,
  getMeetingGistId,
  getMeetingNick,
  getMeetingPat,
  mergeMeetingMessages,
  pullMeetingRoom,
  type MeetingMessage,
  type MeetingRoom,
} from "@/lib/meeting-sync"

function formatTime(ts: number) {
  if (!ts) return "--:--"
  return new Date(ts).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

async function streamMeetingAI(messages: MeetingMessage[], onDelta: (text: string) => void) {
  const res = await fetch("/api/chat-sse", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      enabledTools: [],
      personaSystemPrompt:
        "Bạn là trợ lý AI trong một phòng họp nhóm. Trả lời bằng tiếng Việt, ngắn gọn, bám sát ngữ cảnh các tin nhắn trong phòng.",
      messages: messages.map((m) => ({
        role: m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user",
        content: m.author === "AI" ? m.content : `${m.author}: ${m.content}`,
      })),
    }),
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "")
    throw new Error(text || `HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  let finalText = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let sep = buffer.indexOf("\n\n")
    while (sep !== -1) {
      const frame = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      for (const raw of frame.split("\n")) {
        const line = raw.trim()
        if (!line.startsWith("data:")) continue
        const data = line.slice(5).trim()
        if (!data || data === "[DONE]") continue
        const json = JSON.parse(data)
        if (json.error) throw new Error(json.error.message ?? "AI stream error")
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          finalText += delta
          onDelta(delta)
        }
      }
      sep = buffer.indexOf("\n\n")
    }
  }

  return finalText.trim()
}

export default function MeetingRoomPage() {
  const params = useParams<{ roomId: string }>()
  const roomId = String(params?.roomId ?? "")
  const [gistId, setGistId] = useState("")
  const [pat, setPat] = useState("")
  const [nick, setNick] = useState("")
  const [room, setRoom] = useState<MeetingRoom | null>(null)
  const [messages, setMessages] = useState<MeetingMessage[]>([])
  const [input, setInput] = useState("")
  const [status, setStatus] = useState("")
  const [aiBusy, setAiBusy] = useState(false)
  const [visible, setVisible] = useState(true)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const canSync = Boolean(roomId && gistId && pat)

  useEffect(() => {
    setGistId(getMeetingGistId())
    setPat(getMeetingPat())
    setNick(getMeetingNick() || "anon")
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "end" })
  }, [messages, aiBusy])

  const mergeLocal = useCallback((incoming: MeetingMessage[]) => {
    setMessages((prev) => mergeMeetingMessages(prev, incoming))
  }, [])

  const pull = useCallback(async () => {
    if (!canSync) return
    try {
      const result = await pullMeetingRoom(gistId, pat, roomId)
      setRoom(result.room)
      mergeLocal(result.data.messages)
      setStatus(`Đã đồng bộ ${new Date().toLocaleTimeString("vi-VN")}`)
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? e}`)
    }
  }, [canSync, gistId, mergeLocal, pat, roomId])

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden)
    onVisibility()
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (!canSync || !visible) return
    void pull()
    intervalRef.current = setInterval(() => void pull(), 5000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [canSync, pull, visible])

  const pushMessages = useCallback(
    async (outgoing: MeetingMessage[]) => {
      if (!canSync) {
        setStatus("⚠️ Thiếu Gist ID hoặc PAT. Quay lại lobby để cấu hình.")
        return
      }
      try {
        const data = await appendMeetingMessages(gistId, pat, roomId, outgoing)
        mergeLocal(data.messages)
        setStatus("✅ Đã gửi")
      } catch (e: any) {
        setStatus(`❌ Gửi thất bại: ${e?.message ?? e}`)
      }
    },
    [canSync, gistId, mergeLocal, pat, roomId]
  )

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault()
    const content = input.trim()
    if (!content) return
    const message = createMeetingMessage(nick, "user", content)
    setInput("")
    mergeLocal([message])
    await pushMessages([message])
  }

  const handleAskAI = async () => {
    if (aiBusy) return
    const draft = input.trim()
    const userMessage = draft ? createMeetingMessage(nick, "user", draft) : null
    const baseMessages = userMessage ? mergeMeetingMessages(messagesRef.current, [userMessage]) : messagesRef.current
    if (baseMessages.length === 0) {
      setStatus("⚠️ Chưa có nội dung để hỏi AI")
      return
    }

    if (userMessage) {
      setInput("")
      mergeLocal([userMessage])
      void pushMessages([userMessage])
    }

    const assistant = createMeetingMessage("AI", "assistant", "")
    setAiBusy(true)
    setStatus("🤖 AI đang trả lời...")
    mergeLocal([assistant])

    try {
      const final = await streamMeetingAI(baseMessages, (delta) => {
        setMessages((prev) => prev.map((m) => (m.id === assistant.id ? { ...m, content: m.content + delta } : m)))
      })
      const finalAssistant = { ...assistant, content: final || "(AI không trả về nội dung)" }
      setMessages((prev) => prev.map((m) => (m.id === assistant.id ? finalAssistant : m)))
      await pushMessages([finalAssistant])
      setStatus("✅ AI đã trả lời")
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== assistant.id))
      setStatus(`❌ AI lỗi: ${e?.message ?? e}`)
    } finally {
      setAiBusy(false)
    }
  }

  const participants = new Set(messages.map((m) => m.author).filter(Boolean))

  return (
    <main className="mx-auto flex h-screen max-w-4xl flex-col gap-4 px-4 py-4">
      <header className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{room?.title ?? "Phòng họp AI"}</h1>
            <Badge variant="secondary">Người tham gia: {participants.size}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Room: <code>{roomId}</code> · {visible ? "đang polling 5s" : "tab ẩn, đã tạm dừng polling"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/meeting">Rời phòng</Link>
        </Button>
      </header>

      {!canSync && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            Thiếu Gist ID hoặc PAT. Vui lòng quay lại lobby để cấu hình trước khi tham gia.
          </CardContent>
        </Card>
      )}

      <ScrollArea className="min-h-0 flex-1 rounded-lg border bg-muted/20 p-4">
        <div className="space-y-3 pr-3">
          {messages.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
              Chưa có tin nhắn. Hãy gửi lời chào để bắt đầu phòng họp.
            </p>
          ) : (
            messages.map((message) => {
              const mine = message.author === nick && message.role === "user"
              const ai = message.role === "assistant"
              return (
                <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-lg border px-3 py-2 text-sm shadow-sm ${
                      mine
                        ? "border-primary/30 bg-primary text-primary-foreground"
                        : ai
                          ? "border-violet-500/30 bg-violet-500/10"
                          : "bg-card"
                    }`}
                  >
                    <div className={`mb-1 flex items-center gap-2 text-xs ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      <strong>{message.author}</strong>
                      <span>{formatTime(message.ts)}</span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{message.content || (aiBusy && ai ? "Đang nghĩ..." : "")}</div>
                  </div>
                </div>
              )
            })
          )}
          {aiBusy && <div className="text-xs text-muted-foreground">🤖 AI đang nhập...</div>}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSend} className="rounded-lg border bg-card p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập tin nhắn cho phòng..."
          className="max-h-40 min-h-20 resize-none"
          disabled={!canSync}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-h-5 text-xs text-muted-foreground">{status}</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={handleAskAI} disabled={!canSync || aiBusy}>
              🤖 Hỏi AI
            </Button>
            <Button type="submit" disabled={!canSync || !input.trim()}>
              Gửi
            </Button>
          </div>
        </div>
      </form>
    </main>
  )
}

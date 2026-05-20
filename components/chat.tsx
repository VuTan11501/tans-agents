"use client"

import { useChat } from "ai/react"
import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Bot, User, Send, Sparkles, Loader2, Wrench, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"

const SUGGESTIONS = [
  "Bây giờ là mấy giờ?",
  "Tính (1234 * 56) + 789",
  "Tin tức AI mới nhất",
  "Giải thích Transformer trong 3 câu",
]

export function Chat() {
  const [provider, setProvider] = useState<ProviderKey>("google")
  const [model, setModel] = useState<string>(PROVIDERS.google.default)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, setInput } = useChat({
    api: "/api/chat",
    body: { provider, model },
  })

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function changeProvider(p: ProviderKey) {
    setProvider(p)
    setModel(PROVIDERS[p].default)
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-none">Tan&apos;s AI Agent</h1>
              <p className="text-xs text-muted-foreground">Multi-provider · Free forever</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={provider} onValueChange={(v) => changeProvider(v as ProviderKey)}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDERS).map(([key, p]) => (
                  <SelectItem key={key} value={key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-9 w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS[provider].models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMessages([])}
              disabled={messages.length === 0}
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-6">
          {messages.length === 0 ? (
            <EmptyState onPick={(t) => setInput(t)} />
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <Message key={m.id} role={m.role} content={m.content} parts={m.parts} />
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Agent đang suy nghĩ...
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="sticky bottom-0 border-t bg-background/80 backdrop-blur-md">
        <div className="container mx-auto max-w-3xl px-4 py-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Hỏi bất cứ điều gì..."
              disabled={isLoading}
              className="h-12 flex-1"
              autoFocus
            />
            <Button type="submit" size="icon" className="h-12 w-12" disabled={isLoading || !input.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Powered by {PROVIDERS[provider].label} · {model}
          </p>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <Sparkles className="h-8 w-8" />
      </div>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Chào, mình là Tan&apos;s Agent 👋</h2>
        <p className="mt-2 text-muted-foreground">
          Mình có thể search web, tính toán, và trả lời câu hỏi với 3 LLM provider miễn phí.
        </p>
      </div>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <Card
            key={s}
            className="cursor-pointer transition-colors hover:bg-accent"
            onClick={() => onPick(s)}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm">{s}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Message({ role, content, parts }: { role: string; content: string; parts?: any[] }) {
  const isUser = role === "user"
  const toolInvocations = parts?.filter((p) => p.type === "tool-invocation") || []

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0 bg-primary">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={`flex max-w-[85%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        {toolInvocations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {toolInvocations.map((p, i) => (
              <Badge key={i} variant="secondary" className="gap-1 font-mono text-xs">
                <Wrench className="h-3 w-3" />
                {p.toolInvocation?.toolName}
              </Badge>
            ))}
          </div>
        )}

        <Card className={isUser ? "bg-primary text-primary-foreground" : "bg-card"}>
          <CardContent className="px-4 py-3">
            {isUser ? (
              <p className="whitespace-pre-wrap text-sm">{content}</p>
            ) : (
              <div className="prose-chat text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "..."}</ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

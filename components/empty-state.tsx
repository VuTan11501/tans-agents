"use client"
import { Sparkles, Wrench, Search, Calculator, Clock, Code2, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"

const SUGGESTIONS = [
  { icon: Search, label: "Tin tức", text: "Tin tức AI mới nhất tuần này" },
  { icon: Calculator, label: "Toán", text: "Tính (1234 × 56) + 789, giải thích bước làm" },
  { icon: Clock, label: "Thời gian", text: "Bây giờ là mấy giờ ở Tokyo và New York?" },
  { icon: Code2, label: "Code", text: "Viết hàm Python tính Fibonacci dùng memoization" },
  { icon: Lightbulb, label: "Học", text: "Giải thích Transformer như mình 5 tuổi" },
  { icon: Wrench, label: "Tool", text: "Mình có thể nhờ bạn làm gì?" },
]

export function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="relative flex flex-col items-center justify-center px-4 py-16 sm:py-24">
      {/* Hero glow */}
      <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[400px] w-[600px] max-w-full blur-2xl" />

      {/* Logo */}
      <div className="relative mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-border/50 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-orange-500/20 shadow-lg shadow-violet-500/10 backdrop-blur fade-up">
        <Sparkles className="h-7 w-7 text-foreground" />
        <span className="absolute -inset-px rounded-2xl bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-orange-500/10 blur-sm" />
      </div>

      {/* Title */}
      <h1 className="fade-up mb-3 text-center text-4xl font-semibold tracking-tight sm:text-5xl">
        Xin chào, mình là{" "}
        <span className="gradient-text">Tan&apos;s Agent</span>
      </h1>
      <p className="fade-up mb-12 max-w-xl text-center text-base text-muted-foreground sm:text-lg">
        Trợ lý AI miễn phí với khả năng tìm kiếm web, tính toán và suy luận.
        Chọn provider yêu thích từ menu trên cùng.
      </p>

      {/* Suggestion grid */}
      <div className="fade-up grid w-full max-w-3xl grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(s.text)}
            className={cn(
              "group flex items-start gap-3 rounded-xl border border-border/60 bg-card/30 p-4 text-left transition-all hover:border-border hover:bg-card hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-foreground/10 group-hover:text-foreground">
              <s.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="mt-0.5 line-clamp-2 text-sm text-foreground">{s.text}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

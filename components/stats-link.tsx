import Link from "next/link"
import { cn } from "@/lib/utils"

export function StatsLink({ className }: { className?: string }) {
  return (
    <Link
      href="/stats"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted",
        className
      )}
    >
      📊 Thống kê
    </Link>
  )
}

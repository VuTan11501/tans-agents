import Link from "next/link"
import { SLASH_COMMANDS } from "@/lib/slash-commands"

export default function HelpPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">📘 Hướng dẫn</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Quay lại
        </Link>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Slash Commands</h2>
        <p className="text-xs text-muted-foreground">Gõ tại đầu khung chat để kích hoạt:</p>
        <ul className="space-y-2">
          {SLASH_COMMANDS.map((cmd) => (
            <li key={cmd.name} className="rounded border p-3 text-sm">
              <div className="flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">{cmd.name}</code>
                {cmd.aliases?.map((a) => (
                  <code key={a} className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                    {a}
                  </code>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{cmd.description}</p>
              <p className="mt-1 text-[11px] font-mono text-muted-foreground">vd: {cmd.example}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Phím tắt</h2>
        <ul className="space-y-1 text-sm">
          <li><kbd className="rounded border px-1.5 py-0.5 text-xs">?</kbd> — Mở dialog phím tắt</li>
          <li><kbd className="rounded border px-1.5 py-0.5 text-xs">Ctrl+K</kbd> — Tìm kiếm hội thoại</li>
          <li><kbd className="rounded border px-1.5 py-0.5 text-xs">Enter</kbd> — Gửi tin nhắn</li>
          <li><kbd className="rounded border px-1.5 py-0.5 text-xs">Shift+Enter</kbd> — Xuống dòng</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Trang tiện ích</h2>
        <ul className="space-y-1 text-sm">
          <li><Link href="/search" className="text-primary hover:underline">/search</Link> — Tìm kiếm hội thoại</li>
          <li><Link href="/team" className="text-primary hover:underline">/team</Link> — Workspace nhóm</li>
          <li><Link href="/workflows" className="text-primary hover:underline">/workflows</Link> — Workflow tự động</li>
          <li><Link href="/scheduled" className="text-primary hover:underline">/scheduled</Link> — Lên lịch chat</li>
          <li><Link href="/debate" className="text-primary hover:underline">/debate</Link> — Tranh luận AI (sắp có)</li>
          <li><Link href="/stats" className="text-primary hover:underline">/stats</Link> — Thống kê sử dụng</li>
          <li><Link href="/doc" className="text-primary hover:underline">/doc</Link> — Trình soạn thảo</li>
        </ul>
      </section>
    </main>
  )
}

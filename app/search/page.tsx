"use client"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChatSearchDialog } from "@/components/chat-search-dialog"

export default function SearchPage() {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Quay lại
        </Link>
        <h1 className="mt-4 text-xl font-semibold">🔍 Tìm kiếm hội thoại</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Dùng dialog tìm kiếm bên dưới. Mẹo: bấm <kbd className="rounded border px-1 text-[10px]">Ctrl+K</kbd> ở mọi nơi để mở nhanh.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
        >
          Mở tìm kiếm
        </button>
      </div>
      <ChatSearchDialog
        open={open}
        onClose={() => {
          setOpen(false)
          router.push("/")
        }}
        onJump={(sessionId) => {
          router.push(`/?session=${sessionId}`)
        }}
      />
    </main>
  )
}

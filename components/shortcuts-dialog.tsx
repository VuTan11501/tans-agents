"use client"

import * as React from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Keyboard, X } from "lucide-react"
import { cn } from "@/lib/utils"

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl/⌘", "K"], label: "Mở lịch sử & menu" },
  { keys: ["Ctrl/⌘", "Shift", "O"], label: "Cuộc trò chuyện mới" },
  { keys: ["Ctrl/⌘", "/"], label: "Focus ô soạn tin" },
  { keys: ["Ctrl/⌘", "F"], label: "Tìm trong chat" },
  { keys: ["Esc"], label: "Dừng streaming" },
  { keys: ["Shift", "?"], label: "Hiện cửa sổ này" },
]

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4 duration-300 ease-out will-change-transform">
          <Dialog.Title className="mb-1 flex items-center gap-2 text-base font-semibold">
            <Keyboard className="h-4 w-4" /> Phím tắt
          </Dialog.Title>
          <Dialog.Description className="mb-3 text-xs text-muted-foreground">
            Một số phím tắt giúp thao tác nhanh.
          </Dialog.Description>
          <ul className="space-y-2">
            {SHORTCUTS.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-sm">{s.label}</span>
                <span className="flex gap-1">
                  {s.keys.map((k, j) => (
                    <kbd key={j} className={cn("rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]")}>{k}</kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <Dialog.Close
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Đóng phím tắt"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { Keyboard, X } from "lucide-react"

const SHORTCUTS = [
  ["?", "Mở/đóng dialog này"],
  ["Ctrl/Cmd + K", "Mở sidebar (nếu có)"],
  ["Ctrl/Cmd + Enter", "Gửi tin nhắn"],
  ["Ctrl/Cmd + /", "Focus input"],
  ["Ctrl/Cmd + Shift + N", "Cuộc trò chuyện mới"],
  ["Esc", "Dừng stream / đóng dialog"],
  ["↑ (trong input rỗng)", "Sửa tin nhắn cuối"],
] as const

type KeyboardShortcutsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[94vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200">
          <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
            <Keyboard className="h-4 w-4" /> Phím tắt
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Các phím tắt thao tác nhanh trong chat.
          </Dialog.Description>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Phím</th>
                  <th className="px-3 py-2 font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {SHORTCUTS.map(([keys, action]) => (
                  <tr key={keys}>
                    <td className="px-3 py-2 align-top">
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]">{keys}</kbd>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

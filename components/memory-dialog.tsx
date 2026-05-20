"use client"

import { useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { MemoryState } from "@/lib/system-prompt"

interface MemoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memory: MemoryState
  setAbout: (about: string) => void
  addFact: (fact: string) => void
  removeFact: (index: number) => void
  clearAll: () => void
}

export function MemoryDialog({
  open,
  onOpenChange,
  memory,
  setAbout,
  addFact,
  removeFact,
  clearAll,
}: MemoryDialogProps) {
  const [draftFact, setDraftFact] = useState("")

  function handleAddFact() {
    addFact(draftFact)
    setDraftFact("")
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          <Dialog.Title className="text-base font-semibold">🧠 Bộ nhớ</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Lưu thông tin dài hạn để agent cá nhân hoá câu trả lời. Dữ liệu chỉ nằm trong localStorage của trình duyệt này.
          </Dialog.Description>

          <div className="mt-4 space-y-4 overflow-y-auto pr-1">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Về bạn</span>
              <Textarea
                value={memory.about}
                onChange={(event) => setAbout(event.target.value)}
                placeholder="Ví dụ: Tôi là lập trình viên Next.js, thích câu trả lời ngắn gọn bằng tiếng Việt..."
                className="min-h-28 resize-y"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Sự thật cần nhớ</h3>
                {memory.facts.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-7 px-2 text-xs">
                    Xoá tất cả
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  value={draftFact}
                  onChange={(event) => setDraftFact(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      handleAddFact()
                    }
                  }}
                  placeholder="Thêm một sự thật..."
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button type="button" size="sm" onClick={handleAddFact} disabled={!draftFact.trim()} aria-label="Thêm sự thật">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {memory.facts.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Chưa có sự thật nào được lưu.
                </p>
              ) : (
                <ul className="space-y-2">
                  {memory.facts.map((fact, index) => (
                    <li key={`${fact}-${index}`} className="flex items-start gap-2 rounded-lg border bg-card/60 p-2 text-sm">
                      <span className="min-w-0 flex-1 whitespace-pre-wrap">{fact}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFact(index)}
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="Xoá sự thật"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <Dialog.Close
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Đóng bộ nhớ"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

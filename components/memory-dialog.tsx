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
  addFact: (fact: string, options?: { confidence?: number; expiresInDays?: number | null }) => void
  removeFact: (index: number) => void
  clearAll: () => void
}

const CONFIDENCE_OPTIONS = [
  { value: 0.4, label: "Thấp" },
  { value: 0.7, label: "Vừa" },
  { value: 0.9, label: "Cao" },
]

function expiresLabel(expiresAt?: number) {
  if (!expiresAt) return "Không hết hạn"
  try {
    return `Hết hạn: ${new Date(expiresAt).toLocaleDateString("vi-VN")}`
  } catch {
    return "Có hết hạn"
  }
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
  const [draftConfidence, setDraftConfidence] = useState(0.7)
  const [draftExpiryDays, setDraftExpiryDays] = useState("")

  function handleAddFact() {
    const expiresInDays = draftExpiryDays.trim() ? Number(draftExpiryDays) : null
    addFact(draftFact, {
      confidence: draftConfidence,
      expiresInDays: Number.isFinite(expiresInDays as number) ? (expiresInDays as number) : null,
    })
    setDraftFact("")
    setDraftExpiryDays("")
    setDraftConfidence(0.7)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200">
          <Dialog.Title className="text-base font-semibold">🧠 Bộ nhớ</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Lưu thông tin dài hạn để agent cá nhân hoá câu trả lời. Dữ liệu chỉ nằm trong trình duyệt này.
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

              <div className="space-y-2 rounded-lg border bg-card/40 p-2">
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
                  className="h-9 min-w-0 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Độ tin cậy
                    <select
                      value={draftConfidence}
                      onChange={(event) => setDraftConfidence(Number(event.target.value))}
                      className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      {CONFIDENCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Hết hạn sau (ngày)
                    <input
                      type="number"
                      min={1}
                      value={draftExpiryDays}
                      onChange={(event) => setDraftExpiryDays(event.target.value)}
                      placeholder="VD: 30"
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    />
                  </label>
                  <Button type="button" size="sm" onClick={handleAddFact} disabled={!draftFact.trim()} aria-label="Thêm sự thật">
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Thêm
                  </Button>
                </div>
              </div>

              {memory.facts.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Chưa có sự thật nào được lưu.
                </p>
              ) : (
                <ul className="space-y-2">
                  {memory.facts.map((fact, index) => (
                    <li key={`${fact.text}-${index}`} className="flex items-start gap-2 rounded-lg border bg-card/60 p-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="whitespace-pre-wrap break-words">{fact.text}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Độ tin cậy {(fact.confidence * 100).toFixed(0)}% · {expiresLabel(fact.expiresAt)}
                        </div>
                      </div>
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

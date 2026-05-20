"use client"

import { useEffect, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Library, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { usePrompts, type PromptItem } from "@/hooks/use-prompts"

interface PromptLibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (prompt: PromptItem) => void
}

export function PromptLibraryDialog({ open, onOpenChange, onSelect }: PromptLibraryDialogProps) {
  const { prompts, addPrompt, updatePrompt, deletePrompt } = usePrompts()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      setTitle("")
      setBody("")
    }
  }, [open])

  const editingPrompt = prompts.find((prompt) => prompt.id === editingId)

  function startEdit(prompt: PromptItem) {
    setEditingId(prompt.id)
    setTitle(prompt.title)
    setBody(prompt.body)
  }

  function resetForm() {
    setEditingId(null)
    setTitle("")
    setBody("")
  }

  function handleSave() {
    if (!title.trim() || !body.trim()) return
    if (editingId) {
      updatePrompt(editingId, { title, body })
    } else {
      addPrompt({ title, body })
    }
    resetForm()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4 duration-300 ease-out will-change-transform">
          <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
            <Library className="h-4 w-4" /> Prompt Library
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Lưu prompt tái sử dụng trong localStorage. Biến được nhận diện theo dạng {"{{name}}"}.
          </Dialog.Description>

          <div className="mt-4 grid min-h-0 gap-4 md:grid-cols-[1fr_280px]">
            <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
              {prompts.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Chưa có prompt nào. Hãy thêm prompt đầu tiên ở khung bên phải.
                </p>
              ) : (
                prompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelect(prompt)
                      onOpenChange(false)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onSelect(prompt)
                        onOpenChange(false)
                      }
                    }}
                    className="block w-full cursor-pointer rounded-lg border bg-card/60 p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{prompt.title}</div>
                        <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                          {prompt.body}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(event) => {
                            event.stopPropagation()
                            startEdit(prompt)
                          }}
                          aria-label="Sửa prompt"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(event) => {
                            event.stopPropagation()
                            deletePrompt(prompt.id)
                            if (editingId === prompt.id) resetForm()
                          }}
                          aria-label="Xoá prompt"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {prompt.vars && prompt.vars.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {prompt.vars.map((v) => (
                          <Badge key={v} variant="outline" className="text-[10px]">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="space-y-3 rounded-lg border bg-card/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{editingPrompt ? "Sửa prompt" : "Thêm prompt"}</h3>
                {editingPrompt && (
                  <Button type="button" variant="ghost" size="sm" onClick={resetForm} className="h-7 px-2 text-xs">
                    Huỷ
                  </Button>
                )}
              </div>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tiêu đề" />
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Nội dung prompt... Dùng {{name}} cho biến."
                className="min-h-40 resize-y"
              />
              <Button type="button" onClick={handleSave} disabled={!title.trim() || !body.trim()} className="w-full gap-2">
                <Plus className="h-3.5 w-3.5" /> {editingPrompt ? "Lưu thay đổi" : "Thêm prompt"}
              </Button>
            </div>
          </div>

          <Dialog.Close
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Đóng thư viện prompt"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

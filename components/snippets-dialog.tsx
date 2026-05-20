"use client"

import { useEffect, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Bookmark, Pencil, Plus, Trash2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { addSnippet, deleteSnippet, getSnippets, snippetTrigger, updateSnippet, type SnippetItem } from "@/lib/snippets"

interface SnippetsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SnippetsDialog({ open, onOpenChange }: SnippetsDialogProps) {
  const [snippets, setSnippets] = useState<SnippetItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [content, setContent] = useState("")

  useEffect(() => {
    if (!open) return
    setSnippets(getSnippets())
  }, [open])

  const editingSnippet = snippets.find((snippet) => snippet.id === editingId)

  function refresh() {
    setSnippets(getSnippets())
  }

  function resetForm() {
    setEditingId(null)
    setName("")
    setContent("")
  }

  function startEdit(snippet: SnippetItem) {
    setEditingId(snippet.id)
    setName(snippet.name)
    setContent(snippet.content)
  }

  function handleSave() {
    if (!name.trim() || !content.trim()) return
    if (editingId) updateSnippet(editingId, { name, content })
    else addSnippet({ name, content })
    resetForm()
    refresh()
  }

  function handleDelete(id: string) {
    deleteSnippet(id)
    if (editingId === id) resetForm()
    refresh()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200">
          <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
            <Bookmark className="h-4 w-4" /> Snippet / Macro
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Tạo đoạn văn bản tái sử dụng. Gõ /tên-snippet trong ô chat để chèn và điền biến dạng {"{{variable}}"}.
          </Dialog.Description>

          <div className="mt-4 grid min-h-0 gap-4 md:grid-cols-[1fr_280px]">
            <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
              {snippets.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Chưa có snippet nào. Hãy thêm snippet đầu tiên ở khung bên phải.
                </p>
              ) : (
                snippets.map((snippet) => (
                  <div key={snippet.id} className="rounded-lg border bg-card/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium">{snippet.name}</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {snippetTrigger(snippet.name)}
                          </Badge>
                        </div>
                        <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{snippet.content}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(snippet)} aria-label="Sửa snippet">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(snippet.id)} aria-label="Xoá snippet">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {snippet.vars.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {snippet.vars.map((variable) => (
                          <Badge key={variable} variant="secondary" className="text-[10px]">
                            {variable}
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
                <h3 className="text-sm font-medium">{editingSnippet ? "Sửa snippet" : "Thêm snippet"}</h3>
                {editingSnippet && (
                  <Button type="button" variant="ghost" size="sm" onClick={resetForm} className="h-7 px-2 text-xs">
                    Huỷ
                  </Button>
                )}
              </div>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên snippet (vd: daily-standup)" />
              <Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Nội dung... Dùng {{name}} cho biến." className="min-h-40 resize-y" />
              <Button type="button" onClick={handleSave} disabled={!name.trim() || !content.trim()} className="w-full gap-2">
                <Plus className="h-3.5 w-3.5" /> {editingSnippet ? "Lưu thay đổi" : "Thêm snippet"}
              </Button>
            </div>
          </div>

          <Dialog.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="Đóng snippet">
            <X className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

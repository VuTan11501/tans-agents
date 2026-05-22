"use client"

import { useEffect, useMemo, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Copy, ExternalLink, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fillPromptTemplate, type PromptTemplate } from "@/lib/prompt-templates"
import { cn } from "@/lib/utils"

interface TemplateFillDialogProps {
  template: PromptTemplate | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}

  try {
    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export function TemplateFillDialog({ template, open, onOpenChange }: TemplateFillDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [copyStatus, setCopyStatus] = useState("")

  useEffect(() => {
    if (!open || !template) return
    setValues(Object.fromEntries(template.variables.map((variable) => [variable, ""])))
    setCopyStatus("")
  }, [open, template])

  const preview = useMemo(() => {
    if (!template) return ""
    return fillPromptTemplate(template.body, values)
  }, [template, values])

  async function handleCopy() {
    const ok = await copyText(preview)
    setCopyStatus(ok ? "Đã sao chép prompt." : "Không thể sao chép tự động, hãy copy thủ công từ ô xem trước.")
  }

  function openInChat() {
    window.location.href = `/?prompt=${encodeURIComponent(preview)}`
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border bg-background p-6 shadow-xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold">
                {template?.icon || "✨"} Điền biến: {template?.title || "Template"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                Ô trống sẽ giữ nguyên placeholder dạng {"{{var}}"} trong preview.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Đóng">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="mt-5 grid min-h-0 gap-4 md:grid-cols-[280px_1fr]">
            <div className="space-y-3 overflow-y-auto pr-1">
              {template?.variables.length ? (
                template.variables.map((variable) => (
                  <label key={variable} className="block space-y-1.5">
                    <span className="text-sm font-medium">{variable}</span>
                    <Input
                      value={values[variable] || ""}
                      onChange={(event) => setValues((current) => ({ ...current, [variable]: event.target.value }))}
                      placeholder={`Nhập ${variable}`}
                    />
                  </label>
                ))
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Template này không có biến. Bạn có thể sao chép hoặc mở trực tiếp trong Chat.
                </p>
              )}
            </div>

            <div className="flex min-h-0 flex-col gap-2">
              <label className="text-sm font-medium" htmlFor="template-preview">
                Xem trước prompt
              </label>
              <Textarea id="template-preview" value={preview} readOnly className="min-h-72 flex-1 resize-none font-mono text-xs" />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-h-5 text-sm text-muted-foreground" role="status">
              {copyStatus}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleCopy} className="gap-2">
                <Copy className="h-4 w-4" /> Sao chép prompt
              </Button>
              <Button type="button" onClick={openInChat} className="gap-2">
                <ExternalLink className="h-4 w-4" /> Mở trong Chat
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

"use client"

import { useState, type FormEvent } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { ImageIcon, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface ImageGenButtonProps {
  disabled?: boolean
  loading?: boolean
  onGenerate: (prompt: string) => Promise<void> | void
}

export function ImageGenButton({ disabled, loading = false, onGenerate }: ImageGenButtonProps) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState("")

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt || loading) return
    await onGenerate(cleanPrompt)
    setPrompt("")
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Dialog.Trigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={disabled || loading}
              className="h-9 w-9 shrink-0 rounded-full"
              aria-label="Tạo ảnh AI"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            </Button>
          </Dialog.Trigger>
        </TooltipTrigger>
        <TooltipContent>Tạo ảnh AI</TooltipContent>
      </Tooltip>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[94vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200">
          <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
            <ImageIcon className="h-4 w-4" /> Tạo ảnh AI
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Nhập prompt để tạo ảnh bằng Pollinations.ai.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <Input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Nhập mô tả ảnh..."
              disabled={disabled || loading}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
                Huỷ
              </Button>
              <Button type="submit" size="sm" disabled={disabled || loading || prompt.trim().length < 3} className="gap-2">
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {loading ? "Đang tạo ảnh..." : "Tạo ảnh AI"}
              </Button>
            </div>
          </form>

          <Dialog.Close
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Đóng tạo ảnh AI"
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

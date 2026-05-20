"use client"

import { useEffect, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Bug, Copy, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { clearErrors, copyAsBugReport, getErrors, type LoggedError } from "@/lib/error-log"

interface ErrorLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ErrorLogDialog({ open, onOpenChange }: ErrorLogDialogProps) {
  const [errors, setErrors] = useState<LoggedError[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setErrors(getErrors())
      setCopied(false)
    }
  }, [open])

  async function handleCopy() {
    await copyAsBugReport(errors)
    setCopied(true)
  }

  function handleClear() {
    clearErrors()
    setErrors([])
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95">
          <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
            <Bug className="h-4 w-4" /> Error Replay Log
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Lưu tối đa 50 lỗi gọi AI gần nhất trong localStorage để copy bug report.
          </Dialog.Description>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Badge variant="outline">{errors.length} lỗi</Badge>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCopy} disabled={errors.length === 0} className="gap-2">
                <Copy className="h-3.5 w-3.5" />
                <span role="status" aria-live="polite">{copied ? "Copied" : "Copy bug report"}</span>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={errors.length === 0} className="gap-2">
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {errors.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Chưa có lỗi nào được ghi.</p>
            ) : (
              errors.map((entry, index) => (
                <details key={`${entry.time}-${index}`} className="rounded-lg border bg-card/60 p-3">
                  <summary className="cursor-pointer list-none space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{new Date(entry.time).toLocaleString()}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {entry.request.provider ?? "unknown"} / {entry.request.model ?? "unknown"}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm text-destructive">{entry.error}</div>
                  </summary>
                  <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                    {JSON.stringify(entry.request, null, 2)}
                  </pre>
                </details>
              ))
            )}
          </div>

          <Dialog.Close
            className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Đóng nhật ký lỗi"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

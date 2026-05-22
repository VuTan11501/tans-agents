"use client"
import { useEffect, useState } from "react"
import { Check, Copy, QrCode, X } from "lucide-react"

interface QRShareDialogProps {
  open: boolean
  url: string
  title?: string
  onClose: () => void
}

// Use api.qrserver.com (free, no auth, no rate limit documented)
function qrUrl(data: string, size = 320): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=10`
}

export function QRShareDialog({ open, url, title = "Chia sẻ qua QR", onClose }: QRShareDialogProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  if (!open) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <QrCode className="h-4 w-4" />
            {title}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="my-4 flex justify-center">
          <img
            src={qrUrl(url)}
            alt="QR Code"
            width={240}
            height={240}
            className="rounded-md border bg-white p-2"
            loading="lazy"
          />
        </div>
        <p className="break-all rounded-md bg-muted/50 p-2 text-[11px] font-mono text-muted-foreground">{url}</p>
        <button
          onClick={handleCopy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Đã copy!" : "Copy URL"}
        </button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Quét QR bằng camera điện thoại để mở
        </p>
      </div>
    </div>
  )
}

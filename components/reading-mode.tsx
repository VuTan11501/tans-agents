"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { BookOpen, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ReadingMode() {
  const [mounted, setMounted] = useState(false)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (enabled) root.dataset.reading = "on"
    else delete root.dataset.reading

    return () => {
      delete root.dataset.reading
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      setEnabled(false)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enabled])

  if (!mounted) return null

  return createPortal(
    <Button
      type="button"
      size="icon"
      variant={enabled ? "default" : "secondary"}
      onClick={() => setEnabled((current) => !current)}
      aria-pressed={enabled}
      aria-label={enabled ? "Thoát chế độ đọc" : "Chế độ đọc"}
      title={enabled ? "Thoát chế độ đọc" : "Chế độ đọc"}
      className={cn(
        "fixed right-4 h-10 w-10 rounded-full shadow-lg transition-all",
        enabled ? "bottom-4 z-[60]" : "bottom-24 z-30"
      )}
    >
      {enabled ? <X className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
    </Button>,
    document.body
  )
}
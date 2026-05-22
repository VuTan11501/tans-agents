"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { list, remove } from "@/lib/offline-queue"
import { runDueScheduledChats } from "@/lib/scheduled-chats"

export function PWARegister() {
  const drainingRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const drainQueue = async () => {
      if (!navigator.onLine || drainingRef.current) return
      drainingRef.current = true

      try {
        const items = await list()
        if (items.length === 0) return

        toast(`📡 Đang gửi lại ${items.length} tin nhắn đã queue...`)
        let failed = false

        for (const item of items) {
          try {
            const response = await fetch(item.url, {
              method: item.method,
              headers: item.headers,
              body: item.body,
            })

            if (response.ok) {
              await remove(item.id)
            } else {
              failed = true
            }
          } catch {
            failed = true
          }
        }

        toast(failed ? "❌ Vẫn không gửi được" : "✅ Đã đồng bộ")
      } finally {
        drainingRef.current = false
      }
    }

    const registerServiceWorker = async () => {
      const canRegister =
        "serviceWorker" in navigator &&
        (process.env.NODE_ENV === "production" ||
          location.protocol === "https:" ||
          location.hostname === "localhost")

      if (!canRegister) return

      try {
        const existing = await navigator.serviceWorker.getRegistration("/")
        if (!existing || !existing.active?.scriptURL.endsWith("/sw.js")) {
          await navigator.serviceWorker.register("/sw.js")
        }
      } catch {
        // Registration failure should not affect the app shell.
      }
    }

    const handleOnline = () => {
      void drainQueue()
    }
    const handleOffline = () => undefined

    const scheduledTick = () => {
      void runDueScheduledChats().catch(() => {})
    }
    const scheduledInterval = window.setInterval(scheduledTick, 60_000)

    void registerServiceWorker()
    scheduledTick()
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    if (navigator.onLine) window.setTimeout(handleOnline, 0)

    return () => {
      window.clearInterval(scheduledInterval)
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return null
}

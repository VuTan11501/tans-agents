"use client"
import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"

const ENABLED = process.env.NEXT_PUBLIC_ENABLE_CLOUD_SYNC === "1"

export function AuthProvider({ children }: { children: ReactNode }) {
  // Tắt SessionProvider nếu cloud-sync chưa được cấu hình.
  // Tránh /api/auth/session bị gọi → 500 vì thiếu NEXTAUTH_SECRET.
  if (!ENABLED) return <>{children}</>
  return <SessionProvider>{children}</SessionProvider>
}

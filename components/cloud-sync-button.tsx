"use client"
import { useSession, signIn, signOut } from "next-auth/react"
import { useCloudSync } from "@/hooks/use-cloud-sync"
import { Cloud, CloudOff, Loader2, Github, LogOut, RefreshCw, Check } from "lucide-react"
import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function formatRelative(ts: number | null): string {
  if (!ts) return "—"
  const diff = Date.now() - ts
  if (diff < 5_000) return "vừa xong"
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s trước`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`
  return `${Math.floor(diff / 86_400_000)} ngày trước`
}

export function CloudSyncButton() {
  const { data: session, status: authStatus } = useSession()
  const { status, lastSyncAt, error, pullAll, pushAll } = useCloudSync()
  const [open, setOpen] = useState(false)

  if (authStatus === "loading") {
    return (
      <button className="flex w-full items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Đang tải...</span>
      </button>
    )
  }

  if (authStatus !== "authenticated") {
    return (
      <button
        onClick={() => signIn("github")}
        className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-xs hover:bg-muted"
        title="Đăng nhập GitHub để đồng bộ chat history + settings sang các thiết bị khác"
      >
        <Github className="h-3.5 w-3.5" />
        <span className="truncate">Đăng nhập để sync</span>
      </button>
    )
  }

  const user = session?.user
  const Icon = status === "error" ? CloudOff : status === "pulling" || status === "pushing" ? Loader2 : Check
  const iconClass = `h-3.5 w-3.5 ${status === "pulling" || status === "pushing" ? "animate-spin" : ""} ${
    status === "error" ? "text-destructive" : "text-emerald-500"
  }`

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-xs hover:bg-muted"
          title={error ? `Sync error: ${error}` : `Last sync: ${formatRelative(lastSyncAt)}`}
        >
          <Icon className={iconClass} />
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-4 w-4 rounded-full" />
          ) : null}
          <span className="truncate text-left">
            {user?.name ?? "Đã đăng nhập"}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {formatRelative(lastSyncAt)}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs">
          <div className="font-medium">{user?.name}</div>
          <div className="text-[11px] text-muted-foreground">{user?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setOpen(false)
            void pullAll()
          }}
          className="gap-2 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <div className="flex flex-col">
            <span>Đồng bộ ngay</span>
            <span className="text-[10px] text-muted-foreground">
              Cuối: {formatRelative(lastSyncAt)}
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setOpen(false)
            void pushAll()
          }}
          className="gap-2 text-xs"
        >
          <Cloud className="h-3.5 w-3.5" />
          <span>Đẩy local lên cloud</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setOpen(false)
            void signOut({ redirect: false })
          }}
          className="gap-2 text-xs text-destructive focus:text-destructive"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Đăng xuất</span>
        </DropdownMenuItem>
        {error ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[10px] text-destructive">{error}</div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

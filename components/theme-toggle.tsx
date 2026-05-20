"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type Variant = "icon" | "menu-item"

export function ThemeToggle({ variant = "icon" }: { variant?: Variant }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  // avoid hydration mismatch — render placeholder until client-mounted
  const current = mounted ? theme ?? "system" : "system"

  if (variant === "menu-item") {
    return (
      <div className="flex items-center gap-1 rounded-md p-1">
        {(
          [
            { key: "light", label: "Sáng", icon: Sun },
            { key: "dark", label: "Tối", icon: Moon },
            { key: "system", label: "Hệ thống", icon: Monitor },
          ] as const
        ).map(({ key, label, icon: Icon }) => {
          const active = current === key
          return (
            <Button
              key={key}
              variant={active ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-8 flex-1 gap-1.5 text-xs",
                active && "bg-muted"
              )}
              onClick={() => setTheme(key)}
              aria-label={label}
              aria-pressed={active}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          )
        })}
      </div>
    )
  }

  // compact icon-only variant for header
  const Icon =
    !mounted ? Monitor : current === "dark" ? Moon : current === "light" ? Sun : Monitor
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Đổi giao diện">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-3.5 w-3.5" /> Sáng
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-3.5 w-3.5" /> Tối
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-3.5 w-3.5" /> Hệ thống
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

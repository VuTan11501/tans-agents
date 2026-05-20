"use client"
import { Sparkles, ChevronDown, Check, Plus, Menu, Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PersonaPicker } from "@/components/persona-picker"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"
import type { PersonaId } from "@/lib/personas"
import { cn } from "@/lib/utils"

interface HeaderProps {
  provider: ProviderKey
  model: string
  persona: PersonaId
  onChange: (p: ProviderKey, m: string) => void
  onPersonaChange: (persona: PersonaId) => void
  onNewChat: () => void
  canNewChat: boolean
  onOpenMenu: () => void
  onOpenMemory: () => void
}

export function Header({
  provider,
  model,
  persona,
  onChange,
  onPersonaChange,
  onNewChat,
  canNewChat,
  onOpenMenu,
  onOpenMemory,
}: HeaderProps) {
  const providerLabel = PROVIDERS[provider].label

  return (
    <header className="sticky top-0 z-20 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
        {/* Left: Hamburger + brand */}
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={onOpenMenu}
                aria-label="Mở menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Lịch sử & menu</TooltipContent>
          </Tooltip>
          <div className="hidden items-center gap-2 sm:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-orange-500/20">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Tan&apos;s Agent</span>
          </div>
        </div>

        {/* Center: Model + persona pickers */}
        <div className="flex min-w-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 max-w-[45vw] gap-1.5 rounded-full border border-border/60 px-3 text-xs font-medium hover:bg-muted/50"
              >
                <span className="hidden text-muted-foreground sm:inline">{providerLabel}</span>
                <span className="truncate font-mono">{model}</span>
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-72">
              {Object.entries(PROVIDERS).map(([pKey, p]) => (
                <div key={pKey}>
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>{p.label}</span>
                    {pKey === provider && <Check className="h-3 w-3" />}
                  </DropdownMenuLabel>
                  {p.models.map((m) => {
                    const selected = pKey === provider && m === model
                    return (
                      <DropdownMenuItem
                        key={m}
                        onClick={() => onChange(pKey as ProviderKey, m)}
                        className={cn("font-mono text-xs", selected && "bg-accent")}
                      >
                        <span className="flex-1">{m}</span>
                        {selected && <Check className="h-3 w-3" />}
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <PersonaPicker value={persona} onChange={onPersonaChange} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full border border-border/60"
                onClick={onOpenMemory}
                aria-label="Mở bộ nhớ"
              >
                <Brain className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Bộ nhớ</TooltipContent>
          </Tooltip>
        </div>

        {/* Right: New chat */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={onNewChat}
              disabled={!canNewChat}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Bắt đầu cuộc trò chuyện mới</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}

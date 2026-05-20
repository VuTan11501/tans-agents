"use client"
import { useState } from "react"
import { Sparkles, ChevronDown, Check, Plus, Menu, Brain, Library, Bug, Key } from "lucide-react"
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
import { ApiKeysDialog } from "@/components/api-keys-dialog"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"
import type { PersonaId } from "@/lib/personas"
import { cn } from "@/lib/utils"
import { hasAnyUserKey, type UserKeyProvider, type UserKeys } from "@/lib/user-keys"

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
  onOpenPromptLibrary: () => void
  onOpenErrorLog: () => void
  userKeys: UserKeys
  setUserKey: (provider: UserKeyProvider, value: string) => void
  clearUserKeys: () => void
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
  onOpenPromptLibrary,
  onOpenErrorLog,
  userKeys,
  setUserKey,
  clearUserKeys,
}: HeaderProps) {
  const [apiKeysOpen, setApiKeysOpen] = useState(false)
  const providerLabel = PROVIDERS[provider].label
  const hasKeys = hasAnyUserKey(userKeys)

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
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 min-w-0 max-w-[38vw] shrink gap-1.5 rounded-full border border-border/60 px-3 text-xs font-medium hover:bg-muted/50"
              >
                <span className="hidden text-muted-foreground lg:inline">{providerLabel}</span>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full border border-border/60"
                onClick={onOpenPromptLibrary}
                aria-label="Mở thư viện prompt"
              >
                <Library className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Prompt Library</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full border border-border/60"
                onClick={onOpenErrorLog}
                aria-label="Mở error log"
              >
                <Bug className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Error log</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 shrink-0 rounded-full border border-border/60"
                onClick={() => setApiKeysOpen(true)}
                aria-label="Mở API keys"
              >
                <Key className="h-3.5 w-3.5" />
                {hasKeys && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-500" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">API keys</TooltipContent>
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
      <ApiKeysDialog
        open={apiKeysOpen}
        onOpenChange={setApiKeysOpen}
        keys={userKeys}
        setKey={setUserKey}
        clearAll={clearUserKeys}
      />
    </header>
  )
}

"use client"
import { useState } from "react"
import {
  Sparkles,
  Bookmark,
  Check,
  Plus,
  Menu,
  Brain,
  FolderOpen,
  Library,
  Bug,
  Key,
  Mic,
  MoreHorizontal,
  Palette,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { PersonaPicker } from "@/components/persona-picker"
import { ModelPicker } from "@/components/model-picker"
import { CollectionsDialog } from "@/components/collections-dialog"
import { SnippetsDialog } from "@/components/snippets-dialog"
import { ThemeCustomizer } from "@/components/theme-customizer"
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
import { PERSONAS, getPersona, type PersonaId } from "@/lib/personas"
import { type ProviderKey } from "@/lib/providers"
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
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const [snippetsOpen, setSnippetsOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const isAutoModel = model === "auto"
  const hasKeys = hasAnyUserKey(userKeys)
  const currentPersona = getPersona(persona)
  const toggleVoiceMode = () => window.dispatchEvent(new CustomEvent("tans:voice-toggle"))

  return (
    <header className="sticky top-0 z-20 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-1.5 px-3 sm:gap-2 sm:px-4">
        {/* Left: Hamburger + brand (logo hidden on mobile to save space) */}
        <div className="flex shrink-0 items-center gap-1.5">
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
          <div className="hidden items-center gap-2 md:flex">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-orange-500/20">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Tan&apos;s Agent</span>
          </div>
        </div>

        {/* Center: Model picker grows to fill space */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
          <ModelPicker
            provider={provider}
            model={model}
            onChange={onChange}
            showAuto
            userKeys={userKeys}
            triggerPrefix={
              <span className="sm:hidden" aria-hidden>
                {isAutoModel ? "🤖" : currentPersona.emoji}
              </span>
            }
          />

          {/* Persona picker — hidden on mobile (emoji shown inside model picker; full picker in overflow menu) */}
          <div className="hidden sm:block">
            <PersonaPicker value={persona} onChange={onPersonaChange} />
          </div>
        </div>

        {/* Right: action icons (visible on ≥md), overflow menu (<md), new chat */}
        <div className="relative flex shrink-0 items-center gap-1">
          {/* Desktop-only inline icon buttons (hidden — use overflow menu on all sizes) */}
          <div className="hidden">
            <IconBtn label="Bộ nhớ" onClick={onOpenMemory}>
              <Brain className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Prompt Library" onClick={onOpenPromptLibrary}>
              <Library className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Bộ tài liệu" onClick={() => setCollectionsOpen(true)}>
              <FolderOpen className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Snippet / Macro" onClick={() => setSnippetsOpen(true)}>
              <Bookmark className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Chế độ giọng nói" onClick={toggleVoiceMode}>
              <Mic className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Tuỳ chỉnh màu" onClick={() => setThemeOpen((open) => !open)}>
              <Palette className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Error log" onClick={onOpenErrorLog}>
              <Bug className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="API keys" onClick={() => setApiKeysOpen(true)}>
              <Key className="h-3.5 w-3.5" />
              {hasKeys && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-500" />
              )}
            </IconBtn>
          </div>

          {/* Overflow menu (all sizes) */}
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9"
                  aria-label="Tuỳ chọn khác"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  {hasKeys && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="sm:hidden">Persona</DropdownMenuLabel>
                {PERSONAS.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => onPersonaChange(p.id)}
                    className={cn("text-sm sm:hidden", p.id === persona && "bg-accent")}
                  >
                    <span className="mr-2 text-base">{p.emoji}</span>
                    <span className="flex-1">{p.label}</span>
                    {p.id === persona && <Check className="h-3 w-3" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="sm:hidden" />
                <DropdownMenuItem onClick={onOpenMemory}>
                  <Brain className="mr-2 h-4 w-4" /> Bộ nhớ
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenPromptLibrary}>
                  <Library className="mr-2 h-4 w-4" /> Prompt Library
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCollectionsOpen(true)}>
                  <FolderOpen className="mr-2 h-4 w-4" /> Bộ tài liệu
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSnippetsOpen(true)}>
                  <Bookmark className="mr-2 h-4 w-4" /> Snippet / Macro
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleVoiceMode} className="hidden md:flex">
                  <Mic className="mr-2 h-4 w-4" /> Chế độ giọng nói
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setThemeOpen(true)}>
                  <Palette className="mr-2 h-4 w-4" /> Tuỳ chỉnh màu
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenErrorLog}>
                  <Bug className="mr-2 h-4 w-4" /> Error log
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setApiKeysOpen(true)}>
                  <Key className="mr-2 h-4 w-4" />
                  <span className="flex-1">API keys</span>
                  {hasKeys && (
                    <span className="ml-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* New chat (icon-only on mobile, label on ≥sm) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 px-0 sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2.5 sm:text-xs"
                onClick={onNewChat}
                disabled={!canNewChat}
                aria-label="Bắt đầu cuộc trò chuyện mới"
              >
                <Plus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">New chat</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Bắt đầu cuộc trò chuyện mới</TooltipContent>
          </Tooltip>
          <ThemeCustomizer open={themeOpen} onOpenChange={setThemeOpen} />
        </div>
      </div>
      <CollectionsDialog open={collectionsOpen} onOpenChange={setCollectionsOpen} />
      <SnippetsDialog open={snippetsOpen} onOpenChange={setSnippetsOpen} />
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

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 shrink-0 rounded-full border border-border/60"
          onClick={onClick}
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

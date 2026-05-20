"use client"
import { Sparkles, ChevronDown, Trash2, Github, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"

interface HeaderProps {
  provider: ProviderKey
  model: string
  onChange: (p: ProviderKey, m: string) => void
  onClear: () => void
  canClear: boolean
}

export function Header({ provider, model, onChange, onClear, canClear }: HeaderProps) {
  const providerLabel = PROVIDERS[provider].label

  return (
    <header className="sticky top-0 z-20 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-orange-500/20">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Tan&apos;s Agent</span>
        </div>

        {/* Center: Model picker */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-full border border-border/60 px-3 text-xs font-medium hover:bg-muted/50"
            >
              <span className="text-muted-foreground">{providerLabel}</span>
              <span className="font-mono">{model}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
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

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClear}
                disabled={!canClear}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear chat</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a
                  href="https://github.com/VuTan11501/tans-agents"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-4 w-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>View on GitHub</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}

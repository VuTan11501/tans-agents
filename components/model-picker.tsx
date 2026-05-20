"use client"

import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"
import type { UserKeys } from "@/lib/user-keys"
import { cn } from "@/lib/utils"

interface ModelPickerProps {
  /** Currently-selected provider. If null, picker shows model only (no Auto / persona). */
  provider?: ProviderKey
  /** Currently-selected model id. Empty string = no selection yet. */
  model: string
  /** Called when user picks. provider may be undefined when caller doesn't track it (e.g. AB compare). */
  onChange: (provider: ProviderKey, model: string) => void
  /** Show "🤖 Auto" option at top. Default false. */
  showAuto?: boolean
  /** Optional prefix shown inside trigger button (e.g. persona emoji). */
  triggerPrefix?: React.ReactNode
  /** Trigger label override (default: model id, or "🤖 Auto" when model === "auto"). */
  triggerClassName?: string
  /** Align dropdown content. Default "center". */
  align?: "start" | "center" | "end"
  /** Width of dropdown content. Default w-72. */
  contentClassName?: string
  /** User keys for live discovery (Google). When omitted, only static list shown. */
  userKeys?: UserKeys
  /** Visible label above provider (e.g. "Mô hình A"). Renders outside trigger. */
  label?: string
  size?: "sm" | "default"
  disabled?: boolean
}

export function ModelPicker({
  provider,
  model,
  onChange,
  showAuto = false,
  triggerPrefix,
  triggerClassName,
  align = "center",
  contentClassName,
  userKeys,
  label,
  size = "sm",
  disabled,
}: ModelPickerProps) {
  const [discoveredGoogleModels, setDiscoveredGoogleModels] = useState<string[] | null>(null)
  const [discoveringGoogle, setDiscoveringGoogle] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)
  const isAutoModel = model === "auto"
  const providerLabel = provider ? PROVIDERS[provider].label : ""

  async function discoverGoogleModels() {
    setDiscoveringGoogle(true)
    setDiscoverError(null)
    try {
      const res = await fetch("/api/google/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userKey: userKeys?.gemini ?? "" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      const ids = (data.models as Array<{ id: string }>).map((m) => m.id)
      setDiscoveredGoogleModels(ids)
    } catch (err) {
      setDiscoverError(err instanceof Error ? err.message : String(err))
    } finally {
      setDiscoveringGoogle(false)
    }
  }

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size={size}
      disabled={disabled}
      className={cn(
        "h-8 min-w-0 max-w-full shrink gap-1.5 rounded-full border border-border/60 px-3 text-xs font-medium hover:bg-muted/50",
        triggerClassName
      )}
    >
      {!isAutoModel && providerLabel && (
        <span className="hidden text-muted-foreground lg:inline">{providerLabel}</span>
      )}
      {triggerPrefix}
      {isAutoModel ? (
        <span className="hidden truncate font-mono sm:inline">🤖 Auto</span>
      ) : (
        <span className="truncate font-mono">{model || "Chọn model"}</span>
      )}
      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
    </Button>
  )

  const content = (
    <DropdownMenuContent
      align={align}
      className={cn("w-72 p-0", contentClassName)}
      style={{
        // Radix expose biến này = khoảng cao còn lại tới viewport edge.
        // Cộng với overflow-y trên div bên trong → scroll mượt, không tràn.
        maxHeight: "min(60vh, var(--radix-dropdown-menu-content-available-height))",
      }}
    >
      <div className="overflow-y-auto p-1" style={{ maxHeight: "inherit" }}>
        {showAuto && provider && (
          <>
            <DropdownMenuItem
              onClick={() => onChange(provider, "auto")}
              className={cn("text-xs", isAutoModel && "bg-accent")}
            >
              <span className="mr-2 text-base">🤖</span>
              <span className="flex-1">Auto (chọn theo prompt)</span>
              {isAutoModel && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {Object.entries(PROVIDERS).map(([pKey, p]) => {
          const isGoogle = pKey === "google"
          const modelList: readonly string[] =
            isGoogle && discoveredGoogleModels && discoveredGoogleModels.length > 0
              ? Array.from(new Set([...p.models, ...discoveredGoogleModels]))
              : p.models
          return (
            <div key={pKey}>
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>{p.label}</span>
                {pKey === provider && <Check className="h-3 w-3" />}
              </DropdownMenuLabel>
              {modelList.map((m) => {
                const selected = pKey === provider && m === model
                const onlyByModel = !provider && m === model
                return (
                  <DropdownMenuItem
                    key={m}
                    onClick={() => onChange(pKey as ProviderKey, m)}
                    className={cn("font-mono text-xs", (selected || onlyByModel) && "bg-accent")}
                  >
                    <span className="flex-1 break-all">{m}</span>
                    {(selected || onlyByModel) && <Check className="h-3 w-3 shrink-0" />}
                  </DropdownMenuItem>
                )
              })}
              {isGoogle && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    discoverGoogleModels()
                  }}
                  className="text-[11px] text-muted-foreground"
                  disabled={discoveringGoogle}
                >
                  {discoveringGoogle
                    ? "Đang quét..."
                    : discoveredGoogleModels
                    ? `↻ Quét lại (${discoveredGoogleModels.length} model)`
                    : "↻ Quét live model có sẵn với key của bạn"}
                </DropdownMenuItem>
              )}
              {isGoogle && discoverError && (
                <div className="px-2 py-1 text-[10px] text-destructive break-words [overflow-wrap:anywhere]">
                  {discoverError}
                </div>
              )}
              <DropdownMenuSeparator />
            </div>
          )
        })}
      </div>
    </DropdownMenuContent>
  )

  if (label) {
    return (
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          {content}
        </DropdownMenu>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      {content}
    </DropdownMenu>
  )
}

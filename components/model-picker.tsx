"use client"

import { Check, ChevronDown, Infinity as InfinityIcon } from "lucide-react"
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
import { ModelStore, useModelStore, discoverModels } from "@/lib/model-store"
import { getModelLimit } from "@/lib/rate-limits"

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
  const store = useModelStore()
  const { discovered, discovering, discoverError } = store
  const isAutoModel = model === "auto"
  const providerLabel = provider ? PROVIDERS[provider].label : ""

  function handleDiscover(p: ProviderKey) {
    const userKey =
      p === "google" ? userKeys?.gemini : p === "groq" ? userKeys?.groq : userKeys?.github
    void discoverModels(p, userKey)
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
          const pTyped = pKey as ProviderKey
          const discoveredIds = discovered[pTyped]
          const modelList: readonly string[] =
            discoveredIds && discoveredIds.length > 0
              ? Array.from(new Set([...p.models, ...discoveredIds]))
              : p.models
          const isDiscovering = discovering === pTyped
          const errMsg = discoverError[pTyped]
          return (
            <div key={pKey}>
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>{p.label}</span>
                {pKey === provider && <Check className="h-3 w-3" />}
              </DropdownMenuLabel>
              {modelList.map((m) => {
                const selected = pKey === provider && m === model
                const onlyByModel = !provider && m === model
                const limit = getModelLimit(pTyped, m)
                const used = ModelStore.getUsage(pTyped, m)
                const remaining = limit.rpd === null ? null : Math.max(0, limit.rpd - used)
                const lowQuota = remaining !== null && remaining <= 5
                const exhausted = remaining !== null && remaining === 0
                const badgeTitle =
                  limit.rpd === null
                    ? `${limit.note ?? "Không giới hạn"} — đã dùng hôm nay: ${used}`
                    : `Còn ${remaining}/${limit.rpd} req hôm nay (đã dùng ${used})`
                return (
                  <DropdownMenuItem
                    key={m}
                    onClick={() => onChange(pTyped, m)}
                    className={cn(
                      "font-mono text-xs",
                      (selected || onlyByModel) && "bg-accent",
                      exhausted && "opacity-60",
                    )}
                  >
                    <span className="flex-1 break-all">{m}</span>
                    <span
                      title={badgeTitle}
                      className={cn(
                        "ml-2 inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-sans tabular-nums",
                        limit.rpd === null
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : exhausted
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : lowQuota
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-border/60 bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {limit.rpd === null ? (
                        <InfinityIcon className="h-3 w-3" aria-label="Không giới hạn" />
                      ) : (
                        <>
                          <span>{remaining}</span>
                          <span className="opacity-60">/{limit.rpd}</span>
                        </>
                      )}
                    </span>
                    {(selected || onlyByModel) && <Check className="ml-1 h-3 w-3 shrink-0" />}
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault()
                  handleDiscover(pTyped)
                }}
                className="text-[11px] text-muted-foreground"
                disabled={isDiscovering}
              >
                {isDiscovering
                  ? "Đang quét..."
                  : discoveredIds
                  ? `↻ Quét lại (${discoveredIds.length} model)`
                  : "↻ Quét live model có sẵn với key của bạn"}
              </DropdownMenuItem>
              {errMsg && (
                <div className="px-2 py-1 text-[10px] text-destructive break-words [overflow-wrap:anywhere]">
                  {errMsg}
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

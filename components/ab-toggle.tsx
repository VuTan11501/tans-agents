"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PROVIDERS } from "@/lib/providers"
import { cn } from "@/lib/utils"

export type AbModeState = {
  enabled: boolean
  modelA: string
  modelB: string
}

interface AbToggleProps {
  value: AbModeState
  onChange: (value: AbModeState) => void
  disabled?: boolean
  notice?: string
}

export function AbToggle({ value, onChange, disabled, notice }: AbToggleProps) {
  const effectiveEnabled = value.enabled && !disabled

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={effectiveEnabled ? "default" : "outline"}
          className="h-8 gap-2 rounded-full text-xs"
          onClick={() => onChange({ ...value, enabled: !value.enabled })}
          disabled={disabled}
        >
          🔀 So sánh A/B
        </Button>
        {notice && <span className="text-xs text-muted-foreground">{notice}</span>}
      </div>

      {value.enabled && !disabled && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="font-medium">🔀 Đang so sánh A/B</div>
            <button
              type="button"
              onClick={() => onChange({ ...value, enabled: false })}
              className="rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label="Tắt so sánh A/B"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ModelSelect
              label="Mô hình A"
              value={value.modelA}
              onChange={(modelA) => onChange({ ...value, modelA })}
            />
            <ModelSelect
              label="Mô hình B"
              value={value.modelB}
              onChange={(modelB) => onChange({ ...value, modelB })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ModelSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-9 w-full rounded-md border border-input bg-background px-3 py-1 font-mono text-xs text-foreground shadow-sm outline-none",
          "focus:ring-2 focus:ring-ring"
        )}
      >
        {Object.entries(PROVIDERS).map(([key, provider]) => (
          <optgroup key={key} label={provider.label}>
            {provider.models.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

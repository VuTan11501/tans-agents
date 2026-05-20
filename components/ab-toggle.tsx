"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModelPicker } from "@/components/model-picker"
import type { UserKeys } from "@/lib/user-keys"

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
  userKeys?: UserKeys
}

export function AbToggle({ value, onChange, disabled, notice, userKeys }: AbToggleProps) {
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ModelPicker
              label="Mô hình A"
              model={value.modelA}
              onChange={(_p, modelA) => onChange({ ...value, modelA })}
              userKeys={userKeys}
              align="start"
              triggerClassName="w-full justify-between"
            />
            <ModelPicker
              label="Mô hình B"
              model={value.modelB}
              onChange={(_p, modelB) => onChange({ ...value, modelB })}
              userKeys={userKeys}
              align="start"
              triggerClassName="w-full justify-between"
            />
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Check, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ACCENT_PRESETS, applyStoredDensity, clearAccent, getStoredAccent, getStoredDensity, saveAccent, saveDensity, type Density } from "@/lib/theme"
import { cn } from "@/lib/utils"

interface ThemeCustomizerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DENSITY_OPTIONS: Array<{ value: Density; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "cozy", label: "Cozy" },
  { value: "comfortable", label: "Comfortable" },
]

const SELF_CRITIQUE_KEY = "tans:self-critique"
const AUTO_COMPACT_KEY = "tans:auto-compact"

function readToggle(key: string) {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(key) === "true"
}

function installAiFeatureHeaders() {
  if (typeof window === "undefined") return
  const w = window as typeof window & { __tansAiFeatureFetchPatched?: boolean }
  if (w.__tansAiFeatureFetchPatched) return

  const originalFetch = window.fetch.bind(window)
  w.__tansAiFeatureFetchPatched = true
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" || input instanceof URL ? input.toString() : input.url
    const pathname = new URL(url, window.location.href).pathname
    if (pathname === "/api/chat" || pathname === "/api/chat-sse") {
      const headers = new Headers(input instanceof Request ? input.headers : undefined)
      new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
      if (readToggle(SELF_CRITIQUE_KEY)) headers.set("X-Self-Critique", "1")
      if (readToggle(AUTO_COMPACT_KEY)) headers.set("X-Auto-Compact", "1")
      return originalFetch(input, { ...init, headers })
    }
    return originalFetch(input, init)
  }
}

export function ThemeCustomizer({ open, onOpenChange }: ThemeCustomizerProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [custom, setCustom] = useState("262 83% 58%")
  const [density, setDensity] = useState<Density>("cozy")
  const [selfCritique, setSelfCritique] = useState(false)
  const [autoCompact, setAutoCompact] = useState(false)
  const isValid = /^\s*\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%\s*$/.test(custom)

  useEffect(() => {
    installAiFeatureHeaders()
    applyStoredDensity()
    setDensity(getStoredDensity())
    setSelfCritique(readToggle(SELF_CRITIQUE_KEY))
    setAutoCompact(readToggle(AUTO_COMPACT_KEY))
  }, [])

  useEffect(() => {
    if (!open) return
    const stored = getStoredAccent()
    setSelected(stored)
    setDensity(getStoredDensity())
    setSelfCritique(readToggle(SELF_CRITIQUE_KEY))
    setAutoCompact(readToggle(AUTO_COMPACT_KEY))
    if (stored) setCustom(stored)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onOpenChange])

  if (!open) return null

  function apply(hsl: string) {
    if (!saveAccent(hsl)) return
    setSelected(hsl)
    setCustom(hsl)
  }

  function applyInterfaceDensity(value: Density) {
    if (!saveDensity(value)) return
    setDensity(value)
  }

  function reset() {
    clearAccent()
    setSelected(null)
  }

  function setPersistentToggle(key: string, value: boolean, setter: (next: boolean) => void) {
    window.localStorage.setItem(key, String(value))
    setter(value)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-transparent"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="false"
        className="fixed right-2 top-16 z-[60] w-[min(20rem,calc(100vw-1rem))] rounded-xl border bg-popover p-4 text-popover-foreground shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2 duration-200 ease-out sm:right-4 sm:top-14 sm:w-72"
        data-state="open"
        onClick={(event) => event.stopPropagation()}
      >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Màu nhấn</h3>
          <p className="mt-1 text-xs text-muted-foreground">Chọn màu cho nút chính, viền focus và accent.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={reset}>
          <RotateCcw className="mr-1 h-3 w-3" /> Reset
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {ACCENT_PRESETS.map((preset) => {
          const active = selected === preset.hsl
          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => apply(preset.hsl)}
              className={cn(
                "flex h-9 items-center justify-center rounded-full border shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "ring-2 ring-ring ring-offset-2 ring-offset-background"
              )}
              style={{ backgroundColor: `hsl(${preset.hsl})` }}
              aria-label={preset.label}
              title={preset.label}
            >
              {active && <Check className="h-4 w-4 text-white drop-shadow" />}
            </button>
          )
        })}
      </div>

      <div className="mt-5 space-y-2" role="radiogroup" aria-label="Mật độ giao diện">
        <div className="text-xs font-medium">Mật độ giao diện</div>
        <div className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/30 p-1">
          {DENSITY_OPTIONS.map((option) => {
            const active = density === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => applyInterfaceDensity(option.value)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-background text-foreground shadow-sm"
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div>
          <div className="text-xs font-medium">Tính năng AI</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Bật/tắt các tối ưu server-side.</p>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
          <span>Tự đánh giá câu trả lời</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={selfCritique}
            onChange={(event) => setPersistentToggle(SELF_CRITIQUE_KEY, event.target.checked, setSelfCritique)}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
          <span>Tự nén context khi đầy</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={autoCompact}
            onChange={(event) => setPersistentToggle(AUTO_COMPACT_KEY, event.target.checked, setAutoCompact)}
          />
        </label>
      </div>

      <label className="mt-4 block space-y-2">
        <span className="text-xs font-medium">HSL tuỳ chỉnh</span>
        <div className="flex gap-2">
          <Input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="262 83% 58%" className="h-9 text-xs" />
          <Button type="button" size="sm" disabled={!isValid} onClick={() => apply(custom)}>
            Áp dụng
          </Button>
        </div>
      </label>
      <button className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline" type="button" onClick={() => onOpenChange(false)}>
        Đóng
      </button>
      </div>
    </>
  )
}
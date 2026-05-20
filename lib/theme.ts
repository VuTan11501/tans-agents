"use client"

export const ACCENT_STORAGE_KEY = "tans-agents:accent-color"
export const DENSITY_STORAGE_KEY = "tans:density"

export type Density = "compact" | "cozy" | "comfortable"

export interface AccentPreset {
  name: string
  label: string
  hsl: string
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { name: "blue", label: "Xanh dương", hsl: "221 83% 53%" },
  { name: "purple", label: "Tím", hsl: "262 83% 58%" },
  { name: "pink", label: "Hồng", hsl: "330 81% 60%" },
  { name: "red", label: "Đỏ", hsl: "0 84% 60%" },
  { name: "orange", label: "Cam", hsl: "24 95% 53%" },
  { name: "amber", label: "Hổ phách", hsl: "38 92% 50%" },
  { name: "green", label: "Xanh lá", hsl: "142 71% 45%" },
  { name: "teal", label: "Xanh teal", hsl: "173 80% 40%" },
  { name: "cyan", label: "Xanh cyan", hsl: "189 94% 43%" },
  { name: "indigo", label: "Chàm", hsl: "239 84% 67%" },
]

const HSL_PATTERN = /^\s*(\d+(?:\.\d+)?)\s+((?:\d+(?:\.\d+)?)%)\s+((?:\d+(?:\.\d+)?)%)\s*$/
const DENSITIES: Density[] = ["compact", "cozy", "comfortable"]

export function normalizeHsl(value: string): string | null {
  const match = value.match(HSL_PATTERN)
  if (!match) return null
  const hue = Math.min(360, Math.max(0, Number(match[1])))
  return `${Math.round(hue)} ${match[2]} ${match[3]}`
}

export function normalizeDensity(value: unknown): Density {
  return typeof value === "string" && DENSITIES.includes(value as Density) ? (value as Density) : "cozy"
}

export function getStoredAccent(): string | null {
  if (typeof window === "undefined") return null
  return normalizeHsl(window.localStorage.getItem(ACCENT_STORAGE_KEY) ?? "")
}

export function getStoredDensity(): Density {
  if (typeof window === "undefined") return "cozy"
  return normalizeDensity(window.localStorage.getItem(DENSITY_STORAGE_KEY))
}

export function saveAccent(hsl: string) {
  const normalized = normalizeHsl(hsl)
  if (!normalized || typeof window === "undefined") return false
  window.localStorage.setItem(ACCENT_STORAGE_KEY, normalized)
  applyAccent(normalized)
  return true
}

export function saveDensity(density: Density) {
  if (typeof window === "undefined") return false
  const normalized = normalizeDensity(density)
  window.localStorage.setItem(DENSITY_STORAGE_KEY, normalized)
  applyDensity(normalized)
  return true
}

export function clearAccent() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(ACCENT_STORAGE_KEY)
  const root = window.document.documentElement
  root.style.removeProperty("--primary")
  root.style.removeProperty("--accent")
  root.style.removeProperty("--ring")
}

export function applyStoredAccent() {
  const hsl = getStoredAccent()
  if (hsl) applyAccent(hsl)
}

export function applyStoredDensity() {
  applyDensity(getStoredDensity())
}

export function applyAccent(hsl: string) {
  if (typeof window === "undefined") return
  const normalized = normalizeHsl(hsl)
  if (!normalized) return

  const root = window.document.documentElement
  root.style.setProperty("--primary", normalized)
  root.style.setProperty("--ring", normalized)
  root.style.setProperty("--accent", softenAccent(normalized, root.classList.contains("dark")))
}

export function applyDensity(density: Density) {
  if (typeof window === "undefined") return
  window.document.documentElement.dataset.density = normalizeDensity(density)
}

function softenAccent(hsl: string, isDark: boolean): string {
  const match = hsl.match(HSL_PATTERN)
  if (!match) return hsl
  const hue = match[1]
  const saturation = match[2]
  return `${hue} ${saturation} ${isDark ? "18%" : "94%"}`
}
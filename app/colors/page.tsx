"use client"

import { useMemo, useState } from "react"

type Rgb = { r: number; g: number; b: number }
type Hsl = { h: number; s: number; l: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function componentToHex(value: number) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")
}

function normalizeHex(value: string) {
  const cleaned = value.trim().replace(/^#/, "")
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return `#${cleaned.split("").map((char) => char + char).join("")}`.toUpperCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned}`.toUpperCase()
  return null
}

function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex) ?? "#000000"
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  }
}

function rgbToHex({ r, g, b }: Rgb) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`.toUpperCase()
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
    if (max === gn) h = (bn - rn) / d + 2
    if (max === bn) h = (rn - gn) / d + 4
    h /= 6
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hn = (((h % 360) + 360) % 360) / 360
  const sn = clamp(s, 0, 100) / 100
  const ln = clamp(l, 0, 100) / 100

  if (sn === 0) {
    const gray = ln * 255
    return { r: gray, g: gray, b: gray }
  }

  const hueToRgb = (p: number, q: number, tValue: number) => {
    let t = tValue
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn
  const p = 2 * ln - q
  return {
    r: hueToRgb(p, q, hn + 1 / 3) * 255,
    g: hueToRgb(p, q, hn) * 255,
    b: hueToRgb(p, q, hn - 1 / 3) * 255,
  }
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex)
  const channels = [r, g, b].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(foreground: string, background: string) {
  const l1 = relativeLuminance(foreground)
  const l2 = relativeLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text)
}

function NumberInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
      />
    </label>
  )
}

export default function ColorsPage() {
  const [hex, setHex] = useState("#3B82F6")
  const [hexDraft, setHexDraft] = useState("#3B82F6")
  const [foreground, setForeground] = useState("#111827")
  const [background, setBackground] = useState("#FFFFFF")

  const rgb = useMemo(() => hexToRgb(hex), [hex])
  const hsl = useMemo(() => rgbToHsl(rgb), [rgb])
  const palette = useMemo(() => {
    return Array.from({ length: 11 }, (_, index) => {
      const step = index - 5
      const shade = rgbToHex(hslToRgb({ ...hsl, l: clamp(hsl.l + step * 8, 0, 100) }))
      return { label: step === 0 ? "Gốc" : step < 0 ? `Tối ${Math.abs(step)}` : `Sáng ${step}`, hex: shade }
    })
  }, [hsl])
  const ratio = useMemo(() => contrastRatio(foreground, background), [foreground, background])

  const updateHex = (value: string) => {
    const normalized = normalizeHex(value)
    setHexDraft(value)
    if (normalized) {
      setHex(normalized)
      setHexDraft(normalized)
    }
  }

  const setFromRgb = (next: Partial<Rgb>) => {
    const nextHex = rgbToHex({ ...rgb, ...next })
    setHex(nextHex)
    setHexDraft(nextHex)
  }

  const setFromHsl = (next: Partial<Hsl>) => {
    const nextHex = rgbToHex(hslToRgb({ ...hsl, ...next }))
    setHex(nextHex)
    setHexDraft(nextHex)
  }

  const randomize = () => {
    const nextHex = rgbToHex({ r: Math.random() * 255, g: Math.random() * 255, b: Math.random() * 255 })
    setHex(nextHex)
    setHexDraft(nextHex)
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">Công cụ màu sắc</p>
        <h1 className="text-3xl font-semibold tracking-tight">Bảng màu & kiểm tra tương phản</h1>
        <p className="text-sm text-muted-foreground">Chọn màu, đồng bộ HEX/RGB/HSL, tạo palette và kiểm tra WCAG.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="space-y-3">
              <div className="h-48 rounded-lg border shadow-inner" style={{ backgroundColor: hex }} aria-label="Màu xem trước" />
              <div className="flex gap-2">
                <input type="color" value={hex} onChange={(event) => updateHex(event.target.value)} className="h-10 w-16 rounded-md border bg-background p-1" aria-label="Chọn màu" />
                <button type="button" onClick={randomize} className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
                  Màu ngẫu nhiên
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">HEX</span>
                <input value={hexDraft} onChange={(event) => updateHex(event.target.value)} className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring" />
              </label>

              <div className="grid grid-cols-3 gap-3">
                <NumberInput label="R" value={rgb.r} min={0} max={255} onChange={(value) => setFromRgb({ r: clamp(value, 0, 255) })} />
                <NumberInput label="G" value={rgb.g} min={0} max={255} onChange={(value) => setFromRgb({ g: clamp(value, 0, 255) })} />
                <NumberInput label="B" value={rgb.b} min={0} max={255} onChange={(value) => setFromRgb({ b: clamp(value, 0, 255) })} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <NumberInput label="H°" value={hsl.h} min={0} max={360} onChange={(value) => setFromHsl({ h: clamp(value, 0, 360) })} />
                <NumberInput label="S%" value={hsl.s} min={0} max={100} onChange={(value) => setFromHsl({ s: clamp(value, 0, 100) })} />
                <NumberInput label="L%" value={hsl.l} min={0} max={100} onChange={(value) => setFromHsl({ l: clamp(value, 0, 100) })} />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Kiểm tra tương phản</h2>
          <p className="mt-1 text-sm text-muted-foreground">Chọn màu chữ và nền để xem chuẩn WCAG.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Màu chữ</span>
              <input type="color" value={foreground} onChange={(event) => setForeground(event.target.value.toUpperCase())} className="h-10 w-full rounded-md border bg-background p-1" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Màu nền</span>
              <input type="color" value={background} onChange={(event) => setBackground(event.target.value.toUpperCase())} className="h-10 w-full rounded-md border bg-background p-1" />
            </label>
          </div>
          <div className="mt-4 rounded-lg border p-4" style={{ color: foreground, backgroundColor: background }}>
            Văn bản mẫu Aa 123
          </div>
          <div className="mt-4 rounded-lg bg-muted p-4">
            <div className="text-3xl font-semibold">{ratio.toFixed(2)}:1</div>
            <div className="mt-2 grid gap-2 text-sm">
              <span className={ratio >= 4.5 ? "text-emerald-600" : "text-destructive"}>AA chữ thường: {ratio >= 4.5 ? "Đạt" : "Không đạt"}</span>
              <span className={ratio >= 7 ? "text-emerald-600" : "text-destructive"}>AAA chữ thường: {ratio >= 7 ? "Đạt" : "Không đạt"}</span>
              <span className={ratio >= 3 ? "text-emerald-600" : "text-destructive"}>AA chữ lớn: {ratio >= 3 ? "Đạt" : "Không đạt"}</span>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Palette tự động</h2>
            <p className="text-sm text-muted-foreground">5 sắc độ tối hơn, màu gốc và 5 sắc độ sáng hơn. Bấm để copy HEX.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-11">
          {palette.map((shade) => (
            <button key={`${shade.label}-${shade.hex}`} type="button" onClick={() => copyText(shade.hex)} className="overflow-hidden rounded-lg border bg-background text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" title="Bấm để sao chép HEX">
              <div className="h-20" style={{ backgroundColor: shade.hex }} />
              <div className="space-y-1 p-3">
                <div className="text-xs font-medium text-muted-foreground">{shade.label}</div>
                <div className="font-mono text-sm font-semibold">{shade.hex}</div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

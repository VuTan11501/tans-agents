"use client"

import { useEffect, useMemo, useState } from "react"

const TIME_ZONES = ["JST", "UTC", "Local", "America/New_York", "Europe/London", "Asia/Singapore"] as const
const TZ_MAP: Record<string, string> = {
  JST: "Asia/Tokyo",
  UTC: "UTC",
  Local: "",
  America_New_York: "America/New_York",
  Europe_London: "Europe/London",
  Asia_Singapore: "Asia/Singapore",
}

function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function resolveTimeZone(value: string) {
  if (value === "Local") return localTimeZone()
  return TZ_MAP[value.replaceAll("/", "_")] ?? value
}

function formatDateTime(date: Date, timeZoneLabel: string) {
  const timeZone = resolveTimeZone(timeZoneLabel)
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date)
}

function formatForInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatParts(date: Date, timeZoneLabel: string) {
  const timeZone = resolveTimeZone(timeZoneLabel)
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
  const parts = formatter.formatToParts(date)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") }
}

function offsetMs(timeZoneLabel: string, timestampMs: number) {
  const parts = formatParts(new Date(timestampMs), timeZoneLabel)
  const utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return utcMs - timestampMs
}

function zonedInputToDate(value: string, timeZoneLabel: string) {
  if (!value) return null
  const [datePart, timePart] = value.split("T")
  if (!datePart || !timePart) return null
  const [year, month, day] = datePart.split("-").map(Number)
  const [hour, minute] = timePart.split(":").map(Number)
  if ([year, month, day, hour, minute].some((part) => Number.isNaN(part))) return null
  const wallUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  const first = wallUtc - offsetMs(timeZoneLabel, wallUtc)
  const refined = wallUtc - offsetMs(timeZoneLabel, first)
  return new Date(refined)
}

function epochToDate(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  const ms = Math.abs(parsed) < 1_000_000_000_000 ? parsed * 1000 : parsed
  return new Date(ms)
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text)
}

function CopyButton({ value }: { value: string }) {
  return (
    <button type="button" onClick={() => copyText(value)} className="rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-muted">
      Sao chép
    </button>
  )
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-background p-3">
      <div>
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 break-all font-mono text-sm">{value}</div>
      </div>
      <CopyButton value={value} />
    </div>
  )
}

export default function TimePage() {
  const [now, setNow] = useState<Date | null>(null)
  const [epochInput, setEpochInput] = useState("")
  const [dateInput, setDateInput] = useState("")
  const [converterInput, setConverterInput] = useState("")
  const [clientTz, setClientTz] = useState("Local")
  const [fromTz, setFromTz] = useState<(typeof TIME_ZONES)[number]>("JST")
  const [toTz, setToTz] = useState<(typeof TIME_ZONES)[number]>("UTC")

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = window.setInterval(tick, 1000)
    setClientTz(localTimeZone())
    setDateInput(formatForInput(new Date()))
    setConverterInput(formatForInput(new Date()))
    return () => window.clearInterval(id)
  }, [])

  const epochDate = useMemo(() => epochToDate(epochInput), [epochInput])
  const dateEpoch = useMemo(() => {
    if (!dateInput) return null
    const date = new Date(dateInput)
    return Number.isNaN(date.getTime()) ? null : date
  }, [dateInput])
  const convertedDate = useMemo(() => zonedInputToDate(converterInput, fromTz), [converterInput, fromTz])

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">Công cụ thời gian</p>
        <h1 className="text-3xl font-semibold tracking-tight">Đổi múi giờ & Epoch</h1>
        <p className="text-sm text-muted-foreground">Hiển thị thời gian live, chuyển epoch, date-time và múi giờ bằng Intl.DateTimeFormat.</p>
      </header>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Thời gian hiện tại</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ResultRow label="JST" value={now ? formatDateTime(now, "JST") : "Đang tải..."} />
          <ResultRow label="UTC" value={now ? formatDateTime(now, "UTC") : "Đang tải..."} />
          <ResultRow label={`Local (${clientTz})`} value={now ? formatDateTime(now, "Local") : "Đang tải..."} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Epoch → thời gian</h2>
          <p className="mt-1 text-sm text-muted-foreground">Nhập giây hoặc mili-giây, hệ thống tự nhận diện.</p>
          <input
            value={epochInput}
            onChange={(event) => setEpochInput(event.target.value)}
            placeholder="vd: 1735689600 hoặc 1735689600000"
            className="mt-4 w-full rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
          />
          <div className="mt-4 space-y-3">
            {epochDate ? (
              <>
                <ResultRow label="JST" value={formatDateTime(epochDate, "JST")} />
                <ResultRow label="UTC" value={formatDateTime(epochDate, "UTC")} />
                <ResultRow label={`Local (${clientTz})`} value={formatDateTime(epochDate, "Local")} />
              </>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Chưa có epoch hợp lệ.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-lg font-semibold">Date-time → epoch</h2>
          <p className="mt-1 text-sm text-muted-foreground">Giá trị nhập theo múi giờ local của trình duyệt.</p>
          <input
            type="datetime-local"
            value={dateInput}
            onChange={(event) => setDateInput(event.target.value)}
            className="mt-4 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
          />
          <div className="mt-4 space-y-3">
            {dateEpoch ? (
              <>
                <ResultRow label="Epoch giây" value={String(Math.floor(dateEpoch.getTime() / 1000))} />
                <ResultRow label="Epoch mili-giây" value={String(dateEpoch.getTime())} />
                <ResultRow label="UTC" value={formatDateTime(dateEpoch, "UTC")} />
              </>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Chọn ngày giờ để chuyển đổi.</p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Chuyển đổi múi giờ</h2>
        <p className="mt-1 text-sm text-muted-foreground">Chọn múi giờ nguồn và đích, nhập thời gian theo múi giờ nguồn.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Thời gian nguồn</span>
            <input
              type="datetime-local"
              value={converterInput}
              onChange={(event) => setConverterInput(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Từ múi giờ</span>
            <select value={fromTz} onChange={(event) => setFromTz(event.target.value as (typeof TIME_ZONES)[number])} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring">
              {TIME_ZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Sang múi giờ</span>
            <select value={toTz} onChange={(event) => setToTz(event.target.value as (typeof TIME_ZONES)[number])} className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring">
              {TIME_ZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {convertedDate ? (
            <>
              <ResultRow label={`Nguồn (${fromTz})`} value={formatDateTime(convertedDate, fromTz)} />
              <ResultRow label={`Đích (${toTz})`} value={formatDateTime(convertedDate, toTz)} />
              <ResultRow label="Epoch giây" value={String(Math.floor(convertedDate.getTime() / 1000))} />
              <ResultRow label="Epoch mili-giây" value={String(convertedDate.getTime())} />
            </>
          ) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground md:col-span-2">Nhập thời gian hợp lệ để chuyển đổi.</p>
          )}
        </div>
      </section>
    </main>
  )
}

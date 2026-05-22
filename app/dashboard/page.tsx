"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useChatHistory, type ChatSession } from "@/hooks/use-chat-history"
import { getUsage, USAGE_LOG_STORAGE_KEY, type UsageEntry } from "@/lib/usage-log"
import { listFavorites } from "@/lib/favorites"
import { listPinned, type PinnedMessage } from "@/lib/pinned-messages"
import { listSessionsWithNotes } from "@/lib/session-notes"

const RANGE_OPTIONS = [7, 30, 90] as const
const DAY_MS = 24 * 60 * 60 * 1000
const PROVIDER_PALETTE = [
  { text: "text-blue-500", bg: "bg-blue-500", fill: "fill-blue-500", stroke: "stroke-blue-500" },
  { text: "text-emerald-500", bg: "bg-emerald-500", fill: "fill-emerald-500", stroke: "stroke-emerald-500" },
  { text: "text-violet-500", bg: "bg-violet-500", fill: "fill-violet-500", stroke: "stroke-violet-500" },
  { text: "text-amber-500", bg: "bg-amber-500", fill: "fill-amber-500", stroke: "stroke-amber-500" },
  { text: "text-pink-500", bg: "bg-pink-500", fill: "fill-pink-500", stroke: "stroke-pink-500" },
  { text: "text-cyan-500", bg: "bg-cyan-500", fill: "fill-cyan-500", stroke: "stroke-cyan-500" },
  { text: "text-orange-500", bg: "bg-orange-500", fill: "fill-orange-500", stroke: "stroke-orange-500" },
  { text: "text-rose-500", bg: "bg-rose-500", fill: "fill-rose-500", stroke: "stroke-rose-500" },
]

type RangeDays = (typeof RANGE_OPTIONS)[number]
type DayBucket = { key: string; label: string; count: number }
type ProviderRow = { provider: string; tokens: number; colorIndex: number }
type ModelRow = { model: string; count: number; colorIndex: number }
type HeatmapCell = { key: string; label: string; count: number; week: number; day: number }

export default function DashboardPage() {
  const { sessions } = useChatHistory()
  const [rangeDays, setRangeDays] = useState<RangeDays>(30)
  const [usage, setUsage] = useState<UsageEntry[]>([])
  const [rawSessionsV3, setRawSessionsV3] = useState<ChatSession[]>([])
  const [pinned, setPinned] = useState<PinnedMessage[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [noteSessionIds, setNoteSessionIds] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setUsage(readUsageEntries())
    setRawSessionsV3(readSessionsV3())
    setPinned(listPinned())
    setFavorites(listFavorites())
    setNoteSessionIds(new Set(listSessionsWithNotes().map((item) => item.sessionId)))
    setLoaded(true)
  }, [refreshKey])

  const effectiveSessions = sessions.length > 0 ? sessions : rawSessionsV3

  const filteredUsage = useMemo(() => {
    const from = startOfToday(Date.now()) - (rangeDays - 1) * DAY_MS
    return usage.filter((entry) => entry.ts >= from)
  }, [rangeDays, usage])

  const totalMessages = useMemo(
    () => effectiveSessions.reduce((sum, session) => sum + (Array.isArray(session.messages) ? session.messages.length : 0), 0),
    [effectiveSessions]
  )
  const totalTokens = useMemo(
    () => filteredUsage.reduce((sum, entry) => sum + safeNumber(entry.inputTokens) + safeNumber(entry.outputTokens), 0),
    [filteredUsage]
  )
  const providerCount = useMemo(
    () => new Set(filteredUsage.map((entry) => entry.provider).filter(Boolean)).size,
    [filteredUsage]
  )

  const messagesByDay = useMemo(() => bucketUsageByDay(filteredUsage, rangeDays), [filteredUsage, rangeDays])
  const tokensByProvider = useMemo(() => aggregateTokensByProvider(filteredUsage), [filteredUsage])
  const modelUsage = useMemo(() => aggregateModels(filteredUsage), [filteredUsage])
  const heatmapCells = useMemo(() => buildHeatmap(filteredUsage), [filteredUsage])
  const recentSessions = useMemo(
    () => [...effectiveSessions].sort((a, b) => safeNumber(b.updatedAt) - safeNumber(a.updatedAt)).slice(0, 12),
    [effectiveSessions]
  )

  const pinnedSessionIds = useMemo(() => new Set(pinned.map((item) => item.sessionId)), [pinned])
  const favoriteSessionIds = useMemo(() => new Set(favorites), [favorites])

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              ← Quay lại
            </Link>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Bảng điều khiển sử dụng</h1>
              <p className="text-sm text-muted-foreground">Phân tích localStorage trên trình duyệt này.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border bg-background p-1">
              {RANGE_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRangeDays(days)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    rangeDays === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {days} ngày
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => setRefreshKey((key) => key + 1)}>
              Làm mới
            </Button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Tổng tin nhắn" value={formatNumber(totalMessages)} hint="Trong tất cả phiên" />
          <KpiCard label="Tổng tokens" value={formatNumber(totalTokens)} hint={`${rangeDays} ngày gần đây`} />
          <KpiCard label="Số phiên" value={formatNumber(effectiveSessions.length)} hint="Đã lưu trong lịch sử" />
          <KpiCard label="Provider đã dùng" value={formatNumber(providerCount)} hint={`${rangeDays} ngày gần đây`} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Tin nhắn theo thời gian</CardTitle>
            </CardHeader>
            <CardContent>
              <MessagesLineChart data={messagesByDay} rangeDays={rangeDays} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tokens theo provider</CardTitle>
            </CardHeader>
            <CardContent>
              <ProviderBarChart data={tokensByProvider} />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <CardHeader>
              <CardTitle>Model sử dụng</CardTitle>
            </CardHeader>
            <CardContent>
              <ModelDonutChart data={modelUsage} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Heatmap hoạt động</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityHeatmap cells={heatmapCells} />
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Phiên gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentSessionsTable
              loaded={loaded}
              sessions={recentSessions}
              pinnedSessionIds={pinnedSessionIds}
              favoriteSessionIds={favoriteSessionIds}
              noteSessionIds={noteSessionIds}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function MessagesLineChart({ data, rangeDays }: { data: DayBucket[]; rangeDays: number }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const width = 760
  const height = 300
  const padding = { top: 24, right: 24, bottom: 42, left: 46 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const max = Math.max(1, ...data.map((item) => item.count))
  const points = data.map((item, index) => {
    const x = padding.left + (data.length === 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth)
    const y = padding.top + chartHeight - (item.count / max) * chartHeight
    return { ...item, x, y }
  })
  const linePath = smoothPath(points)
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`
    : ""
  const active = hoverIndex === null ? null : points[hoverIndex]

  if (data.every((item) => item.count === 0)) {
    return <EmptyState label="Chưa có usage log để vẽ biểu đồ đường." />
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Tin nhắn trong ${rangeDays} ngày gần đây`} className="h-[300px] w-full text-blue-500">
        <defs>
          <linearGradient id="messagesLineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + chartHeight * ratio
          const value = Math.round(max * (1 - ratio))
          return (
            <g key={ratio}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} className="stroke-muted-foreground" opacity="0.14" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
                {value}
              </text>
            </g>
          )
        })}
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} className="stroke-muted-foreground" opacity="0.25" />
        <path d={areaPath} fill="url(#messagesLineFill)" />
        <path d={linePath} fill="none" className="stroke-blue-500" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) =>
          index % Math.max(1, Math.ceil(rangeDays / 6)) === 0 || index === points.length - 1 ? (
            <text key={point.key} x={point.x} y={height - 14} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {point.label}
            </text>
          ) : null
        )}
        {points.map((point, index) => (
          <rect
            key={`hit-${point.key}`}
            x={padding.left + index * (chartWidth / data.length)}
            y={padding.top}
            width={chartWidth / data.length}
            height={chartHeight}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex(null)}
          />
        ))}
        {active ? (
          <g>
            <line x1={active.x} y1={padding.top} x2={active.x} y2={height - padding.bottom} className="stroke-blue-500" strokeDasharray="4 4" opacity="0.45" />
            <circle cx={active.x} cy={active.y} r="5" className="fill-blue-500 stroke-background" strokeWidth="3" />
            <g transform={`translate(${Math.min(width - 152, Math.max(54, active.x - 66))} ${Math.max(8, active.y - 54)})`}>
              <rect width="132" height="42" rx="10" className="fill-card stroke-border" />
              <text x="12" y="17" className="fill-muted-foreground text-[11px]">{active.label}</text>
              <text x="12" y="33" className="fill-foreground text-[13px] font-semibold">{active.count} tin nhắn</text>
            </g>
          </g>
        ) : null}
      </svg>
    </div>
  )
}

function ProviderBarChart({ data }: { data: ProviderRow[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const width = 520
  const rowHeight = 44
  const height = Math.max(180, data.length * rowHeight + 32)
  const labelWidth = 124
  const valueWidth = 88
  const barMaxWidth = width - labelWidth - valueWidth - 36
  const max = Math.max(1, ...data.map((item) => item.tokens))

  if (data.length === 0) return <EmptyState label="Chưa có token nào theo provider." />

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tokens theo provider" className="w-full">
      {data.map((item, index) => {
        const palette = PROVIDER_PALETTE[item.colorIndex % PROVIDER_PALETTE.length]
        const y = 22 + index * rowHeight
        const barWidth = Math.max(3, (item.tokens / max) * barMaxWidth)
        const active = hoverIndex === index
        return (
          <g key={item.provider} onMouseEnter={() => setHoverIndex(index)} onMouseLeave={() => setHoverIndex(null)}>
            <text x="0" y={y + 16} className="fill-foreground text-[12px] font-medium">
              {truncate(item.provider, 17)}
            </text>
            <rect x={labelWidth} y={y} width={barMaxWidth} height="22" rx="11" className="fill-muted" />
            <rect x={labelWidth} y={y} width={barWidth} height="22" rx="11" className={palette.fill} opacity={active ? 1 : 0.82} />
            <text x={width - 4} y={y + 16} textAnchor="end" className="fill-muted-foreground text-[12px] tabular-nums">
              {formatNumber(item.tokens)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function ModelDonutChart({ data }: { data: ModelRow[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const radius = 78
  const innerRadius = 48
  const center = 110
  let startAngle = -90

  if (data.length === 0 || total === 0) return <EmptyState label="Chưa có dữ liệu model." />

  return (
    <div className="grid gap-5 md:grid-cols-[240px_1fr] md:items-center">
      <svg viewBox="0 0 220 220" role="img" aria-label="Tỉ lệ sử dụng model" className="h-60 w-60">
        <circle cx={center} cy={center} r={radius} className="fill-muted" opacity="0.28" />
        {data.map((item, index) => {
          const angle = (item.count / total) * 360
          const endAngle = startAngle + angle
          const palette = PROVIDER_PALETTE[item.colorIndex % PROVIDER_PALETTE.length]
          const path = donutSlicePath(center, center, radius, innerRadius, startAngle, endAngle)
          const midAngle = startAngle + angle / 2
          const label = polarPoint(center, center, radius + 20, midAngle)
          const pct = Math.round((item.count / total) * 100)
          const slice = (
            <g key={item.model} onMouseEnter={() => setHoverIndex(index)} onMouseLeave={() => setHoverIndex(null)}>
              <path d={path} className={palette.fill} opacity={hoverIndex === null || hoverIndex === index ? 0.92 : 0.42} />
              {pct >= 7 ? (
                <text x={label.x} y={label.y + 4} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">
                  {pct}%
                </text>
              ) : null}
            </g>
          )
          startAngle = endAngle
          return slice
        })}
        <circle cx={center} cy={center} r={innerRadius - 2} className="fill-card" />
        <text x={center} y={center - 2} textAnchor="middle" className="fill-foreground text-3xl font-semibold">
          {total}
        </text>
        <text x={center} y={center + 20} textAnchor="middle" className="fill-muted-foreground text-xs">
          lượt dùng
        </text>
      </svg>
      <div className="grid gap-2">
        {data.map((item) => {
          const palette = PROVIDER_PALETTE[item.colorIndex % PROVIDER_PALETTE.length]
          return (
            <div key={item.model} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-3 w-3 shrink-0 rounded-full ${palette.bg}`} />
                <span className="truncate font-mono text-xs">{item.model}</span>
              </span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {item.count} · {Math.round((item.count / total) * 100)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActivityHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const [active, setActive] = useState<HeatmapCell | null>(null)
  const max = Math.max(1, ...cells.map((cell) => cell.count))
  const cellSize = 15
  const gap = 5
  const leftPad = 28
  const topPad = 12
  const width = leftPad + 12 * (cellSize + gap) + 10
  const height = topPad + 7 * (cellSize + gap) + 26
  const hasData = cells.some((cell) => cell.count > 0)

  if (!hasData) return <EmptyState label="Chưa có hoạt động trong 12 tuần gần đây." />

  return (
    <div className="relative overflow-x-auto pb-2">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Heatmap hoạt động 12 tuần" className="min-w-[320px] text-emerald-500">
        {["T2", "T4", "T6"].map((label, index) => (
          <text key={label} x="0" y={topPad + (index * 2 + 1) * (cellSize + gap) + 11} className="fill-muted-foreground text-[10px]">
            {label}
          </text>
        ))}
        {cells.map((cell) => {
          const intensity = cell.count === 0 ? 0 : Math.max(0.22, cell.count / max)
          return (
            <rect
              key={cell.key}
              x={leftPad + cell.week * (cellSize + gap)}
              y={topPad + cell.day * (cellSize + gap)}
              width={cellSize}
              height={cellSize}
              rx="4"
              className={cell.count === 0 ? "fill-muted" : "fill-emerald-500"}
              opacity={cell.count === 0 ? 0.55 : intensity}
              onMouseEnter={() => setActive(cell)}
              onMouseLeave={() => setActive(null)}
            />
          )
        })}
        <text x={leftPad} y={height - 4} className="fill-muted-foreground text-[10px]">
          Ít
        </text>
        {[0.25, 0.5, 0.75, 1].map((opacity, index) => (
          <rect key={opacity} x={leftPad + 22 + index * 18} y={height - 15} width="12" height="12" rx="3" className="fill-emerald-500" opacity={opacity} />
        ))}
        <text x={leftPad + 100} y={height - 4} className="fill-muted-foreground text-[10px]">
          Nhiều
        </text>
      </svg>
      {active ? (
        <div className="pointer-events-none absolute right-2 top-2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm">
          <div className="font-medium text-foreground">{active.label}</div>
          <div className="text-muted-foreground">{active.count} tin nhắn</div>
        </div>
      ) : null}
    </div>
  )
}

function RecentSessionsTable({
  loaded,
  sessions,
  pinnedSessionIds,
  favoriteSessionIds,
  noteSessionIds,
}: {
  loaded: boolean
  sessions: ChatSession[]
  pinnedSessionIds: Set<string>
  favoriteSessionIds: Set<string>
  noteSessionIds: Set<string>
}) {
  if (loaded && sessions.length === 0) return <EmptyState label="Chưa có phiên chat nào." />

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Tiêu đề</th>
            <th className="px-3 py-2 text-right font-medium">Tin nhắn</th>
            <th className="px-3 py-2 font-medium">Model</th>
            <th className="px-3 py-2 font-medium">Cập nhật</th>
            <th className="px-3 py-2 text-right font-medium">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => {
            const indicators = [
              pinnedSessionIds.has(session.id) ? "📌" : "",
              favoriteSessionIds.has(session.id) ? "⭐" : "",
              noteSessionIds.has(session.id) ? "📝" : "",
            ].filter(Boolean)
            return (
              <tr key={session.id} className="border-t">
                <td className="max-w-[320px] px-3 py-2">
                  <div className="truncate font-medium">{session.title || "Cuộc trò chuyện mới"}</div>
                  <div className="truncate text-xs text-muted-foreground">{session.id}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(session.messages?.length ?? 0)}</td>
                <td className="px-3 py-2">
                  <div className="font-mono text-xs">{session.model || "—"}</div>
                  <div className="text-xs text-muted-foreground">{session.provider || "Không rõ provider"}</div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{formatDateTime(session.updatedAt)}</td>
                <td className="px-3 py-2 text-right text-base">{indicators.length ? indicators.join(" ") : "—"}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">{label}</div>
}

function readUsageEntries(): UsageEntry[] {
  const fromLib = getUsage()
  if (typeof window === "undefined") return fromLib
  try {
    const raw = window.localStorage.getItem(USAGE_LOG_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return fromLib
    const normalized = parsed.map(normalizeUsageEntry).filter((entry): entry is UsageEntry => Boolean(entry))
    return normalized.length > fromLib.length ? normalized : fromLib
  } catch {
    return fromLib
  }
}

function normalizeUsageEntry(value: unknown): UsageEntry | null {
  if (!value || typeof value !== "object") return null
  const entry = value as Partial<UsageEntry>
  if (typeof entry.ts !== "number" || typeof entry.provider !== "string" || typeof entry.model !== "string") return null
  return {
    ts: entry.ts,
    provider: entry.provider || "Không rõ",
    model: entry.model || "Không rõ",
    inputTokens: safeNumber(entry.inputTokens),
    outputTokens: safeNumber(entry.outputTokens),
    costUsd: safeNumber(entry.costUsd),
  }
}

function readSessionsV3(): ChatSession[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem("tans-agents:chat-sessions-v3")
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isChatSessionLike) : []
  } catch {
    return []
  }
}

function isChatSessionLike(value: unknown): value is ChatSession {
  if (!value || typeof value !== "object") return false
  const session = value as Partial<ChatSession>
  return typeof session.id === "string" && Array.isArray(session.messages)
}

function bucketUsageByDay(entries: UsageEntry[], days: number): DayBucket[] {
  const today = startOfToday(Date.now())
  const buckets = new Map<string, DayBucket>()
  const output = Array.from({ length: days }, (_, index) => {
    const time = today - (days - 1 - index) * DAY_MS
    const key = dateKey(time)
    const bucket = { key, label: formatShortDate(time), count: 0 }
    buckets.set(key, bucket)
    return bucket
  })
  for (const entry of entries) {
    const bucket = buckets.get(dateKey(entry.ts))
    if (bucket) bucket.count += 1
  }
  return output
}

function aggregateTokensByProvider(entries: UsageEntry[]): ProviderRow[] {
  const map = new Map<string, number>()
  for (const entry of entries) {
    const provider = entry.provider || "Không rõ"
    map.set(provider, (map.get(provider) ?? 0) + safeNumber(entry.inputTokens) + safeNumber(entry.outputTokens))
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([provider, tokens], index) => ({ provider, tokens, colorIndex: index }))
}

function aggregateModels(entries: UsageEntry[]): ModelRow[] {
  const map = new Map<string, number>()
  for (const entry of entries) {
    const model = entry.model || "Không rõ"
    map.set(model, (map.get(model) ?? 0) + 1)
  }
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1])
  const top = rows.slice(0, 8).map(([model, count], index) => ({ model, count, colorIndex: index }))
  const otherCount = rows.slice(8).reduce((sum, [, count]) => sum + count, 0)
  if (otherCount > 0) top.push({ model: "Khác", count: otherCount, colorIndex: top.length })
  return top
}

function buildHeatmap(entries: UsageEntry[]): HeatmapCell[] {
  const today = startOfToday(Date.now())
  const end = today + DAY_MS
  const start = end - 12 * 7 * DAY_MS
  const counts = new Map<string, number>()
  for (const entry of entries) {
    if (entry.ts < start || entry.ts >= end) continue
    const key = dateKey(entry.ts)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from({ length: 12 * 7 }, (_, index) => {
    const week = Math.floor(index / 7)
    const day = index % 7
    const time = start + index * DAY_MS
    const key = dateKey(time)
    return { key, label: formatFullDate(time), count: counts.get(key) ?? 0, week, day }
  })
}

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ""
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    const midX = (previous.x + point.x) / 2
    return `${path} C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`
  }, "")
}

function donutSlicePath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  const outerStart = polarPoint(cx, cy, outerR, startAngle)
  const outerEnd = polarPoint(cx, cy, outerR, endAngle)
  const innerStart = polarPoint(cx, cy, innerR, startAngle)
  const innerEnd = polarPoint(cx, cy, innerR, endAngle)
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ")
}

function polarPoint(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  const rad = (angle * Math.PI) / 180
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
}

function startOfToday(now: number): number {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function dateKey(time: number): string {
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatShortDate(time: number): string {
  return new Date(time).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
}

function formatFullDate(time: number): string {
  return new Date(time).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDateTime(time?: number): string {
  if (!time) return "—"
  return new Date(time).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("vi-VN")
}

function safeNumber(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

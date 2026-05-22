"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { CostTrackerCard } from "@/components/cost-tracker-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { clearEvents, getEvents, type Event } from "@/lib/analytics"
import { clearUsage, getUsage } from "@/lib/usage-log"
import { getTtftSamples, summarizeByProvider, clearTtft, type ProviderTtftStats } from "@/lib/latency-tracker"
import { getWinners, modelLeaderboard, clearWinners, type AbWinnerRow, type ModelWinrate } from "@/lib/ab-winner"

const BAR_DAYS = 7
const DONUT_COLORS = ["#8b5cf6", "#06b6d4", "#f97316", "#22c55e", "#ec4899", "#eab308"]

export default function StatsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [loaded, setLoaded] = useState(false)
  const [ttftStats, setTtftStats] = useState<ProviderTtftStats[]>([])
  const [winnerRows, setWinnerRows] = useState<AbWinnerRow[]>([])
  const [usageCount, setUsageCount] = useState(0)
  const [costRefreshKey, setCostRefreshKey] = useState(0)

  useEffect(() => {
    setEvents(getEvents())
    setTtftStats(summarizeByProvider(getTtftSamples()))
    setWinnerRows(getWinners())
    setUsageCount(getUsage().length)
    setLoaded(true)
  }, [])

  const stats = useMemo(() => {
    const messages = events.filter((event) => event.type === "message_sent" || event.type === "message_received")
    const errors = events.filter((event) => event.type === "error")
    const toolCalls = events.filter((event) => event.type === "tool_call")
    const latencies = events
      .map((event) => event.latencyMs)
      .filter((latency): latency is number => typeof latency === "number" && Number.isFinite(latency))

    return {
      totalMessages: messages.length,
      totalErrors: errors.length,
      totalToolCalls: toolCalls.length,
      avgLatency: latencies.length ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length) : 0,
    }
  }, [events])

  const messagesByDay = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return Array.from({ length: BAR_DAYS }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (BAR_DAYS - 1 - index))
      const nextDate = new Date(date)
      nextDate.setDate(date.getDate() + 1)

      const count = events.filter(
        (event) =>
          (event.type === "message_sent" || event.type === "message_received") &&
          event.time >= date.getTime() &&
          event.time < nextDate.getTime()
      ).length

      return {
        label: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
        count,
      }
    })
  }, [events])

  const topModels = useMemo(() => {
    const counts = new Map<string, number>()
    for (const event of events) {
      if (!event.model) continue
      counts.set(event.model, (counts.get(event.model) ?? 0) + 1)
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([model, count]) => ({ model, count }))
  }, [events])

  const toolUsage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const event of events) {
      if (event.type !== "tool_call" || !event.tool) continue
      counts.set(event.tool, (counts.get(event.tool) ?? 0) + 1)
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tool, count]) => ({ tool, count }))
  }, [events])

  const winnerLeaderboard = useMemo<ModelWinrate[]>(() => modelLeaderboard(winnerRows), [winnerRows])

  // Cost-by-day matrix: total messages × per-model count, grouped by ISO date.
  const usageByDay = useMemo(() => {
    const map = new Map<string, { day: string; messages: number; tools: number; errors: number }>()
    for (const ev of events) {
      const day = new Date(ev.time).toISOString().slice(0, 10)
      const row = map.get(day) ?? { day, messages: 0, tools: 0, errors: 0 }
      if (ev.type === "message_received" || ev.type === "message_sent") row.messages += 1
      else if (ev.type === "tool_call") row.tools += 1
      else if (ev.type === "error") row.errors += 1
      map.set(day, row)
    }
    return [...map.values()].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 14)
  }, [events])

  function handleClear() {
    clearEvents()
    clearTtft()
    clearWinners()
    clearUsage()
    setEvents([])
    setTtftStats([])
    setWinnerRows([])
    setUsageCount(0)
    setCostRefreshKey((key) => key + 1)
  }

  function handleDownload() {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `tans-agents-stats-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              ← Quay lại
            </Link>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
              <p className="text-sm text-muted-foreground">Thống kê sử dụng local trên trình duyệt này.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownload} disabled={events.length === 0}>
              Tải xuống JSON
            </Button>
            <Button variant="destructive" onClick={handleClear} disabled={events.length === 0 && usageCount === 0}>
              Xóa dữ liệu
            </Button>
          </div>
        </header>

        <CostTrackerCard key={costRefreshKey} />

        {loaded && events.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-[280px] items-center justify-center p-8 text-center text-muted-foreground">
              Chưa có thống kê. Hãy chat vài câu rồi quay lại.
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Tổng messages" value={stats.totalMessages.toLocaleString("vi-VN")} />
              <StatCard label="Tổng errors" value={stats.totalErrors.toLocaleString("vi-VN")} />
              <StatCard label="Avg latency" value={formatLatency(stats.avgLatency)} />
              <StatCard label="Total tool calls" value={stats.totalToolCalls.toLocaleString("vi-VN")} />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Messages / ngày</CardTitle>
                </CardHeader>
                <CardContent>
                  <MessagesBarChart data={messagesByDay} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top 5 models</CardTitle>
                </CardHeader>
                <CardContent>
                  {topModels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có dữ liệu model.</p>
                  ) : (
                    <div className="overflow-hidden rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Model</th>
                            <th className="px-3 py-2 text-right font-medium">Lần dùng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topModels.map((item) => (
                            <tr key={item.model} className="border-t">
                              <td className="px-3 py-2 font-mono text-xs">{item.model}</td>
                              <td className="px-3 py-2 text-right">{item.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Tool usage</CardTitle>
              </CardHeader>
              <CardContent>
                {toolUsage.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có tool calls.</p>
                ) : (
                  <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
                    <ToolDonutChart data={toolUsage} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {toolUsage.map((item, index) => (
                        <div key={item.tool} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                          <span className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                            />
                            <span className="font-mono text-xs">{item.tool}</span>
                          </span>
                          <span className="font-medium">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <section className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Latency leaderboard (TTFT)</CardTitle>
                </CardHeader>
                <CardContent>
                  {ttftStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có dữ liệu TTFT. Chat vài câu để thu thập.</p>
                  ) : (
                    <div className="overflow-hidden rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Provider</th>
                            <th className="px-3 py-2 text-right font-medium">p50</th>
                            <th className="px-3 py-2 text-right font-medium">p95</th>
                            <th className="px-3 py-2 text-right font-medium">Samples</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ttftStats.map((row) => (
                            <tr key={row.provider} className="border-t">
                              <td className="px-3 py-2 font-mono text-xs">{row.provider}</td>
                              <td className="px-3 py-2 text-right">{formatLatency(row.p50Ms)}</td>
                              <td className="px-3 py-2 text-right">{formatLatency(row.p95Ms)}</td>
                              <td className="px-3 py-2 text-right">{row.samples}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>A/B winners</CardTitle>
                </CardHeader>
                <CardContent>
                  {winnerLeaderboard.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có lượt vote. Bật chế độ A/B và chọn câu trả lời ưa thích.</p>
                  ) : (
                    <div className="overflow-hidden rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Model</th>
                            <th className="px-3 py-2 text-right font-medium">Win %</th>
                            <th className="px-3 py-2 text-right font-medium">W / L / T</th>
                          </tr>
                        </thead>
                        <tbody>
                          {winnerLeaderboard.slice(0, 8).map((row) => (
                            <tr key={row.model} className="border-t">
                              <td className="px-3 py-2 font-mono text-xs">{row.model}</td>
                              <td className="px-3 py-2 text-right">{Math.round(row.winRate * 100)}%</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {row.wins} / {row.losses} / {row.ties}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Usage by day (last 14)</CardTitle>
              </CardHeader>
              <CardContent>
                {usageByDay.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có dữ liệu.</p>
                ) : (
                  <div className="overflow-hidden rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Ngày</th>
                          <th className="px-3 py-2 text-right font-medium">Messages</th>
                          <th className="px-3 py-2 text-right font-medium">Tools</th>
                          <th className="px-3 py-2 text-right font-medium">Errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usageByDay.map((row) => (
                          <tr key={row.day} className="border-t">
                            <td className="px-3 py-2 font-mono text-xs">{row.day}</td>
                            <td className="px-3 py-2 text-right">{row.messages}</td>
                            <td className="px-3 py-2 text-right">{row.tools}</td>
                            <td className="px-3 py-2 text-right">{row.errors}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  )
}

function MessagesBarChart({ data }: { data: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...data.map((item) => item.count))
  const width = 560
  const height = 240
  const padding = 32
  const chartHeight = height - padding * 2
  const slotWidth = (width - padding * 2) / data.length
  const barWidth = Math.min(42, slotWidth * 0.58)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Messages trong 7 ngày gần nhất" className="h-64 w-full">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" opacity="0.16" />
      {data.map((item, index) => {
        const barHeight = (item.count / max) * chartHeight
        const x = padding + index * slotWidth + (slotWidth - barWidth) / 2
        const y = height - padding - barHeight

        return (
          <g key={item.label}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx="8" className="fill-primary" opacity="0.85" />
            <text x={x + barWidth / 2} y={Math.max(16, y - 8)} textAnchor="middle" className="fill-foreground text-[12px] font-medium">
              {item.count}
            </text>
            <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {item.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function ToolDonutChart({ data }: { data: Array<{ tool: string; count: number }> }) {
  const total = data.reduce((sum, item) => sum + item.count, 0)
  const radius = 72
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <svg viewBox="0 0 200 200" role="img" aria-label="Tỉ lệ sử dụng tools" className="h-56 w-56">
      <circle cx="100" cy="100" r={radius} fill="none" stroke="currentColor" strokeWidth="28" opacity="0.12" />
      {data.map((item, index) => {
        const length = (item.count / total) * circumference
        const circle = (
          <circle
            key={item.tool}
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={DONUT_COLORS[index % DONUT_COLORS.length]}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            strokeWidth="28"
            transform="rotate(-90 100 100)"
          />
        )
        offset += length
        return circle
      })}
      <text x="100" y="95" textAnchor="middle" className="fill-foreground text-3xl font-semibold">
        {total}
      </text>
      <text x="100" y="118" textAnchor="middle" className="fill-muted-foreground text-xs">
        calls
      </text>
    </svg>
  )
}

function formatLatency(latencyMs: number) {
  if (!latencyMs) return "—"
  if (latencyMs < 1000) return `${latencyMs}ms`
  return `${(latencyMs / 1000).toFixed(1)}s`
}

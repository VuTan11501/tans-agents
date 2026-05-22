"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatTokens, formatUsd } from "@/lib/cost-estimator"
import { getUsage, type UsageEntry } from "@/lib/usage-log"

type GroupRow = {
  label: string
  tokens: number
  costUsd: number
}

function startOfToday(): number {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function startOfWeek(): number {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const diff = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - diff)
  return date.getTime()
}

function startOfMonth(): number {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(1)
  return date.getTime()
}

function summarize(entries: UsageEntry[]) {
  return entries.reduce(
    (acc, entry) => {
      acc.inputTokens += entry.inputTokens
      acc.outputTokens += entry.outputTokens
      acc.costUsd += entry.costUsd
      return acc
    },
    { inputTokens: 0, outputTokens: 0, costUsd: 0 }
  )
}

function groupBy(entries: UsageEntry[], key: "provider" | "model"): GroupRow[] {
  const map = new Map<string, GroupRow>()
  for (const entry of entries) {
    const label = entry[key] || "unknown"
    const current = map.get(label) ?? { label, tokens: 0, costUsd: 0 }
    current.tokens += entry.inputTokens + entry.outputTokens
    current.costUsd += entry.costUsd
    map.set(label, current)
  }
  return [...map.values()].sort((a, b) => b.tokens - a.tokens)
}

export function CostTrackerCard() {
  const [usage, setUsage] = useState<UsageEntry[]>([])

  useEffect(() => {
    setUsage(getUsage())
  }, [])

  const data = useMemo(() => {
    const now = Date.now()
    const today = usage.filter((entry) => entry.ts >= startOfToday() && entry.ts <= now)
    const week = usage.filter((entry) => entry.ts >= startOfWeek() && entry.ts <= now)
    const month = usage.filter((entry) => entry.ts >= startOfMonth() && entry.ts <= now)
    return {
      today: summarize(today),
      week: summarize(week),
      month: summarize(month),
      byProvider: groupBy(month, "provider"),
      byModel: groupBy(month, "model").slice(0, 5),
    }
  }, [usage])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theo dõi chi phí</CardTitle>
        <p className="text-sm text-muted-foreground">Tất cả miễn phí — chỉ ước tính theo bảng giá thị trường</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid gap-3 md:grid-cols-3">
          <CostSummary label="Hôm nay" inputTokens={data.today.inputTokens} outputTokens={data.today.outputTokens} costUsd={data.today.costUsd} />
          <CostSummary label="Tuần này" inputTokens={data.week.inputTokens} outputTokens={data.week.outputTokens} costUsd={data.week.costUsd} />
          <CostSummary label="Tháng này" inputTokens={data.month.inputTokens} outputTokens={data.month.outputTokens} costUsd={data.month.costUsd} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <UsageBars title="Theo nhà cung cấp" rows={data.byProvider} empty="Chưa có dữ liệu nhà cung cấp." />
          <UsageBars title="Theo model" rows={data.byModel} empty="Chưa có dữ liệu model." />
        </section>
      </CardContent>
    </Card>
  )
}

function CostSummary({ label, inputTokens, outputTokens, costUsd }: { label: string; inputTokens: number; outputTokens: number; costUsd: number }) {
  const totalTokens = inputTokens + outputTokens
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="mt-3 space-y-1">
        <p className="text-2xl font-semibold tracking-tight">{formatTokens(totalTokens)}</p>
        <p className="text-xs text-muted-foreground">Tokens · in {formatTokens(inputTokens)} / out {formatTokens(outputTokens)}</p>
        <p className="text-sm font-medium">Chi phí ước tính (lý thuyết): {formatUsd(costUsd)}</p>
      </div>
    </div>
  )
}

function UsageBars({ title, rows, empty }: { title: string; rows: GroupRow[]; empty: string }) {
  const maxTokens = Math.max(1, ...rows.map((row) => row.tokens))

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const width = `${Math.max(3, (row.tokens / maxTokens) * 100)}%`
            return (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-mono text-xs">{row.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatTokens(row.tokens)} · {formatUsd(row.costUsd)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

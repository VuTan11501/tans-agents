type ChartType = "line" | "bar" | "pie"

export type ChartData = {
  type: ChartType
  title: string
  labels: string[]
  data: number[]
}

type ChartRendererProps = {
  data: ChartData
}

type Point = { x: number; y: number; value: number; label: string }

const WIDTH = 640
const HEIGHT = 320
const PAD = { top: 42, right: 28, bottom: 56, left: 56 }
const PLOT_W = WIDTH - PAD.left - PAD.right
const PLOT_H = HEIGHT - PAD.top - PAD.bottom
const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(262 83% 58%)",
  "hsl(199 89% 48%)",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(346 77% 50%)",
  "hsl(24 95% 53%)",
  "hsl(173 80% 40%)",
]

export function ChartRenderer({ data }: ChartRendererProps) {
  const labels = data.labels.slice(0, data.data.length)
  const values = data.data.slice(0, labels.length).map((value) => (Number.isFinite(value) ? value : 0))

  if (labels.length === 0 || values.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Không có dữ liệu để vẽ biểu đồ.
      </div>
    )
  }

  return (
    <div className="w-full rounded-xl border bg-card p-3 shadow-sm">
      <svg className="h-auto max-h-[320px] w-full" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={data.title}>
        <title>{data.title}</title>
        {data.type === "pie" ? (
          <PieChart labels={labels} values={values} title={data.title} />
        ) : data.type === "bar" ? (
          <BarChart labels={labels} values={values} title={data.title} />
        ) : (
          <LineChart labels={labels} values={values} title={data.title} />
        )}
      </svg>
    </div>
  )
}

function LineChart({ labels, values, title }: { labels: string[]; values: number[]; title: string }) {
  const { min, max, ticks, yFor } = createYScale(values)
  const points: Point[] = values.map((value, index) => ({
    value,
    label: labels[index] ?? "",
    x: PAD.left + (values.length === 1 ? PLOT_W / 2 : (index / (values.length - 1)) * PLOT_W),
    y: yFor(value),
  }))
  const path = points.map((point) => `${point.x},${point.y}`).join(" ")

  return (
    <g>
      <ChartTitle title={title} />
      <Axes ticks={ticks} min={min} max={max} />
      <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={path} />
      {points.map((point, index) => (
        <g key={`${point.label}-${index}`}>
          <circle cx={point.x} cy={point.y} r="4.5" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="2.5" />
          <text x={point.x} y={point.y - 10} textAnchor="middle" className="fill-foreground text-[10px] font-medium">
            {formatNumber(point.value)}
          </text>
        </g>
      ))}
      <XAxisLabels labels={labels} count={values.length} />
    </g>
  )
}

function BarChart({ labels, values, title }: { labels: string[]; values: number[]; title: string }) {
  const { min, max, ticks, yFor } = createYScale(values)
  const zeroY = yFor(clamp(0, min, max))
  const gap = 12
  const barW = Math.max(10, (PLOT_W - gap * (values.length - 1)) / values.length)

  return (
    <g>
      <ChartTitle title={title} />
      <Axes ticks={ticks} min={min} max={max} />
      {values.map((value, index) => {
        const x = PAD.left + index * (barW + gap)
        const y = yFor(Math.max(value, 0))
        const height = Math.max(2, Math.abs(zeroY - yFor(value)))
        const labelY = value >= 0 ? y - 8 : y + height + 14

        return (
          <g key={`${labels[index]}-${index}`}>
            <rect x={x} y={value >= 0 ? y : zeroY} width={barW} height={height} rx="6" fill="hsl(var(--primary))" opacity="0.9" />
            <text x={x + barW / 2} y={labelY} textAnchor="middle" className="fill-foreground text-[10px] font-medium">
              {formatNumber(value)}
            </text>
          </g>
        )
      })}
      <XAxisLabels labels={labels} count={values.length} />
    </g>
  )
}

function PieChart({ labels, values, title }: { labels: string[]; values: number[]; title: string }) {
  const positiveValues = values.map((value) => Math.max(0, value))
  const total = positiveValues.reduce((sum, value) => sum + value, 0)
  const cx = 190
  const cy = 176
  const radius = 92
  let start = -Math.PI / 2

  if (total <= 0) {
    return (
      <g>
        <ChartTitle title={title} />
        <text x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" className="fill-muted-foreground text-sm">
          Dữ liệu pie cần giá trị dương.
        </text>
      </g>
    )
  }

  return (
    <g>
      <ChartTitle title={title} />
      {positiveValues.map((value, index) => {
        const angle = (value / total) * Math.PI * 2
        const end = start + angle
        const path = describeArc(cx, cy, radius, start, end)
        const mid = start + angle / 2
        const labelX = cx + Math.cos(mid) * (radius * 0.68)
        const labelY = cy + Math.sin(mid) * (radius * 0.68)
        start = end

        return (
          <g key={`${labels[index]}-${index}`}>
            <path d={path} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="hsl(var(--card))" strokeWidth="3" />
            {value / total >= 0.08 && (
              <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle" className="fill-primary-foreground text-[11px] font-semibold">
                {Math.round((value / total) * 100)}%
              </text>
            )}
          </g>
        )
      })}
      <g transform="translate(340 92)">
        {labels.map((label, index) => (
          <g key={`${label}-${index}`} transform={`translate(0 ${index * 25})`}>
            <rect width="14" height="14" rx="3" fill={PIE_COLORS[index % PIE_COLORS.length]} />
            <text x="22" y="11" className="fill-foreground text-[12px]">
              {truncate(label, 24)} · {formatNumber(values[index])}
            </text>
          </g>
        ))}
      </g>
    </g>
  )
}

function ChartTitle({ title }: { title: string }) {
  return (
    <text x={WIDTH / 2} y="24" textAnchor="middle" className="fill-foreground text-sm font-semibold">
      {title}
    </text>
  )
}

function Axes({ ticks, min, max }: { ticks: number[]; min: number; max: number }) {
  return (
    <g>
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} stroke="hsl(var(--border))" />
      <line x1={PAD.left} y1={PAD.top + PLOT_H} x2={PAD.left + PLOT_W} y2={PAD.top + PLOT_H} stroke="hsl(var(--border))" />
      {ticks.map((tick) => {
        const y = PAD.top + (1 - (tick - min) / (max - min || 1)) * PLOT_H
        return (
          <g key={tick}>
            <line x1={PAD.left} y1={y} x2={PAD.left + PLOT_W} y2={y} stroke="hsl(var(--border))" strokeDasharray="4 4" opacity="0.6" />
            <text x={PAD.left - 10} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
              {formatNumber(tick)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function XAxisLabels({ labels, count }: { labels: string[]; count: number }) {
  const step = count > 8 ? Math.ceil(count / 8) : 1

  return (
    <g>
      {labels.map((label, index) => {
        if (index % step !== 0 && index !== labels.length - 1) return null
        const x = PAD.left + (count === 1 ? PLOT_W / 2 : (index / (count - 1)) * PLOT_W)
        return (
          <text key={`${label}-${index}`} x={x} y={HEIGHT - 24} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {truncate(label, 12)}
          </text>
        )
      })}
    </g>
  )
}

function createYScale(values: number[]) {
  const rawMin = Math.min(...values, 0)
  const rawMax = Math.max(...values, 0)
  const span = rawMax - rawMin || 1
  const min = rawMin - span * 0.08
  const max = rawMax + span * 0.12
  const ticks = Array.from({ length: 5 }, (_, index) => min + ((max - min) / 4) * index)
  const yFor = (value: number) => PAD.top + (1 - (value - min) / (max - min || 1)) * PLOT_H

  return { min, max, ticks, yFor }
}

function describeArc(cx: number, cy: number, radius: number, start: number, end: number) {
  const startPoint = polarToCartesian(cx, cy, radius, end)
  const endPoint = polarToCartesian(cx, cy, radius, start)
  const largeArc = end - start <= Math.PI ? "0" : "1"

  return [`M ${cx} ${cy}`, `L ${startPoint.x} ${startPoint.y}`, `A ${radius} ${radius} 0 ${largeArc} 0 ${endPoint.x} ${endPoint.y}`, "Z"].join(" ")
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value)
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

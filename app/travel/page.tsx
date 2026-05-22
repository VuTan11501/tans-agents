"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"
const SAVE_KEY = "tans-agents:saved-trips-v1"

const COMPOSITIONS = ["solo", "cặp đôi", "gia đình có trẻ", "nhóm bạn", "công tác kết hợp du lịch"] as const
const BUDGETS = ["Tiết kiệm", "Trung bình", "Cao cấp", "Sang trọng"] as const
const INTERESTS = ["Văn hoá", "Ẩm thực", "Tự nhiên", "Mạo hiểm", "Shopping", "Nightlife", "Lịch sử", "Nghệ thuật", "Tâm linh", "Thư giãn"] as const

const ACTIONS = [
  { label: "🗺️ Lên lịch trình chi tiết", kind: "itinerary" },
  { label: "🍜 Gợi ý ẩm thực", kind: "food" },
  { label: "📦 Danh sách đồ đem", kind: "packing" },
  { label: "💰 Ước tính chi phí", kind: "cost" },
] as const

type Action = (typeof ACTIONS)[number]

export default function TravelPage() {
  const [destination, setDestination] = useState("")
  const [days, setDays] = useState(3)
  const [travelersCount, setTravelersCount] = useState(2)
  const [composition, setComposition] = useState<(typeof COMPOSITIONS)[number]>("cặp đôi")
  const [budget, setBudget] = useState<(typeof BUDGETS)[number]>("Trung bình")
  const [interests, setInterests] = useState<string[]>(["Ẩm thực", "Văn hoá"])
  const [season, setSeason] = useState("")
  const [mobility, setMobility] = useState("")
  const [output, setOutput] = useState("")
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const isLoading = loadingLabel !== null
  const selectedInterests = interests.length ? interests.join(", ") : "trải nghiệm tổng quát"
  const canRun = useMemo(() => destination.trim().length > 0 && !isLoading, [destination, isLoading])

  function toggleInterest(interest: string) {
    setInterests((current) => (current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]))
  }

  function buildPrompt(action: Action) {
    const dest = destination.trim()
    const common = `Điểm đến: ${dest}\nSố ngày: ${days}\nSố khách: ${travelersCount}\nThành phần: ${composition}\nNgân sách: ${budget}\nSở thích: ${selectedInterests}\nMùa/tháng: ${season.trim() || "không chỉ định"}\nHạn chế di chuyển: ${mobility.trim() || "không có"}`

    if (action.kind === "itinerary") {
      return `Lên lịch trình du lịch ${days} ngày tại ${dest} cho ${travelersCount} khách (${composition}), ngân sách ${budget}, tập trung vào ${selectedInterests}. Format markdown gồm: ## Tổng quan ## Ngày 1 (mục theo giờ sáng/trưa/chiều/tối + chi phí ước tính) ## Ngày 2 ... ## Mẹo địa phương ## Đồ đem theo ## Tổng chi phí ước tính.\n\nThông tin chi tiết:\n${common}`
    }
    if (action.kind === "food") {
      return `Gợi ý ẩm thực tại ${dest}: top 10 must-try foods + restaurant tips, phù hợp ngân sách ${budget} và nhóm ${composition}. Trả lời bằng markdown tiếng Việt, có mẹo gọi món, khu vực nên ăn và lưu ý vệ sinh/an toàn.\n\nThông tin chi tiết:\n${common}`
    }
    if (action.kind === "packing") {
      return `Tạo packing checklist theo danh mục cho chuyến đi ${days} ngày tại ${dest}, mùa/tháng ${season.trim() || "không chỉ định"}, nhóm ${composition}, hạn chế di chuyển: ${mobility.trim() || "không có"}. Trả lời bằng markdown, chia category rõ ràng và đánh dấu món bắt buộc/tuỳ chọn.\n\nThông tin chi tiết:\n${common}`
    }
    return `Ước tính chi phí chuyến đi ${days} ngày tại ${dest} cho ${travelersCount} khách (${composition}), ngân sách ${budget}, tập trung vào ${selectedInterests}. Trả lời bằng markdown gồm bảng breakdown: lưu trú, ăn uống, di chuyển, vé tham quan, shopping/dự phòng, tổng thấp-trung bình-cao và mẹo tiết kiệm.\n\nThông tin chi tiết:\n${common}`
  }

  async function runAction(action: Action) {
    if (!canRun) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoadingLabel(action.label)
    setOutput("")
    setError(null)
    setSaved(false)

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          enabledTools: [],
          messages: [{ role: "user", content: buildPrompt(action) }],
          personaSystemPrompt:
            "Bạn là trợ lý lập kế hoạch du lịch cho Tan. Trả lời bằng tiếng Việt, thực tế, có cấu trúc markdown rõ ràng, ưu tiên an toàn và phù hợp ngân sách.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => setOutput((current) => current + chunk))
    } catch (err: any) {
      if (err?.name === "AbortError") setError("Đã huỷ yêu cầu.")
      else setError(err?.message ?? "Có lỗi khi gọi AI.")
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoadingLabel(null)
    }
  }

  function abortRun() {
    abortRef.current?.abort()
  }

  async function copyOutput() {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function saveItinerary() {
    if (!output) return
    const current = readSavedItems(SAVE_KEY)
    const item = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      destination: destination.trim(),
      days,
      travelersCount,
      composition,
      budget,
      interests,
      season,
      mobility,
      content: output,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify([item, ...current].slice(0, 50)))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Travel AI planner</p>
          <h1 className="text-2xl font-semibold tracking-tight">Lập kế hoạch du lịch thông minh</h1>
          <p className="mt-1 text-sm text-muted-foreground">Nhập điểm đến, ngân sách và sở thích để tạo lịch trình markdown có thể copy/lưu.</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Điểm đến
                <input value={destination} onChange={(event) => setDestination(event.target.value)} className="rounded-lg border bg-background px-3 py-2 outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Tokyo, Đà Nẵng, Bali..." />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Số ngày (1-30)
                  <input type="number" min={1} max={30} value={days} onChange={(event) => setDays(clampNumber(event.target.value, 1, 30))} className="rounded-lg border bg-background px-3 py-2 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20" />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Số khách
                  <input type="number" min={1} max={30} value={travelersCount} onChange={(event) => setTravelersCount(clampNumber(event.target.value, 1, 30))} className="rounded-lg border bg-background px-3 py-2 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Thành phần
                  <select value={composition} onChange={(event) => setComposition(event.target.value as (typeof COMPOSITIONS)[number])} className="rounded-lg border bg-background px-3 py-2 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20">
                    {COMPOSITIONS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Ngân sách
                  <select value={budget} onChange={(event) => setBudget(event.target.value as (typeof BUDGETS)[number])} className="rounded-lg border bg-background px-3 py-2 outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20">
                    {BUDGETS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Sở thích</legend>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((interest) => (
                    <label key={interest} className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted">
                      <input type="checkbox" checked={interests.includes(interest)} onChange={() => toggleInterest(interest)} className="accent-primary" />
                      {interest}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="grid gap-2 text-sm font-medium">
                Mùa / tháng
                <input value={season} onChange={(event) => setSeason(event.target.value)} className="rounded-lg border bg-background px-3 py-2 outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Tháng 4, mùa hè, mùa lá đỏ..." />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Hạn chế di chuyển (tuỳ chọn)
                <textarea value={mobility} onChange={(event) => setMobility(event.target.value)} className="min-h-20 resize-y rounded-lg border bg-background px-3 py-2 outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Có trẻ nhỏ, người lớn tuổi, không đi bộ quá nhiều..." />
              </label>

              <div className="flex flex-wrap gap-2">
                {ACTIONS.map((action) => (
                  <Button key={action.label} type="button" variant="secondary" onClick={() => runAction(action)} disabled={!canRun}>
                    {action.label}
                  </Button>
                ))}
                {isLoading && <Button type="button" variant="destructive" onClick={abortRun}>Dừng</Button>}
              </div>
              <div className="min-h-5 text-sm">
                {isLoading && <span className="text-muted-foreground">Đang chạy: {loadingLabel}</span>}
                {error && <span className="text-destructive">{error}</span>}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium">Kết quả markdown</h2>
                <p className="text-xs text-muted-foreground">Nội dung stream trực tiếp từ AI.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={copyOutput} disabled={!output}>{copied ? "Đã sao chép" : "Copy"}</Button>
                <Button type="button" onClick={saveItinerary} disabled={!output}>{saved ? "Đã lưu" : "Save itinerary"}</Button>
              </div>
            </div>
            <MarkdownView content={output} loading={isLoading} empty="Chưa có lịch trình. Hãy nhập điểm đến và chọn một tác vụ." />
          </div>
        </section>
      </div>
    </main>
  )
}

function clampNumber(value: string, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return min
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function readSavedItems(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function MarkdownView({ content, loading, empty }: { content: string; loading: boolean; empty: string }) {
  const html = useMemo(() => markdownToHtml(content), [content])
  return (
    <div className="min-h-[32rem] overflow-auto rounded-lg border bg-background p-4 text-sm leading-relaxed [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted [&_th]:p-2 [&_ul]:ml-5 [&_ul]:list-disc">
      {content ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <span className="text-muted-foreground">{empty}</span>}
      {loading && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
    </div>
  )
}

async function readSseStream(body: ReadableStream<Uint8Array>, onContent: (content: string) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""

    for (const event of events) parseSseEvent(event, onContent)
  }

  buffer += decoder.decode()
  if (buffer.trim()) parseSseEvent(buffer, onContent)
}

function parseSseEvent(event: string, onContent: (content: string) => void) {
  const dataLines = event
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())

  for (const data of dataLines) {
    if (!data || data === "[DONE]") continue

    const payload = JSON.parse(data)
    if (payload?.error?.message) throw new Error(payload.error.message)

    const content = payload?.choices?.[0]?.delta?.content
    if (typeof content === "string") onContent(content)
  }
}

function markdownToHtml(markdown: string) {
  const lines = markdown.split(/\r?\n/)
  const html: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    if (line.trim().startsWith("```")) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index])
        index += 1
      }
      index += 1
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`)
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      index += 1
      continue
    }

    if (isTableStart(lines, index)) {
      const headers = splitTableRow(lines[index])
      index += 2
      const rows: string[][] = []
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        rows.push(splitTableRow(lines[index]))
        index += 1
      }
      html.push(`<table><thead><tr>${headers.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`)
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ""))
        index += 1
      }
      html.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`)
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""))
        index += 1
      }
      html.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`)
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+/.test(lines[index]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[index]) && !lines[index].trim().startsWith("```") && !isTableStart(lines, index)) {
      paragraph.push(lines[index])
      index += 1
    }
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`)
  }

  return html.join("\n")
}

function isTableStart(lines: string[], index: number) {
  return /^\s*\|.*\|\s*$/.test(lines[index] ?? "") && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1] ?? "")
}

function splitTableRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim())
}

function renderInline(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;")
}

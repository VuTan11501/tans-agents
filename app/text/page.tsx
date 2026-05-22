"use client"

import { useMemo, useState } from "react"

const sampleText = `Xin chào Tan!
Đây là công cụ xử lý văn bản nhanh.

Dán nội dung vào đây rồi chọn thao tác bên dưới.`

const loremIpsum = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vitae justo non sem pulvinar finibus. Donec gravida, arcu non posuere luctus, neque mi luctus nibh, vitae fermentum nisl nibh at nibh.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.`

type TextStats = {
  chars: number
  words: number
  lines: number
  paragraphs: number
}

function getStats(text: string): TextStats {
  const trimmed = text.trim()
  return {
    chars: Array.from(text).length,
    words: trimmed ? trimmed.match(/\S+/gu)?.length ?? 0 : 0,
    lines: text ? text.split(/\r\n|\r|\n/).length : 0,
    paragraphs: trimmed ? trimmed.split(/(?:\r\n|\r|\n){2,}/).filter((part) => part.trim()).length : 0,
  }
}

function getWords(text: string) {
  return text.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []
}

function toTitleCase(text: string) {
  return text.toLocaleLowerCase("vi-VN").replace(/[\p{L}\p{M}\p{N}]+/gu, (word) => {
    const letters = Array.from(word)
    return `${letters[0]?.toLocaleUpperCase("vi-VN") ?? ""}${letters.slice(1).join("")}`
  })
}

function toCamelCase(text: string) {
  const words = getWords(text).map((word) => word.toLocaleLowerCase("vi-VN"))
  return words
    .map((word, index) => {
      if (index === 0) return word
      const letters = Array.from(word)
      return `${letters[0]?.toLocaleUpperCase("vi-VN") ?? ""}${letters.slice(1).join("")}`
    })
    .join("")
}

function uniqueLines(text: string) {
  const seen = new Set<string>()
  return text
    .split(/\r\n|\r|\n/)
    .filter((line) => {
      if (seen.has(line)) return false
      seen.add(line)
      return true
    })
    .join("\n")
}

function shuffleLines(text: string) {
  const lines = text.split(/\r\n|\r|\n/)
  for (let index = lines.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[lines[index], lines[swapIndex]] = [lines[swapIndex], lines[index]]
  }
  return lines.join("\n")
}

function numericValue(line: string) {
  const match = line.match(/-?\d+(?:[.,]\d+)?/)
  return match ? Number.parseFloat(match[0].replace(",", ".")) : Number.POSITIVE_INFINITY
}

function simpleLineDiff(a: string, b: string) {
  const left = a.split(/\r\n|\r|\n/)
  const right = b.split(/\r\n|\r|\n/)
  const max = Math.max(left.length, right.length)
  const rows: string[] = []

  for (let index = 0; index < max; index += 1) {
    const oldLine = left[index]
    const newLine = right[index]

    if (oldLine === newLine) {
      if (oldLine !== undefined) rows.push(`  ${oldLine}`)
      continue
    }

    if (oldLine !== undefined) rows.push(`- ${oldLine}`)
    if (newLine !== undefined) rows.push(`+ ${newLine}`)
  }

  return rows.join("\n")
}

const transforms = [
  { label: "CHỮ HOA", apply: (text: string) => text.toLocaleUpperCase("vi-VN") },
  { label: "chữ thường", apply: (text: string) => text.toLocaleLowerCase("vi-VN") },
  { label: "Title Case", apply: toTitleCase },
  { label: "camelCase", apply: toCamelCase },
  { label: "snake_case", apply: (text: string) => getWords(text).map((word) => word.toLocaleLowerCase("vi-VN")).join("_") },
  { label: "kebab-case", apply: (text: string) => getWords(text).map((word) => word.toLocaleLowerCase("vi-VN")).join("-") },
  { label: "Đảo ngược", apply: (text: string) => Array.from(text).reverse().join("") },
  { label: "Trộn dòng", apply: shuffleLines },
  { label: "Sắp xếp A-Z", apply: (text: string) => text.split(/\r\n|\r|\n/).sort((a, b) => a.localeCompare(b, "vi")).join("\n") },
  { label: "Sắp xếp Z-A", apply: (text: string) => text.split(/\r\n|\r|\n/).sort((a, b) => b.localeCompare(a, "vi")).join("\n") },
  { label: "Sắp xếp số", apply: (text: string) => text.split(/\r\n|\r|\n/).sort((a, b) => numericValue(a) - numericValue(b)).join("\n") },
  { label: "Bỏ trùng", apply: uniqueLines },
  { label: "Bỏ dòng trống", apply: (text: string) => text.split(/\r\n|\r|\n/).filter((line) => line.trim()).join("\n") },
  { label: "Trim mỗi dòng", apply: (text: string) => text.split(/\r\n|\r|\n/).map((line) => line.trim()).join("\n") },
  { label: "Lorem Ipsum", apply: (text: string) => (text.trim() ? `${text.trim()}\n\n${loremIpsum}` : loremIpsum) },
]

export default function TextToolsPage() {
  const [input, setInput] = useState(sampleText)
  const [output, setOutput] = useState("")
  const [diffA, setDiffA] = useState("Dòng giữ nguyên\nDòng cũ\nChỉ có bên A")
  const [diffB, setDiffB] = useState("Dòng giữ nguyên\nDòng mới\nChỉ có bên B")
  const [copied, setCopied] = useState(false)
  const stats = useMemo(() => getStats(input), [input])
  const diff = useMemo(() => simpleLineDiff(diffA, diffB), [diffA, diffB])

  const copyOutput = async () => {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
      <section className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Công cụ văn bản</p>
        <h1 className="text-3xl font-bold tracking-tight">Chuyển đổi chữ & xử lý dòng</h1>
        <p className="text-muted-foreground">Nhập văn bản, xem thống kê trực tiếp và biến đổi nội dung bằng các thao tác phổ biến.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Ký tự", stats.chars],
          ["Từ", stats.words],
          ["Dòng", stats.lines],
          ["Đoạn", stats.paragraphs],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <label className="text-sm font-medium" htmlFor="text-input">Văn bản đầu vào</label>
          <textarea
            id="text-input"
            className="mt-3 min-h-80 w-full rounded-lg border bg-background p-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Dán văn bản cần xử lý..."
          />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium" htmlFor="text-output">Kết quả</label>
            <button
              type="button"
              onClick={copyOutput}
              disabled={!output}
              className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? "Đã copy" : "Copy output"}
            </button>
          </div>
          <textarea
            id="text-output"
            className="mt-3 min-h-80 w-full rounded-lg border bg-background p-3 text-sm outline-none placeholder:text-muted-foreground"
            value={output}
            readOnly
            placeholder="Kết quả sẽ xuất hiện ở đây..."
          />
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold">Thao tác nhanh</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {transforms.map((transform) => (
            <button
              key={transform.label}
              type="button"
              onClick={() => setOutput(transform.apply(input))}
              className="rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              {transform.label}
            </button>
          ))}
        </div>
      </section>

      <details className="rounded-lg border bg-card p-4">
        <summary className="cursor-pointer text-lg font-semibold">Diff dòng (mở rộng)</summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">
            Text A
            <textarea
              className="min-h-48 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={diffA}
              onChange={(event) => setDiffA(event.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            Text B
            <textarea
              className="min-h-48 w-full rounded-lg border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={diffB}
              onChange={(event) => setDiffB(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 rounded-lg border bg-background p-3">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Kết quả diff</p>
          <pre className="overflow-auto whitespace-pre-wrap text-sm leading-6"><code>{diff || "Không có nội dung để so sánh."}</code></pre>
        </div>
      </details>
    </main>
  )
}

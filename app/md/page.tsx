"use client"

import { useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "tans-agents:md-draft-v1"

const SAMPLE_MARKDOWN = `# Markdown live preview

Viết Markdown ở khung bên trái, xem kết quả render ngay bên phải.

## Checklist

- [x] Hỗ trợ **bold**, _italic_, và \`inline code\`
- [x] Danh sách, bảng, quote
- [x] Code block có nhãn ngôn ngữ

> Gợi ý: nội dung sẽ tự lưu vào trình duyệt sau 1 giây.

## Bảng mẫu

| Mục | Trạng thái | Ghi chú |
| --- | --- | --- |
| Header | ✅ | H1/H2/H3 |
| List | ✅ | Ordered + unordered |
| Code | ✅ | Có copy riêng |

## Code

\`\`\`ts
function xinChao(name: string) {
  return \`Xin chào, \${name}!\`
}

console.log(xinChao("Tan"))
\`\`\`
`

export default function MarkdownPreviewPage() {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved !== null) setMarkdown(saved)
    } catch {
      // ignore private-mode storage errors
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, markdown)
      } catch {
        // ignore quota / private-mode storage errors
      }
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [markdown])

  const wordCount = useMemo(() => markdown.trim().split(/\s+/).filter(Boolean).length, [markdown])

  async function copyMarkdown() {
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "draft.md"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function clearMarkdown() {
    if (!window.confirm("Bạn chắc chắn muốn xoá nội dung Markdown hiện tại?")) return
    setMarkdown("")
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore storage errors
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Công cụ Markdown</p>
              <h1 className="text-2xl font-semibold tracking-tight">Live preview</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Tự lưu sau 1 giây • {wordCount} từ • localStorage: <code>{STORAGE_KEY}</code>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={downloadMarkdown}>
                Tải .md
              </Button>
              <Button type="button" variant="secondary" onClick={copyMarkdown}>
                {copied ? "Đã sao chép" : "Sao chép"}
              </Button>
              <Button type="button" variant="destructive" onClick={clearMarkdown}>
                Xoá
              </Button>
            </div>
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-12rem)] gap-4 lg:grid-cols-2">
          <div className="flex min-h-[32rem] flex-col rounded-lg border bg-card p-4 shadow-sm">
            <label htmlFor="markdown-input" className="mb-2 text-sm font-medium">
              Nội dung Markdown
            </label>
            <textarea
              id="markdown-input"
              value={markdown}
              onChange={(event) => setMarkdown(event.target.value)}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none rounded-lg border bg-background p-4 font-mono text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="Nhập Markdown tại đây..."
            />
          </div>

          <div className="flex min-h-[32rem] flex-col rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Bản xem trước</h2>
              <span className="text-xs text-muted-foreground">render bằng react-markdown</span>
            </div>
            <article className="min-h-0 flex-1 overflow-auto rounded-lg border bg-background p-4">
              {markdown.trim() ? (
                <div className="prose-chat max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{ pre: (props: any) => <CodeBlock {...props} /> }}
                  >
                    {markdown}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                  Chưa có nội dung để xem trước.
                </div>
              )}
            </article>
          </div>
        </section>
      </div>
    </main>
  )
}

function CodeBlock({ children }: any) {
  const rawText = extractText(children)
  const text = rawText.endsWith("\n") ? rawText.slice(0, -1) : rawText
  const language = getCodeLanguage(children)
  const [copied, setCopied] = useState(false)

  async function copyCode() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="group/code my-4 overflow-hidden rounded-lg border bg-card text-sm">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-3 py-2">
        <span className="font-mono text-xs text-muted-foreground">{language || "text"}</span>
        <button
          type="button"
          onClick={copyCode}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? "Đã copy" : "Copy code"}
        </button>
      </div>
      <pre className="m-0 overflow-x-auto bg-transparent p-4">
        <code className={cn("font-mono text-sm", language && `language-${language}`)}>{text}</code>
      </pre>
    </div>
  )
}

function extractText(node: any): string {
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractText).join("")
  if (node?.props?.children) return extractText(node.props.children)
  return ""
}

function getCodeLanguage(children: any): string {
  const child = Array.isArray(children) ? children[0] : children
  const className = child?.props?.className ?? ""
  const match = /language-([^\s]+)/.exec(className)
  return match?.[1] ?? ""
}

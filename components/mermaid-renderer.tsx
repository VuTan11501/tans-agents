"use client"

import { useEffect, useId, useMemo, useState } from "react"

type MermaidRendererProps = {
  code: string
  title?: string
}

type MermaidModule = {
  default?: MermaidApi
  initialize: MermaidApi["initialize"]
  render: MermaidApi["render"]
}

type MermaidApi = {
  initialize: (config: { startOnLoad: boolean; theme: "dark" | "default"; securityLevel: "strict" }) => void
  render: (id: string, code: string) => Promise<{ svg: string; bindFunctions?: (element: Element) => void }>
}

const MERMAID_CDN = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs"

export function MermaidRenderer({ code, title }: MermaidRendererProps) {
  const reactId = useId()
  const renderId = useMemo(() => `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [reactId])
  const [svg, setSvg] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function renderMermaid() {
      setLoading(true)
      setError("")
      setSvg("")

      try {
        const imported = await importFromCdn<MermaidModule>(MERMAID_CDN)
        const mermaid = imported.default ?? imported
        const theme = document.documentElement.classList.contains("dark") ? "dark" : "default"

        mermaid.initialize({ startOnLoad: false, theme, securityLevel: "strict" })
        const result = await mermaid.render(renderId, code)

        if (!cancelled) {
          setSvg(result.svg)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Không thể vẽ sơ đồ Mermaid.")
          setLoading(false)
        }
      }
    }

    renderMermaid()

    return () => {
      cancelled = true
    }
  }, [code, renderId])

  return (
    <div className="w-full rounded-xl border bg-card p-4 shadow-sm">
      {title && <div className="mb-3 text-sm font-semibold text-foreground">{title}</div>}
      {loading ? (
        <div className="space-y-3" aria-label="Đang tải sơ đồ">
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-40 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <div className="font-medium">Không thể vẽ sơ đồ Mermaid</div>
          <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
        </div>
      ) : (
        <div
          className="max-h-[320px] w-full overflow-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-h-[320px] [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  )
}

function importFromCdn<T>(url: string): Promise<T> {
  const dynamicImport = new Function("url", "return import(url)") as (moduleUrl: string) => Promise<T>
  return dynamicImport(url)
}

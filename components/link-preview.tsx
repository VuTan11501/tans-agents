"use client"
import { useEffect, useState } from "react"
import { ExternalLink, Globe } from "lucide-react"

// Simple link preview using Microlink free API (no auth, 50 req/day per IP).
// Falls back to bare URL display on error.

interface LinkMeta {
  title?: string
  description?: string
  image?: string
  publisher?: string
  url: string
}

const cache = new Map<string, LinkMeta | null>()

async function fetchMeta(url: string): Promise<LinkMeta | null> {
  if (cache.has(url)) return cache.get(url)!
  try {
    const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
    if (!res.ok) {
      cache.set(url, null)
      return null
    }
    const json = await res.json()
    if (json.status !== "success") {
      cache.set(url, null)
      return null
    }
    const meta: LinkMeta = {
      title: json.data?.title,
      description: json.data?.description,
      image: json.data?.image?.url,
      publisher: json.data?.publisher,
      url,
    }
    cache.set(url, meta)
    return meta
  } catch {
    cache.set(url, null)
    return null
  }
}

export function LinkPreviewCard({ url }: { url: string }) {
  const [meta, setMeta] = useState<LinkMeta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchMeta(url).then((m) => {
      if (alive) {
        setMeta(m)
        setLoading(false)
      }
    })
    return () => {
      alive = false
    }
  }, [url])

  if (loading) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Globe className="h-4 w-4 animate-pulse" />
        <span className="line-clamp-1">{url}</span>
      </div>
    )
  }
  if (!meta) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="my-2 flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-xs hover:bg-muted"
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
        <span className="line-clamp-1 text-primary">{url}</span>
      </a>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-2 flex gap-3 rounded-md border bg-card p-3 transition-colors hover:bg-muted/50"
    >
      {meta.image && (
        <img src={meta.image} alt="" className="h-16 w-16 shrink-0 rounded object-cover" loading="lazy" />
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium">{meta.title || url}</p>
        {meta.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{meta.description}</p>
        )}
        <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Globe className="h-3 w-3" />
          {meta.publisher || new URL(url).hostname}
        </p>
      </div>
    </a>
  )
}

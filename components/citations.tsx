export type CitationSource = {
  title?: string
  url?: string
  filename?: string
}

export function Citations({ sources }: { sources: CitationSource[] }) {
  const cleanSources = sources.filter((source) => source?.title || source?.url || source?.filename)
  if (cleanSources.length === 0) return null

  return (
    <ol className="mt-2 space-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
      {cleanSources.map((source, index) => {
        const label = source.title || source.filename || source.url || `Nguồn ${index + 1}`
        const target = source.url || source.filename || ""
        return (
          <li key={`${label}-${target}-${index}`} className="flex gap-1.5 [overflow-wrap:anywhere]">
            <span className="shrink-0">[{index + 1}]</span>
            <span>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                  {label}
                </a>
              ) : (
                label
              )}
              {target && target !== label && <span> — {target}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronDown, ChevronUp, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

const MARK_SELECTOR = "mark[data-tans-mark]"
const MARK_CLASS = "bg-yellow-300/40 dark:bg-yellow-500/30 rounded px-0.5"
const ACTIVE_MARK_CLASS = "bg-yellow-400/70 dark:bg-yellow-400/60 rounded px-0.5"

type ChatSearchProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  refreshKey?: string
}

function unwrapMarks(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(MARK_SELECTOR).forEach((mark) => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  })
}

function findRanges(text: string, query: string, caseSensitive: boolean) {
  const haystack = caseSensitive ? text : text.toLocaleLowerCase()
  const needle = caseSensitive ? query : query.toLocaleLowerCase()
  const ranges: number[] = []
  let index = haystack.indexOf(needle)

  while (index !== -1) {
    ranges.push(index)
    index = haystack.indexOf(needle, index + Math.max(needle.length, 1))
  }

  return ranges
}

function collectTextNodes(root: Element) {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest(MARK_SELECTOR)) return NodeFilter.FILTER_REJECT
      if (parent.closest("script,style,textarea,input,button")) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let node = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }

  return nodes
}

export function ChatSearch({ open, onOpenChange, refreshKey }: ChatSearchProps) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [matchCount, setMatchCount] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const matchesRef = useRef<HTMLElement[]>([])

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 100)
    return () => window.clearTimeout(timer)
  }, [open, query])

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.preventDefault()
      onOpenChange(false)
    }
    window.addEventListener("keydown", closeOnEscape, true)
    return () => window.removeEventListener("keydown", closeOnEscape, true)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) {
      unwrapMarks()
      matchesRef.current = []
      setMatchCount(0)
      setActiveIndex(0)
      return
    }

    unwrapMarks()
    matchesRef.current = []

    if (!debouncedQuery) {
      setMatchCount(0)
      setActiveIndex(0)
      return
    }

    const container = document.querySelector("[data-chat-messages]")
    if (!container) {
      setMatchCount(0)
      setActiveIndex(0)
      return
    }

    let matchIndex = 0
    const messageNodes = Array.from(container.querySelectorAll<HTMLElement>("[data-message-id]"))

    for (const messageNode of messageNodes) {
      const textNodes = collectTextNodes(messageNode)
      for (const textNode of textNodes) {
        const text = textNode.nodeValue ?? ""
        const ranges = findRanges(text, debouncedQuery, caseSensitive)
        if (ranges.length === 0) continue

        const fragment = document.createDocumentFragment()
        let cursor = 0

        for (const start of ranges) {
          if (start > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, start)))

          const mark = document.createElement("mark")
          mark.dataset.tansMark = "true"
          mark.dataset.tansMatchIndex = String(matchIndex++)
          mark.className = MARK_CLASS
          mark.textContent = text.slice(start, start + debouncedQuery.length)
          fragment.appendChild(mark)
          matchesRef.current.push(mark)
          cursor = start + debouncedQuery.length
        }

        if (cursor < text.length) fragment.appendChild(document.createTextNode(text.slice(cursor)))
        textNode.parentNode?.replaceChild(fragment, textNode)
      }
    }

    setMatchCount(matchesRef.current.length)
    setActiveIndex(0)

    return () => unwrapMarks()
  }, [open, debouncedQuery, caseSensitive, refreshKey])

  useEffect(() => {
    matchesRef.current.forEach((mark, index) => {
      mark.className = index === activeIndex ? ACTIVE_MARK_CLASS : MARK_CLASS
      if (index === activeIndex) {
        mark.scrollIntoView({ block: "center" })
      }
    })
  }, [activeIndex, matchCount])

  const goToMatch = useCallback(
    (direction: 1 | -1) => {
      if (matchCount === 0) return
      setActiveIndex((current) => (current + direction + matchCount) % matchCount)
    },
    [matchCount]
  )

  const countLabel = useMemo(() => {
    if (!debouncedQuery || matchCount === 0) return "0 / 0"
    return `${activeIndex + 1} / ${matchCount}`
  }, [activeIndex, debouncedQuery, matchCount])

  if (!mounted || !open) return null

  return createPortal(
    <div className="fixed left-1/2 top-20 z-50 w-[min(92vw,32rem)] -translate-x-1/2 rounded-xl border border-border bg-background/95 p-3 shadow-2xl backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Search className="h-3.5 w-3.5" />
        <span>Tìm trong chat</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              onOpenChange(false)
            } else if (event.key === "Enter") {
              event.preventDefault()
              goToMatch(event.shiftKey ? -1 : 1)
            } else if (event.key === "ArrowDown") {
              event.preventDefault()
              goToMatch(1)
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              goToMatch(-1)
            }
          }}
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Nhập từ khóa..."
          aria-label="Tìm trong chat"
        />
        <span className="w-14 shrink-0 text-center text-xs text-muted-foreground" aria-live="polite">
          {countLabel}
        </span>
        <button
          type="button"
          onClick={() => setCaseSensitive((value) => !value)}
          className={cn(
            "h-9 rounded-md border border-input px-2 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            caseSensitive && "bg-muted text-foreground"
          )}
          aria-pressed={caseSensitive}
          aria-label="Phân biệt hoa thường"
          title="Phân biệt hoa thường"
        >
          Aa
        </button>
        <button
          type="button"
          onClick={() => goToMatch(-1)}
          disabled={matchCount === 0}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-input hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Kết quả trước"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => goToMatch(1)}
          disabled={matchCount === 0}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-input hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Kết quả sau"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-input hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Đóng tìm kiếm"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body
  )
}

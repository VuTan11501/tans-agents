"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MarkdownPreview } from "@/components/markdown-preview"
import { SearchIcon, PlusIcon, TrashIcon, EditIcon, DownloadIcon, BrainIcon, SaveIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface KBEntry {
  id: string
  title: string
  tags: string[]
  content: string
  createdAt: string
  updatedAt: string
}

interface AISearchResult {
  id: string
  title: string
  score: number
}

export default function KBPage() {
  const [entries, setEntries] = useState<KBEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<AISearchResult[]>([])

  // Form state
  const [title, setTitle] = useState("")
  const [tagsInput, setTagsInput] = useState("")
  const [content, setContent] = useState("")

  const STORAGE_KEY = "tans-agents:kb-v1"

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setEntries(JSON.parse(saved))
    }
  }, [])

  const saveToStorage = (data: KBEntry[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  const allTags = Array.from(
    new Set(entries.flatMap((e) => e.tags))
  ).sort()

  const filtered = entries.filter((entry) => {
    const matchesSearch =
      !searchQuery ||
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesTag = !filterTag || entry.tags.includes(filterTag)

    return matchesSearch && matchesTag
  })

  const selected = entries.find((e) => e.id === selectedId)

  const handleNewEntry = () => {
    setTitle("")
    setTagsInput("")
    setContent("")
    setIsCreating(true)
    setIsEditing(false)
    setSelectedId(null)
  }

  const handleEditEntry = () => {
    if (!selected) return
    setTitle(selected.title)
    setTagsInput(selected.tags.join(", "))
    setContent(selected.content)
    setIsEditing(true)
  }

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t)

    if (isCreating) {
      const newEntry: KBEntry = {
        id: Date.now().toString(),
        title: title.trim(),
        tags,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const updated = [...entries, newEntry]
      setEntries(updated)
      saveToStorage(updated)
      setSelectedId(newEntry.id)
      toast.success("Entry created")
    } else if (isEditing && selected) {
      const updated = entries.map((e) =>
        e.id === selected.id
          ? {
              ...e,
              title: title.trim(),
              tags,
              content,
              updatedAt: new Date().toISOString(),
            }
          : e
      )
      setEntries(updated)
      saveToStorage(updated)
      setSelectedId(selected.id)
      toast.success("Entry updated")
    }

    setIsCreating(false)
    setIsEditing(false)
  }

  const handleDelete = (id: string) => {
    const updated = entries.filter((e) => e.id !== id)
    setEntries(updated)
    saveToStorage(updated)
    if (selectedId === id) {
      setSelectedId(null)
    }
    toast.success("Entry deleted")
  }

  const handleExport = () => {
    if (entries.length === 0) {
      toast.error("No entries to export")
      return
    }

    const markdown = entries
      .map((e) => `# ${e.title}\n\nTags: ${e.tags.join(", ")}\n\nCreated: ${e.createdAt}\n\n${e.content}`)
      .join("\n\n---\n\n")

    const blob = new Blob([markdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `kb-export-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exported")
  }

  const handleAISearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Enter a search query")
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `I have a personal knowledge base with these entries:\n\n${entries
                .map((e) => `ID: ${e.id}\nTitle: ${e.title}\nTags: ${e.tags.join(", ")}\nPreview: ${e.content.substring(0, 100)}...`)
                .join("\n\n")}\n\nUser search query: "${searchQuery}"\n\nRank the entries by relevance. Return ONLY a JSON array like [{"id":"123","title":"Example","score":0.95},{"id":"456","title":"Other","score":0.70}]. Only include entries with score > 0.5.`,
            },
          ],
        }),
      })

      if (!response.ok) throw new Error("API error")

      let fullText = ""
      const reader = response.body?.getReader()
      if (!reader) throw new Error("No reader")

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += new TextDecoder().decode(value)
      }

      // Extract JSON from SSE response
      const lines = fullText.split("\n").filter((l) => l.startsWith("0:"))
      const jsonStr = lines.map((l) => l.substring(2)).join("")
      
      try {
        const parsed = JSON.parse(jsonStr)
        if (Array.isArray(parsed)) {
          setSearchResults(parsed)
          toast.success("AI search completed")
        }
      } catch {
        toast.error("Failed to parse AI response")
      }
    } catch (err) {
      console.error(err)
      toast.error("AI search failed")
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">🧠 Knowledge Base</h1>
        </div>

        {/* Search & Tags */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b space-y-3">
            <div className="relative">
              <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Button
              onClick={handleAISearch}
              disabled={isSearching || !searchQuery.trim()}
              size="sm"
              variant="outline"
              className="w-full"
            >
              <BrainIcon className="h-4 w-4 mr-2" />
              {isSearching ? "Searching..." : "AI Search"}
            </Button>
          </div>

          {/* AI Search Results */}
          {searchResults.length > 0 && (
            <div className="p-4 border-b space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">AI RESULTS</p>
              <div className="space-y-1">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => setSelectedId(result.id)}
                    className="w-full text-left p-2 rounded bg-blue-500/10 hover:bg-blue-500/20 text-sm border border-blue-500/30"
                  >
                    <div className="font-medium truncate">
                      {result.title || entries.find((e) => e.id === result.id)?.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Match: {(result.score * 100).toFixed(0)}%
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {allTags.length > 0 && (
            <div className="p-4 border-b space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">TAGS</p>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                    className={cn(
                      "text-xs px-2 py-1 rounded border",
                      filterTag === tag
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted hover:bg-muted/80 border-muted-foreground/20"
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Entries List */}
          <div className="p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              ENTRIES ({filtered.length})
            </p>
            <div className="space-y-1">
              {filtered.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedId(entry.id)}
                  className={cn(
                    "w-full text-left p-2 rounded text-sm truncate transition",
                    selectedId === entry.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                  title={entry.title}
                >
                  {entry.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t space-y-2">
          <Button
            onClick={handleNewEntry}
            size="sm"
            className="w-full"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Entry
          </Button>
          <Button
            onClick={handleExport}
            size="sm"
            variant="outline"
            className="w-full"
          >
            <DownloadIcon className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isCreating || isEditing ? (
          // Edit Mode
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b p-4 space-y-3 overflow-y-auto">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Entry title..."
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tags (comma-separated)</label>
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  size="sm"
                  className="flex-1"
                >
                  <SaveIcon className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button
                  onClick={() => {
                    setIsCreating(false)
                    setIsEditing(false)
                  }}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <XIcon className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col border-r p-4 overflow-hidden">
                <label className="text-sm font-medium mb-2">Markdown Content</label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write markdown content..."
                  className="flex-1 resize-none"
                />
              </div>
              <div className="flex-1 p-4 overflow-hidden flex flex-col">
                <label className="text-sm font-medium mb-2">Preview</label>
                <MarkdownPreview value={content} className="flex-1" />
              </div>
            </div>
          </div>
        ) : selected ? (
          // View Mode
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b p-4 flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{selected.title}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selected.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Created: {new Date(selected.createdAt).toLocaleDateString()}
                  {selected.createdAt !== selected.updatedAt && (
                    <> · Updated: {new Date(selected.updatedAt).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleEditEntry}
                  size="sm"
                  variant="outline"
                >
                  <EditIcon className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  onClick={() => handleDelete(selected.id)}
                  size="sm"
                  variant="destructive"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <MarkdownPreview value={selected.content} className="h-full overflow-y-auto" />
            </div>
          </div>
        ) : (
          // Empty State
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <BrainIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">No entry selected</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a new entry or select one from the sidebar
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

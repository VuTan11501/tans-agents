"use client"

import { useEffect, useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Check, FileUp, FolderOpen, Plus, Search, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  clearActiveCollectionId,
  countChunks,
  createCollection,
  deleteCollection,
  getActiveCollectionId,
  ingestFiles,
  listCollections,
  RAG_ACTIVE_COLLECTION_EVENT,
  searchCollectionLocal,
  setActiveCollectionId,
  type CollectionSearchResult,
  type DocumentCollection,
} from "@/lib/collections"
import { cn } from "@/lib/utils"

interface CollectionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CollectionsDialog({ open, onOpenChange }: CollectionsDialogProps) {
  const [collections, setCollections] = useState<DocumentCollection[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CollectionSearchResult[]>([])
  const [chunkCounts, setChunkCounts] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState("")

  useEffect(() => {
    if (!open) return
    refresh()
  }, [open])

  useEffect(() => {
    function handleActiveChange() {
      setActiveId(getActiveCollectionId())
    }
    handleActiveChange()
    window.addEventListener(RAG_ACTIVE_COLLECTION_EVENT, handleActiveChange)
    window.addEventListener("storage", handleActiveChange)
    return () => {
      window.removeEventListener(RAG_ACTIVE_COLLECTION_EVENT, handleActiveChange)
      window.removeEventListener("storage", handleActiveChange)
    }
  }, [])

  const selected = collections.find((collection) => collection.id === selectedId) ?? collections[0]

  async function refresh() {
    const next = await listCollections()
    const storedActiveId = getActiveCollectionId()
    const validActiveId = next.some((collection) => collection.id === storedActiveId) ? storedActiveId : null
    if (storedActiveId && !validActiveId) clearActiveCollectionId()
    setActiveId(validActiveId)
    setCollections(next)
    setSelectedId((current) => current ?? next[0]?.id ?? null)
    const counts: Record<string, number> = {}
    await Promise.all(next.map(async (collection) => {
      counts[collection.id] = await countChunks(collection.id)
    }))
    setChunkCounts(counts)
  }

  async function handleCreate() {
    if (!name.trim()) return
    const collection = await createCollection(name)
    setName("")
    setSelectedId(collection.id)
    await refresh()
  }

  async function handleDelete(collectionId: string) {
    await deleteCollection(collectionId)
    if (selectedId === collectionId) setSelectedId(null)
    if (activeId === collectionId) setActiveId(null)
    setResults([])
    await refresh()
  }

  function handleSetActive(collectionId: string) {
    setActiveCollectionId(collectionId)
    setActiveId(collectionId)
  }

  async function handleUpload(files: FileList | null) {
    if (!selected || !files?.length) return
    setBusy(true)
    setStatus("Đang chuẩn bị model embedding (~25MB lần đầu)...")
    try {
      await ingestFiles(selected.id, Array.from(files), setStatus)
      await refresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể nạp tài liệu")
    } finally {
      setBusy(false)
    }
  }

  async function handleSearch() {
    if (!selected || !query.trim()) return
    setBusy(true)
    setStatus("Đang tìm trong bộ sưu tập...")
    try {
      setResults(await searchCollectionLocal({ collectionId: selected.id, query, topK: 5 }))
      setStatus("")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Không thể tìm kiếm")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-200">
          <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
            <FolderOpen className="h-4 w-4" /> Bộ tài liệu cá nhân
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Upload PDF/MD/TXT để chunk, embedding bằng transformers.js và lưu cục bộ trong IndexedDB.
          </Dialog.Description>

          <div className="mt-4 grid min-h-0 gap-4 md:grid-cols-[260px_1fr]">
            <aside className="space-y-3 overflow-y-auto pr-1">
              <div className="flex gap-2">
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tên collection" className="h-9" />
                <Button type="button" size="icon" className="h-9 w-9" onClick={handleCreate} disabled={!name.trim()} aria-label="Tạo collection">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {collections.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Chưa có collection nào.</p>
              ) : (
                collections.map((collection) => (
                  <button
                    key={collection.id}
                    type="button"
                    onClick={() => setSelectedId(collection.id)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent",
                      selected?.id === collection.id && "bg-accent"
                    )}
                  >
                    <FolderOpen className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 truncate font-medium">
                        {collection.name}
                        {activeId === collection.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      </span>
                      <span className="text-xs text-muted-foreground">{chunkCounts[collection.id] ?? 0} chunk</span>
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "rounded px-2 py-1 text-[10px] font-medium hover:bg-background",
                        activeId === collection.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleSetActive(collection.id)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") handleSetActive(collection.id)
                      }}
                      aria-label="Đặt làm active"
                    >
                      {activeId === collection.id ? "Active" : "Đặt làm active"}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleDelete(collection.id)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") handleDelete(collection.id)
                      }}
                      aria-label="Xoá collection"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))
              )}
            </aside>

            <main className="min-h-0 space-y-4 overflow-y-auto pr-1">
              <div className="rounded-lg border bg-card/50 p-3">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-accent/60">
                  <FileUp className="h-6 w-6" />
                  <span>{selected ? `Upload vào “${selected.name}”` : "Tạo collection trước khi upload"}</span>
                  <input type="file" multiple accept=".pdf,.md,.txt,text/plain,text/markdown,application/pdf" disabled={!selected || busy} className="hidden" onChange={(event) => handleUpload(event.target.files)} />
                </label>
                {status && <p className="mt-2 text-xs text-muted-foreground">{status}</p>}
              </div>

              <div className="flex gap-2">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleSearch()} placeholder="Tìm thử trong collection..." />
                <Button type="button" onClick={handleSearch} disabled={!selected || !query.trim() || busy} className="gap-2">
                  <Search className="h-4 w-4" /> Tìm
                </Button>
              </div>

              <div className="space-y-2">
                {results.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Kết quả tìm kiếm sẽ hiển thị tại đây.</p>
                ) : (
                  results.map((result, index) => (
                    <article key={`${result.source}-${index}`} className="rounded-lg border bg-card/60 p-3">
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{result.source}</span>
                        <span>{Math.round(result.score * 100)}%</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{result.text}</p>
                    </article>
                  ))
                )}
              </div>
            </main>
          </div>

          <Dialog.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="Đóng bộ tài liệu">
            <X className="h-4 w-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FolderOpen, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CollectionsDialog } from "@/components/collections-dialog"
import {
  clearActiveCollectionId,
  getActiveCollectionId,
  listCollections,
  RAG_ACTIVE_COLLECTION_EVENT,
  setActiveCollectionId,
  type DocumentCollection,
} from "@/lib/collections"
import { cn } from "@/lib/utils"

function shortName(name: string) {
  return name.length > 12 ? `${name.slice(0, 12)}…` : name
}

export function RagPicker({ disabled }: { disabled?: boolean }) {
  const [collections, setCollections] = useState<DocumentCollection[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const refresh = useCallback(async () => {
    const next = await listCollections()
    const storedActiveId = getActiveCollectionId()
    const validActiveId = next.some((collection) => collection.id === storedActiveId) ? storedActiveId : null
    if (storedActiveId && !validActiveId) clearActiveCollectionId()
    setCollections(next)
    setActiveId(validActiveId)
  }, [])

  useEffect(() => {
    refresh()
    function handleUpdate() {
      refresh()
    }
    window.addEventListener(RAG_ACTIVE_COLLECTION_EVENT, handleUpdate)
    window.addEventListener("storage", handleUpdate)
    return () => {
      window.removeEventListener(RAG_ACTIVE_COLLECTION_EVENT, handleUpdate)
      window.removeEventListener("storage", handleUpdate)
    }
  }, [refresh])

  const activeCollection = useMemo(
    () => collections.find((collection) => collection.id === activeId) ?? null,
    [activeId, collections],
  )

  if (collections.length === 0) return null

  function cycleActiveCollection() {
    if (collections.length === 0) return
    if (!activeCollection) {
      setActiveCollectionId(collections[0].id)
      setActiveId(collections[0].id)
      return
    }
    const currentIndex = collections.findIndex((collection) => collection.id === activeCollection.id)
    const next = collections[(currentIndex + 1) % collections.length]
    setActiveCollectionId(next.id)
    setActiveId(next.id)
  }

  function clearActive() {
    clearActiveCollectionId()
    setActiveId(null)
  }

  return (
    <>
      <div className="flex shrink-0 items-center overflow-hidden rounded-full border bg-background/80 shadow-sm">
        <button
          type="button"
          disabled={disabled}
          onClick={cycleActiveCollection}
          onDoubleClick={() => setDialogOpen(true)}
          className={cn(
            "flex h-9 max-w-[132px] items-center gap-1.5 px-2 text-xs transition-colors hover:bg-muted disabled:opacity-50",
            activeCollection ? "text-primary" : "text-muted-foreground",
          )}
          title={activeCollection ? `RAG: ${activeCollection.name} · bấm để đổi, double-click để mở` : "Bấm để bật RAG"}
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{activeCollection ? `RAG: ${shortName(activeCollection.name)}` : "RAG tắt"}</span>
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          onClick={() => setDialogOpen(true)}
          className="h-9 w-7 rounded-none border-l px-0 text-muted-foreground"
          title="Mở bộ tài liệu"
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </Button>
        {activeCollection && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={disabled}
            onClick={clearActive}
            className="h-9 w-7 rounded-none border-l px-0 text-muted-foreground hover:text-destructive"
            title="Tắt RAG"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <CollectionsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}

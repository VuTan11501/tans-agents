"use client"

import { Button } from "@/components/ui/button"

interface BulkActionsProps {
  selectedCount: number
  selectionMode: boolean
  onCopy: () => void
  onExportMarkdown: () => void
  onDelete: () => void
  onClear: () => void
}

export function BulkActions({ selectedCount, selectionMode, onCopy, onExportMarkdown, onDelete, onClear }: BulkActionsProps) {
  return (
    <>
      <style>{`
        [data-chat-messages] [data-message-id] {
          position: relative;
          border-radius: 1rem;
          transition: outline-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
        }
        [data-chat-messages] [data-message-id][data-selected="true"] {
          outline: 2px solid hsl(var(--primary));
          outline-offset: 4px;
          box-shadow: 0 0 0 6px hsl(var(--primary) / 0.12);
        }
        [data-chat-messages] [data-message-id][data-selected="true"]::before {
          content: "✓";
          position: absolute;
          top: -0.75rem;
          right: -0.75rem;
          z-index: 10;
          display: flex;
          height: 1.5rem;
          width: 1.5rem;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          border: 2px solid hsl(var(--background));
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          font-size: 0.8rem;
          font-weight: 700;
        }
        [data-chat-messages][data-selection-mode="true"] [data-message-id] {
          cursor: pointer;
        }
      `}</style>
      {selectedCount > 0 && (
        <div className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border bg-background/95 px-3 py-2 shadow-2xl backdrop-blur">
          <span className="px-2 text-xs font-medium text-muted-foreground">{selectedCount} đã chọn</span>
          <Button type="button" size="sm" variant="outline" onClick={onCopy}>Sao chép</Button>
          <Button type="button" size="sm" variant="outline" onClick={onExportMarkdown}>Xuất MD</Button>
          <Button type="button" size="sm" variant="destructive" onClick={onDelete}>Xóa</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>Bỏ chọn</Button>
        </div>
      )}
      {selectionMode && selectedCount === 0 && <span className="sr-only">Chọn nhiều đang bật</span>}
    </>
  )
}

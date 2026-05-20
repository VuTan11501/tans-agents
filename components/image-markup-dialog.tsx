"use client"

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { RotateCcw, Save, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ImageCanvasMarkup, type DrawTool } from "@/lib/image-canvas"
import { cn } from "@/lib/utils"

interface ImageMarkupDialogProps {
  file: File | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (dataUrl: string) => void
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"]
const SIZES = [4, 8, 14]

export function ImageMarkupDialog({ file, open, onOpenChange, onSave }: ImageMarkupDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const markupRef = useRef<ImageCanvasMarkup | null>(null)
  const drawingRef = useRef(false)
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])
  const [tool, setTool] = useState<DrawTool>("pen")
  const [canUndo, setCanUndo] = useState(false)

  useEffect(() => {
    if (!open || !file || !canvasRef.current) return
    const url = URL.createObjectURL(file)
    const markup = new ImageCanvasMarkup(canvasRef.current)
    markup.setColor(color)
    markup.setSize(size)
    markup.setTool(tool)
    markupRef.current = markup
    setCanUndo(false)
    void markup.loadImage(url).finally(() => URL.revokeObjectURL(url))
    return () => {
      drawingRef.current = false
      markupRef.current = null
      URL.revokeObjectURL(url)
    }
  }, [file, open])

  useEffect(() => {
    markupRef.current?.setColor(color)
  }, [color])

  useEffect(() => {
    markupRef.current?.setSize(size)
  }, [size])

  useEffect(() => {
    markupRef.current?.setTool(tool)
  }, [tool])

  function refreshUndo() {
    setCanUndo(markupRef.current?.canUndo() ?? false)
  }

  function startDraw(event: ReactMouseEvent<HTMLCanvasElement>) {
    if (event.button !== 0) return
    const markup = markupRef.current
    if (!markup) return
    drawingRef.current = true
    markup.start(markup.getPoint(event.nativeEvent))
    refreshUndo()
  }

  function moveDraw(event: ReactMouseEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const markup = markupRef.current
    if (!markup) return
    markup.move(markup.getPoint(event.nativeEvent))
  }

  function endDraw() {
    if (!drawingRef.current) return
    drawingRef.current = false
    markupRef.current?.end()
    refreshUndo()
  }

  function startTouch(event: ReactTouchEvent<HTMLCanvasElement>) {
    const touch = event.touches[0]
    const markup = markupRef.current
    if (!touch || !markup) return
    event.preventDefault()
    drawingRef.current = true
    markup.start(markup.getPoint(touch))
    refreshUndo()
  }

  function moveTouch(event: ReactTouchEvent<HTMLCanvasElement>) {
    const touch = event.touches[0]
    const markup = markupRef.current
    if (!drawingRef.current || !touch || !markup) return
    event.preventDefault()
    markup.move(markup.getPoint(touch))
  }

  function handleUndo() {
    markupRef.current?.undo()
    refreshUndo()
  }

  function handleClear() {
    markupRef.current?.clear()
    refreshUndo()
  }

  function handleSave() {
    const dataUrl = markupRef.current?.exportPng()
    if (!dataUrl) return
    onSave(dataUrl)
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[96vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background p-4 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:slide-out-to-bottom-4 duration-300 ease-out">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold">✏️ Chú thích ảnh</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                Vẽ trực tiếp lên ảnh trước khi gửi.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Hủy">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card/60 p-2">
            <div className="flex items-center gap-1">
              <span className="px-1 text-xs font-medium text-muted-foreground">Bút</span>
              {COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => {
                    setTool("pen")
                    setColor(swatch)
                  }}
                  className={cn("h-7 w-7 rounded-full border-2", color === swatch && tool === "pen" ? "border-foreground" : "border-transparent")}
                  style={{ backgroundColor: swatch }}
                  aria-label={`Bút ${swatch}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1">
              {SIZES.map((brushSize) => (
                <button
                  key={brushSize}
                  type="button"
                  onClick={() => setSize(brushSize)}
                  className={cn("flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted", size === brushSize && "border-primary bg-primary/10")}
                  aria-label={`Cỡ bút ${brushSize}`}
                >
                  <span className="rounded-full bg-foreground" style={{ width: brushSize, height: brushSize }} />
                </button>
              ))}
            </div>

            <Button type="button" variant={tool === "eraser" ? "secondary" : "outline"} size="sm" onClick={() => setTool("eraser")}>Tẩy</Button>
            <Button type="button" variant="outline" size="sm" onClick={handleUndo} disabled={!canUndo}><RotateCcw className="mr-1 h-3.5 w-3.5" />Hoàn tác</Button>
            <Button type="button" variant="outline" size="sm" onClick={handleClear}><Trash2 className="mr-1 h-3.5 w-3.5" />Xóa hết</Button>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="button" size="sm" onClick={handleSave}><Save className="mr-1 h-3.5 w-3.5" />Lưu</Button>
            </div>
          </div>

          <div className="mt-4 overflow-auto rounded-xl border bg-muted/30 p-2 text-center">
            <canvas
              ref={canvasRef}
              className="mx-auto max-h-[600px] max-w-full cursor-crosshair rounded-lg bg-background shadow-sm"
              style={{ touchAction: "none" }}
              onMouseDown={startDraw}
              onMouseMove={moveDraw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startTouch}
              onTouchMove={moveTouch}
              onTouchEnd={endDraw}
              onTouchCancel={endDraw}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

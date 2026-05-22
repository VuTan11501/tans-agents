"use client"

import { useMemo, useRef, useState } from "react"
import type { PointerEvent, WheelEvent } from "react"
import type { BranchTree } from "@/hooks/use-chat-history"
import {
  layoutMindMap,
  MIND_MAP_NODE_HEIGHT,
  MIND_MAP_NODE_WIDTH,
} from "@/lib/mind-map-layout"

interface MindMapTreeProps {
  tree: BranchTree | null
}

const DEPTH_COLORS = [
  "#dbeafe",
  "#dcfce7",
  "#fef3c7",
  "#fce7f3",
  "#ede9fe",
  "#cffafe",
  "#ffedd5",
]

export function MindMapTree({ tree }: MindMapTreeProps) {
  const layout = useMemo(() => layoutMindMap(tree), [tree])
  const [view, setView] = useState({ x: 56, y: 56, scale: 1 })
  const dragRef = useRef<{ x: number; y: number; viewX: number; viewY: number } | null>(null)

  if (!tree || layout.nodes.length === 0) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed bg-muted/30 p-8 text-center text-muted-foreground">
        Chưa có nhánh nào. Tạo bằng nút 🔱 trên tin nhắn AI.
      </div>
    )
  }

  function openSession(id: string, isVirtual?: boolean) {
    if (isVirtual) return
    window.location.href = `/?session=${encodeURIComponent(id)}`
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y }
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag) return
    setView((current) => ({
      ...current,
      x: drag.viewX + event.clientX - drag.x,
      y: drag.viewY + event.clientY - drag.y,
    }))
  }

  function stopDrag(event: PointerEvent<SVGSVGElement>) {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function onWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault()
    const nextScale = Math.min(2.2, Math.max(0.35, view.scale * (event.deltaY > 0 ? 0.9 : 1.1)))
    setView((current) => ({ ...current, scale: nextScale }))
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <svg
        role="img"
        aria-label="Sơ đồ nhánh hội thoại"
        className="h-[70vh] min-h-[460px] w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onWheel={onWheel}
      >
        <defs>
          <filter id="mind-map-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodOpacity="0.14" />
          </filter>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          <rect x={-48} y={-48} width={layout.width} height={layout.height} rx="18" fill="transparent" />

          {layout.edges.map((edge) => {
            const mid = Math.max(40, (edge.toX - edge.fromX) / 2)
            return (
              <path
                key={edge.id}
                d={`M ${edge.fromX} ${edge.fromY} C ${edge.fromX + mid} ${edge.fromY}, ${edge.toX - mid} ${edge.toY}, ${edge.toX} ${edge.toY}`}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )
          })}

          {layout.nodes.map((node) => (
            <g
              key={node.id}
              transform={`translate(${node.x} ${node.y})`}
              className={node.isVirtual ? "" : "cursor-pointer"}
              onClick={(event) => {
                event.stopPropagation()
                openSession(node.id, node.isVirtual)
              }}
            >
              <rect
                width={MIND_MAP_NODE_WIDTH}
                height={MIND_MAP_NODE_HEIGHT}
                rx="14"
                fill={node.isVirtual ? "hsl(var(--secondary))" : DEPTH_COLORS[node.depth % DEPTH_COLORS.length]}
                stroke="hsl(var(--border))"
                strokeWidth="1.5"
                filter="url(#mind-map-shadow)"
              />
              <text
                x="16"
                y="28"
                className="select-none fill-zinc-950 text-sm font-semibold"
              >
                {node.title}
              </text>
              <text
                x="16"
                y="46"
                className="select-none fill-zinc-600 text-[11px]"
              >
                {node.isVirtual ? "Tất cả gốc" : `Cấp ${node.depth}`}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
        <span>Kéo để di chuyển · Cuộn chuột để phóng to/thu nhỏ · Bấm node để mở chat</span>
        <span>{layout.nodes.length} node · {layout.edges.length} cạnh</span>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { MindMapTree } from "@/components/mind-map-tree"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useChatHistory, type BranchTree, type ChatSession } from "@/hooks/use-chat-history"

const ALL_ROOTS = "__all__"

function createVirtualRoot(children: BranchTree[]): BranchTree {
  const session: ChatSession = {
    id: ALL_ROOTS,
    title: "Tất cả hội thoại gốc",
    messages: [],
    provider: "virtual",
    model: "virtual",
    createdAt: 0,
    updatedAt: 0,
  }
  return { session, children }
}

export default function MindMapPage() {
  const { sessions, getBranchTree } = useChatHistory()
  const [selectedRoot, setSelectedRoot] = useState(ALL_ROOTS)

  const rootSessions = useMemo(
    () => sessions.filter((session) => !session.parentId).sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions]
  )

  useEffect(() => {
    if (selectedRoot !== ALL_ROOTS && !sessions.some((session) => session.id === selectedRoot)) {
      setSelectedRoot(ALL_ROOTS)
    }
  }, [selectedRoot, sessions])

  const tree = useMemo<BranchTree | null>(() => {
    if (rootSessions.length === 0) return null
    if (selectedRoot === ALL_ROOTS) {
      const roots = rootSessions
        .map((session) => getBranchTree(session.id))
        .filter((item): item is BranchTree => !!item)
      return createVirtualRoot(roots)
    }
    return getBranchTree(selectedRoot)
  }, [getBranchTree, rootSessions, selectedRoot])

  const selectedTitle = selectedRoot === ALL_ROOTS
    ? "Tất cả nhánh"
    : rootSessions.find((session) => session.id === selectedRoot)?.title ?? "Không tìm thấy"

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Sơ đồ nhánh hội thoại</h1>
          <p className="text-sm text-muted-foreground">
            Xem các phiên chat cha-con dưới dạng mind map SVG. Chọn node để mở lại cuộc trò chuyện.
          </p>
        </div>
        <Button asChild variant="secondary">
          <a href="/">Về chat</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chọn cây nhánh</CardTitle>
          <CardDescription>Chỉ hiển thị các hội thoại gốc, hoặc gộp tất cả bằng một root ảo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[minmax(260px,420px)_1fr] md:items-end">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Phiên gốc</span>
            <Select value={selectedRoot} onValueChange={setSelectedRoot}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn phiên gốc" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ROOTS}>Tất cả</SelectItem>
                {rootSessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.title || "Cuộc trò chuyện mới"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
            Đang xem: <span className="font-medium text-foreground">{selectedTitle}</span> · {rootSessions.length} phiên gốc
          </div>
        </CardContent>
      </Card>

      <MindMapTree tree={tree} />
    </main>
  )
}

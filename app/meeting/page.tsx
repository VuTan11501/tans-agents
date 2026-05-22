"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  createMeetingGist,
  createMeetingRoom,
  getMeetingGistId,
  getMeetingNick,
  getMeetingPat,
  pullMeetingRooms,
  setMeetingGistId,
  setMeetingNick,
  setMeetingPat,
  type MeetingRoom,
} from "@/lib/meeting-sync"

export default function MeetingLobbyPage() {
  const router = useRouter()
  const [gistId, setGistIdState] = useState("")
  const [pat, setPat] = useState("")
  const [nick, setNickState] = useState("")
  const [title, setTitle] = useState("")
  const [rooms, setRooms] = useState<MeetingRoom[]>([])
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setGistIdState(getMeetingGistId())
    setPat(getMeetingPat())
    setNickState(getMeetingNick())
  }, [])

  const saveGistId = (value: string) => {
    setGistIdState(value)
    setMeetingGistId(value)
  }

  const savePat = (value: string) => {
    setPat(value)
    setMeetingPat(value)
  }

  const saveNick = (value: string) => {
    setNickState(value)
    setMeetingNick(value)
  }

  const loadRooms = useCallback(async () => {
    if (!gistId || !pat) {
      setStatus("⚠️ Cần GitHub PAT và Meeting Gist ID")
      return
    }
    setBusy(true)
    setStatus("Đang tải danh sách phòng...")
    try {
      const data = await pullMeetingRooms(gistId, pat)
      setRooms(data.rooms)
      setStatus(`✅ Đã tải ${data.rooms.length} phòng`)
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? e}`)
    } finally {
      setBusy(false)
    }
  }, [gistId, pat])

  useEffect(() => {
    if (gistId && pat) void loadRooms()
  }, [gistId, pat, loadRooms])

  const handleCreateGist = async () => {
    if (!pat) {
      setStatus("⚠️ Nhập GitHub PAT trước")
      return
    }
    setBusy(true)
    setStatus("Đang tạo Gist mới...")
    try {
      const id = await createMeetingGist(pat)
      saveGistId(id)
      setRooms([])
      setStatus(`✅ Đã tạo Gist: ${id}`)
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? e}`)
    } finally {
      setBusy(false)
    }
  }

  const handleCreateRoom = async () => {
    if (!gistId || !pat || !nick.trim()) {
      setStatus("⚠️ Cần Gist ID, PAT và Nick")
      return
    }
    setBusy(true)
    setStatus("Đang tạo phòng...")
    try {
      const room = await createMeetingRoom(gistId, pat, title, nick)
      setStatus("✅ Đã tạo phòng")
      router.push(`/meeting/${room.id}`)
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? e}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Phòng họp AI</h1>
          <p className="text-sm text-muted-foreground">Chat co-presence qua một Gist chung, polling mỗi 5 giây.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/">← Chat</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cấu hình</CardTitle>
          <CardDescription>PAT cần scope <code>gist</code>. Dữ liệu được lưu local trên trình duyệt này.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-xs font-medium text-muted-foreground">GitHub PAT</span>
              <Input type="password" value={pat} onChange={(e) => savePat(e.target.value)} placeholder="ghp_..." />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-xs font-medium text-muted-foreground">Nick</span>
              <Input value={nick} onChange={(e) => saveNick(e.target.value)} placeholder="vd: Tan" maxLength={40} />
            </label>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              value={gistId}
              onChange={(e) => saveGistId(e.target.value)}
              placeholder="Meeting Gist ID"
              className="font-mono"
            />
            <Button type="button" variant="outline" onClick={handleCreateGist} disabled={busy || !pat}>
              Tạo Gist mới
            </Button>
            <Button type="button" variant="secondary" onClick={loadRooms} disabled={busy || !gistId || !pat}>
              Tải phòng
            </Button>
          </div>
          {status && <p className="text-xs text-muted-foreground">{status}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tạo phòng</CardTitle>
          <CardDescription>Tạo phòng mới rồi chia sẻ cùng Gist ID cho người khác tham gia.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 md:flex-row">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên phòng, vd: Daily sync" maxLength={80} />
          <Button onClick={handleCreateRoom} disabled={busy || !gistId || !pat || !nick.trim()}>
            Tạo phòng
          </Button>
        </CardContent>
      </Card>

      <Card className="min-h-0 flex-1">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Phòng hiện có</CardTitle>
              <CardDescription>Nhấn Tham gia để vào phòng họp.</CardDescription>
            </div>
            <Badge variant="secondary">{rooms.length} phòng</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[360px] pr-3">
            {rooms.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Chưa có phòng nào. Hãy tạo phòng đầu tiên hoặc tải lại danh sách.
              </p>
            ) : (
              <ul className="space-y-2">
                {rooms.map((room) => (
                  <li key={room.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{room.title}</div>
                      <div className="text-xs text-muted-foreground">
                        bởi <strong>{room.createdBy}</strong> · Người tham gia: {room.nParticipants ?? 0} ·{" "}
                        {new Date(room.createdAt).toLocaleString("vi-VN")}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/meeting/${room.id}`}>Tham gia</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </main>
  )
}

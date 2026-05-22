"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { ModelPicker } from "@/components/model-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PROVIDERS, type ProviderKey } from "@/lib/providers"
import {
  clearResults,
  deleteResult,
  deleteScheduled,
  listResults,
  listScheduled,
  saveScheduled,
  type ScheduledChat,
  type ScheduledResult,
} from "@/lib/scheduled-chats"

const DEFAULT_PROVIDER: ProviderKey = "google"
const DEFAULT_MODEL = PROVIDERS[DEFAULT_PROVIDER].default
const DOWS = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 0, label: "CN" },
]

function emptyChat(): ScheduledChat {
  return {
    id: crypto.randomUUID(),
    name: "Lịch chat mới",
    prompt: "",
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    schedule: { type: "daily", time: "09:00", dow: [1, 2, 3, 4, 5] },
    enabled: true,
    createdAt: Date.now(),
  }
}

export default function ScheduledPage() {
  const [chats, setChats] = useState<ScheduledChat[]>([])
  const [results, setResults] = useState<ScheduledResult[]>([])
  const [editing, setEditing] = useState<ScheduledChat>(() => emptyChat())

  const chatNames = useMemo(() => new Map(chats.map((chat) => [chat.id, chat.name])), [chats])
  const refresh = () => {
    setChats(listScheduled())
    setResults(listResults())
  }

  useEffect(() => {
    refresh()
  }, [])

  function save() {
    saveScheduled(editing)
    toast.success("Đã lưu lịch chạy")
    refresh()
  }

  function update(patch: Partial<ScheduledChat>) {
    setEditing((current) => ({ ...current, ...patch }))
  }

  function updateSchedule(patch: Partial<ScheduledChat["schedule"]>) {
    setEditing((current) => ({ ...current, schedule: { ...current.schedule, ...patch } }))
  }

  function toggleDow(value: number) {
    const current = editing.schedule.dow ?? []
    updateSchedule({ dow: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] })
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 p-4 md:p-8 xl:grid-cols-[420px_1fr]">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Scheduled chats</h1>
            <p className="text-sm text-muted-foreground">Local cron chạy khi PWA đang mở.</p>
          </div>
          <Button onClick={() => setEditing(emptyChat())} className="gap-2">
            <Plus className="h-4 w-4" /> Mới
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lịch chạy</CardTitle>
            <CardDescription>Tạo prompt chạy một lần, hằng ngày hoặc hằng tuần.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium">Tên</span>
              <Input value={editing.name} onChange={(event) => update({ name: event.target.value })} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">Prompt</span>
              <Textarea value={editing.prompt} onChange={(event) => update({ prompt: event.target.value })} className="min-h-32" />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Kiểu lịch</span>
                <Select
                  value={editing.schedule.type}
                  onValueChange={(value: "once" | "daily" | "weekly") => updateSchedule({ type: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Một lần</SelectItem>
                    <SelectItem value="daily">Hằng ngày</SelectItem>
                    <SelectItem value="weekly">Hằng tuần</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              {editing.schedule.type === "once" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Ngày giờ</span>
                  <Input type="datetime-local" value={editing.schedule.datetime ?? ""} onChange={(event) => updateSchedule({ datetime: event.target.value })} />
                </label>
              ) : (
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Giờ chạy</span>
                  <Input type="time" value={editing.schedule.time ?? "09:00"} onChange={(event) => updateSchedule({ time: event.target.value })} />
                </label>
              )}
            </div>

            {editing.schedule.type === "weekly" && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Thứ trong tuần</span>
                <div className="flex flex-wrap gap-2">
                  {DOWS.map((dow) => (
                    <Button
                      key={dow.value}
                      type="button"
                      variant={(editing.schedule.dow ?? []).includes(dow.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDow(dow.value)}
                    >
                      {dow.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <ModelPicker
                provider={editing.provider}
                model={editing.model}
                onChange={(provider, model) => update({ provider, model })}
                align="start"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
                Bật lịch
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={save}>Lưu lịch</Button>
              <Button variant="secondary" onClick={() => setEditing(emptyChat())}>Reset form</Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {chats.map((chat) => (
            <Card key={chat.id}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">{chat.name}</CardTitle>
                <CardDescription>{chat.enabled ? "Đang bật" : "Đang tắt"} · {chat.schedule.type}</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2 p-4 pt-0">
                <Button variant="secondary" size="sm" onClick={() => setEditing(chat)}>Sửa</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive"
                  onClick={() => { deleteScheduled(chat.id); refresh(); toast.success("Đã xóa lịch") }}
                >
                  Xóa
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Kết quả gần đây</h2>
            <p className="text-sm text-muted-foreground">Tối đa 100 kết quả mới nhất.</p>
          </div>
          <Button variant="outline" onClick={() => { clearResults(); refresh(); toast.success("Đã xóa kết quả") }}>
            Xóa tất cả
          </Button>
        </div>

        {results.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chưa có kết quả</CardTitle>
              <CardDescription>Kết quả sẽ xuất hiện sau khi lịch đến giờ và app đang mở.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          results.map((result) => {
            const output = result.error ? `Lỗi: ${result.error}` : result.output
            const truncated = output.length > 500 ? `${output.slice(0, 500)}...` : output
            return (
              <Card key={result.id}>
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{chatNames.get(result.chatId) ?? "Lịch đã xóa"}</CardTitle>
                      <CardDescription>{new Date(result.ranAt).toLocaleString("vi-VN")}</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => { deleteResult(result.id); refresh(); toast.success("Đã xóa kết quả") }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">Xem output</summary>
                    <pre className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{output}</pre>
                  </details>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{truncated}</p>
                </CardContent>
              </Card>
            )
          })
        )}
      </section>
    </main>
  )
}

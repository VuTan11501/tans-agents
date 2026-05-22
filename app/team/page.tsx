"use client"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  getTeamGistId,
  setTeamGistId,
  getTeamNick,
  setTeamNick,
  pullTeamSessions,
  pushTeamSession,
  removeTeamSession,
  createTeamGist,
  type TeamSession,
} from "@/lib/team-sync"
import { useChatHistory } from "@/hooks/use-chat-history"

const PAT_KEY = "tans-agents:team-pat-v1"

export default function TeamPage() {
  const history = useChatHistory()
  const [gistId, setGistIdState] = useState("")
  const [nick, setNickState] = useState("")
  const [pat, setPat] = useState("")
  const [teamSessions, setTeamSessions] = useState<TeamSession[]>([])
  const [status, setStatus] = useState<string>("")
  const [busy, setBusy] = useState(false)
  const [shareSelectId, setShareSelectId] = useState("")

  useEffect(() => {
    setGistIdState(getTeamGistId())
    setNickState(getTeamNick())
    try {
      setPat(localStorage.getItem(PAT_KEY) ?? "")
    } catch {}
  }, [])

  const savePat = (v: string) => {
    setPat(v)
    try {
      localStorage.setItem(PAT_KEY, v)
    } catch {}
  }

  const pull = useCallback(async () => {
    if (!gistId || !pat) {
      setStatus("⚠️ Cần Gist ID + GitHub PAT (scope: gist)")
      return
    }
    setBusy(true)
    setStatus("Đang tải...")
    try {
      const data = await pullTeamSessions(gistId, pat)
      setTeamSessions(data.sessions)
      setStatus(`✅ Tải ${data.sessions.length} phiên`)
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? e}`)
    } finally {
      setBusy(false)
    }
  }, [gistId, pat])

  const handleCreateGist = async () => {
    if (!pat) {
      setStatus("⚠️ Cần GitHub PAT trước")
      return
    }
    setBusy(true)
    setStatus("Đang tạo Gist mới...")
    try {
      const id = await createTeamGist(pat)
      setGistIdState(id)
      setTeamGistId(id)
      setStatus(`✅ Đã tạo Gist: ${id}`)
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? e}`)
    } finally {
      setBusy(false)
    }
  }

  const handlePush = async () => {
    const session = history.sessions.find((s) => s.id === shareSelectId)
    if (!session) {
      setStatus("⚠️ Chọn 1 phiên")
      return
    }
    if (!nick) {
      setStatus("⚠️ Nhập nickname trước")
      return
    }
    setBusy(true)
    setStatus(`Đang chia sẻ "${session.title}"...`)
    try {
      const data = await pushTeamSession(gistId, pat, session, nick)
      setTeamSessions(data.sessions)
      setStatus(`✅ Đã chia sẻ. Team hiện có ${data.sessions.length} phiên`)
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? e}`)
    } finally {
      setBusy(false)
    }
  }

  const handleImport = (s: TeamSession) => {
    const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    history.upsert({
      id: newId,
      title: `${s.title} (từ ${s.sharedBy})`,
      messages: s.messages,
      provider: s.provider,
      model: s.model,
      tags: [...(s.tags ?? []), "team"],
      enabledTools: s.enabledTools,
    } as any)
    setStatus(`✅ Đã import "${s.title}" vào lịch sử`)
  }

  const handleRemove = async (s: TeamSession) => {
    if (!confirm(`Xoá "${s.title}" khỏi team?`)) return
    setBusy(true)
    try {
      const data = await removeTeamSession(gistId, pat, s.id, s.sharedBy)
      setTeamSessions(data.sessions)
      setStatus(`✅ Đã xoá`)
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? e}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">👥 Team Workspace</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Quay lại Chat
        </Link>
      </header>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Cấu hình</h2>
        <div className="space-y-2">
          <label className="block text-xs text-muted-foreground">
            GitHub PAT (scope: <code>gist</code>) — lưu local
          </label>
          <input
            type="password"
            value={pat}
            onChange={(e) => savePat(e.target.value)}
            placeholder="ghp_..."
            className="w-full rounded border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-xs text-muted-foreground">Team Gist ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={gistId}
              onChange={(e) => {
                setGistIdState(e.target.value)
                setTeamGistId(e.target.value)
              }}
              placeholder="abc123..."
              className="flex-1 rounded border bg-background px-3 py-2 text-sm font-mono"
            />
            <button
              onClick={handleCreateGist}
              disabled={busy || !pat}
              className="rounded border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50"
            >
              ➕ Tạo Gist mới
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-xs text-muted-foreground">Nickname của bạn</label>
          <input
            type="text"
            value={nick}
            onChange={(e) => {
              setNickState(e.target.value)
              setTeamNick(e.target.value)
            }}
            placeholder="vd: Tan"
            className="w-full rounded border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={pull}
            disabled={busy || !gistId || !pat}
            className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            🔄 Đồng bộ về
          </button>
        </div>
        {status && <p className="text-xs text-muted-foreground">{status}</p>}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Chia sẻ phiên của bạn lên team</h2>
        <div className="flex gap-2">
          <select
            value={shareSelectId}
            onChange={(e) => setShareSelectId(e.target.value)}
            className="flex-1 rounded border bg-background px-3 py-2 text-sm"
          >
            <option value="">-- Chọn phiên --</option>
            {history.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.messages.length} tin)
              </option>
            ))}
          </select>
          <button
            onClick={handlePush}
            disabled={busy || !shareSelectId || !gistId || !pat || !nick}
            className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            📤 Chia sẻ
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Phiên chung của team ({teamSessions.length})</h2>
        {teamSessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Chưa có phiên nào. Nhấn "Đồng bộ về" hoặc "Chia sẻ" để bắt đầu.
          </p>
        ) : (
          <ul className="space-y-2">
            {teamSessions.map((s) => (
              <li key={`${s.id}-${s.sharedBy}`} className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground">
                    bởi <strong>{s.sharedBy}</strong> · {s.messages.length} tin ·{" "}
                    {new Date(s.sharedAt).toLocaleString("vi-VN")}
                  </div>
                </div>
                <button
                  onClick={() => handleImport(s)}
                  className="rounded border px-2 py-1 text-xs hover:bg-muted"
                >
                  📥 Import
                </button>
                {s.sharedBy === nick && (
                  <button
                    onClick={() => handleRemove(s)}
                    className="rounded border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                  >
                    🗑
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-semibold">ℹ️ Cách dùng:</p>
        <ol className="ml-4 mt-2 list-decimal space-y-1">
          <li>Tạo GitHub PAT (Settings → Developer settings → Tokens → Fine-grained hoặc Classic) với scope <code>gist</code>.</li>
          <li>Nhấn "Tạo Gist mới" hoặc dán Gist ID có sẵn (chia sẻ với teammate).</li>
          <li>Mỗi thành viên dán cùng Gist ID, đặt nickname riêng.</li>
          <li>Chọn phiên → "Chia sẻ" để push. "Đồng bộ về" để pull list mới nhất.</li>
          <li>"Import" để copy phiên teammate vào lịch sử cá nhân (giữ riêng).</li>
        </ol>
      </section>
    </main>
  )
}

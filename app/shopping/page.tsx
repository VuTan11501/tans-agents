"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

interface SavedList {
  id: string
  createdAt: string
  title: string
  content: string
}

export default function ShoppingPage() {
  const [input, setInput] = useState("")
  const [servings, setServings] = useState("2")
  const [output, setOutput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<"new" | "saved">("new")
  const [saved, setSaved] = useState<SavedList[]>([])
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("tans-agents:shopping-lists-v1")
    if (stored) setSaved(JSON.parse(stored))
  }, [])

  async function readSseStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim()
          if (data === "[DONE]") return
          if (data) onChunk(data)
        }
      }
    }
  }

  async function submit() {
    if (!input.trim() || loading) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setOutput("")
    setError(null)

    try {
      const response = await fetch("/api/chat-sse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: PROVIDER,
          model: MODEL,
          enabledTools: [],
          messages: [
            {
              role: "user",
              content: `Tạo danh sách mua sắm cho ${servings} người dựa trên: ${input}\n\nPhân loại theo khu vực siêu thị (Rau & Quả, Thịt & Cá, Sữa & Trứng, Gia vị & Nước sốt, Khác). Kèm ước lượng số lượng. Dùng markdown checkbox (- [ ] item).`,
            },
          ],
          personaSystemPrompt:
            "Bạn là trợ lý lập danh sách mua sắm. Tạo danh sách chi tiết, dễ sử dụng tại siêu thị.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream")

      await readSseStream(response.body.getReader(), (chunk) => {
        setOutput((curr) => curr + chunk)
      })
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(err?.message ?? "Có lỗi")
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  function saveList() {
    if (!output.trim()) return
    const newList: SavedList = {
      id: Date.now().toString(),
      createdAt: new Date().toLocaleString("vi-VN"),
      title: `Danh sách ${new Date().toLocaleDateString("vi-VN")}`,
      content: output,
    }
    const updated = [newList, ...saved]
    setSaved(updated)
    localStorage.setItem("tans-agents:shopping-lists-v1", JSON.stringify(updated))
  }

  function deleteList(id: string) {
    const updated = saved.filter((l) => l.id !== id)
    setSaved(updated)
    localStorage.setItem("tans-agents:shopping-lists-v1", JSON.stringify(updated))
  }

  function copyOutput() {
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function clear() {
    setInput("")
    setOutput("")
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Danh sách mua sắm thông minh</h1>

          <div className="flex gap-2 border-b">
            <button
              onClick={() => setTab("new")}
              className={`px-4 py-2 font-medium transition ${
                tab === "new"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Tạo mới
            </button>
            <button
              onClick={() => setTab("saved")}
              className={`px-4 py-2 font-medium transition ${
                tab === "saved"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Đã lưu ({saved.length})
            </button>
          </div>

          {tab === "new" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Công thức hoặc thực đơn tuần
                </label>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="VD: Phở bò, Cơm chiên, Canh cá..."
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Số người ăn
                </label>
                <input
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  min="1"
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={submit}
                  disabled={loading || !input.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? "Đang tạo..." : "Tạo danh sách"}
                </Button>
                <Button onClick={clear} variant="outline" className="flex-1">
                  Xoá
                </Button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {output && (
                <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-slate-700">Danh sách</p>
                    <div className="flex gap-2">
                      <Button
                        onClick={copyOutput}
                        size="sm"
                        variant="outline"
                        className="text-xs"
                      >
                        {copied ? "✓ Đã copy" : "Copy"}
                      </Button>
                      <Button
                        onClick={saveList}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-xs"
                      >
                        💾 Lưu
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">
                    {output}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "saved" && (
            <div className="space-y-3">
              {saved.length === 0 ? (
                <p className="text-sm text-slate-600 py-4">Chưa có danh sách đã lưu</p>
              ) : (
                saved.map((list) => (
                  <div key={list.id} className="bg-slate-50 border border-slate-200 rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-slate-900">{list.title}</p>
                        <p className="text-xs text-slate-600">{list.createdAt}</p>
                      </div>
                      <Button
                        onClick={() => deleteList(list.id)}
                        size="sm"
                        variant="outline"
                        className="text-xs text-red-600"
                      >
                        ✕ Xoá
                      </Button>
                    </div>
                    <div className="text-xs text-slate-700 whitespace-pre-wrap max-h-32 overflow-auto">
                      {list.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

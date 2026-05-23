"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

export default function FinancePage() {
  const [income, setIncome] = useState("")
  const [expense, setExpense] = useState("")
  const [goal, setGoal] = useState("")
  const [mode, setMode] = useState("analyze")
  const [output, setOutput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

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
    if ((!income && !expense) || loading) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setOutput("")
    setError(null)

    const modeMap = {
      analyze: "Phân tích chi tiêu và đề xuất phân bổ ngân sách theo quy tắc 50/30/20.",
      saving: "Lập kế hoạch tiết kiệm chi tiết với mục tiêu và timeline.",
      invest: "Giải thích các khái niệm đầu tư cơ bản (cổ phiếu, bond, quỹ) phù hợp mức thu nhập.",
    }

    const content = `Tình hình tài chính: Thu nhập/tháng: ${income} VND, Chi tiêu/tháng: ${expense} VND${goal ? `, Mục tiêu: ${goal}` : ""}`

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
              content: `${modeMap[mode as keyof typeof modeMap]}\n\n${content}`,
            },
          ],
          personaSystemPrompt:
            "Bạn là trợ lý tài chính cá nhân. Đưa ra gợi ý thực tế, chi tiết, tính toán bằng VND. KHÔNG phải tư vấn đầu tư chuyên nghiệp.",
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

  function copyOutput() {
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function clear() {
    setIncome("")
    setExpense("")
    setGoal("")
    setOutput("")
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-50 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800">
            ⚠️ Thông tin tham khảo. Không phải tư vấn đầu tư chuyên nghiệp. Tham khảo chuyên gia trước khi quyết định lớn.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Trợ lý tài chính cá nhân</h1>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Thu nhập/tháng (VND)
              </label>
              <input
                type="number"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                placeholder="5000000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Chi tiêu/tháng (VND)
              </label>
              <input
                type="number"
                value={expense}
                onChange={(e) => setExpense(e.target.value)}
                placeholder="3000000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Mục tiêu (tuỳ chọn)
              </label>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="VD: tiết kiệm 500 triệu"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Chế độ
            </label>
            <div className="flex gap-2 flex-wrap">
              {(["analyze", "saving", "invest"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    mode === m
                      ? "bg-green-600 text-white"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  {m === "analyze" && "Phân tích"}
                  {m === "saving" && "Kế hoạch tiết kiệm"}
                  {m === "invest" && "Hỏi đầu tư"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={submit}
              disabled={loading || (!income && !expense)}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {loading ? "Đang phân tích..." : "Gửi"}
            </Button>
            <Button
              onClick={clear}
              variant="outline"
              className="flex-1"
            >
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
                <p className="text-sm font-medium text-slate-700">Kết quả</p>
                <Button
                  onClick={copyOutput}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  {copied ? "✓ Đã copy" : "Copy"}
                </Button>
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap">
                {output}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

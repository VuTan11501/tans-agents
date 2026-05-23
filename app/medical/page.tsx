"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const SAMPLES = [
  "Sốt cao 39 độ, ho khan, mệt mỏi từ 2 ngày",
  "Đau dạ dày, buồn nôn, đầy bụng",
  "Nổi mẩn đỏ khắp người, ngứa ngáy",
]

export default function MedicalPage() {
  const [symptoms, setSymptoms] = useState("")
  const [ageGroup, setAgeGroup] = useState("adult")
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
    if (!symptoms.trim() || loading) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setOutput("")
    setError(null)

    const ageMap = {
      child: "trẻ em (1-12 tuổi)",
      teen: "vị thành niên (13-18 tuổi)",
      adult: "người lớn (18-65 tuổi)",
      senior: "cao tuổi (>65 tuổi)",
    }

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
              content: `Phân tích triệu chứng sau cho ${ageMap[ageGroup as keyof typeof ageMap]}. Gợi ý mức độ nghiêm trọng (xanh/vàng/đỏ), nguyên nhân có thể, khi nào cần gọi cấp cứu:\n\n${symptoms}`,
            },
          ],
          personaSystemPrompt:
            "Bạn là trợ lý sức khoẻ. Phân tích các triệu chứng một cách chuyên nghiệp, cô đọng. LUÔN LUÔN NHẮC NHỞ: ĐÂY KHÔNG PHẢI TƯ VẤN Y TẾ. Nếu khẩn cấp gọi 115 ngay.",
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
    setSymptoms("")
    setOutput("")
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-red-100 border border-red-400 rounded-lg p-4">
          <p className="text-sm font-bold text-red-900">
            🚨 KHÔNG PHẢI TƯ VẤN Y TẾ CHUYÊN NGHIỆP
          </p>
          <p className="text-xs text-red-800 mt-1">
            Nếu khẩn cấp: gọi 115 ngay. Thông tin này chỉ dùng tham khảo.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Phân tích triệu chứng sơ cấp</h1>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nhóm tuổi
            </label>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="child">Trẻ em (1-12 tuổi)</option>
              <option value="teen">Vị thành niên (13-18 tuổi)</option>
              <option value="adult">Người lớn (18-65 tuổi)</option>
              <option value="senior">Cao tuổi (&gt;65 tuổi)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Mô tả triệu chứng
            </label>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Mô tả chi tiết các triệu chứng, thời gian xuất hiện, độ nghiêm trọng..."
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <p className="text-xs text-slate-600 mb-2">Mẫu:</p>
            <div className="flex gap-2 flex-wrap">
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSymptoms(s)}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition"
                >
                  {s.slice(0, 25)}...
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={submit}
              disabled={loading || !symptoms.trim()}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {loading ? "Đang phân tích..." : "Phân tích"}
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

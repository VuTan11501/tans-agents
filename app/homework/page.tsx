"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

export default function HomeworkPage() {
  const [problem, setProblem] = useState("")
  const [grade, setGrade] = useState("6-9")
  const [mode, setMode] = useState("explain")
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
    if (!problem.trim() || loading) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setOutput("")
    setError(null)

    const modeMap = {
      explain: "Giải chi tiết từng bước, giải thích từng hành động.",
      hint: "Chỉ cho gợi ý và hướng suy nghĩ, không cho đáp án trực tiếp.",
      check: "Kiểm tra lời giải và chỉ ra lỗi nếu có.",
    }

    const gradeMap = {
      "1-5": "tiểu học lớp 1-5",
      "6-9": "trung học cơ sở lớp 6-9",
      "10-12": "trung học phổ thông lớp 10-12",
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
              content: `${modeMap[mode as keyof typeof modeMap]} cho học sinh ${gradeMap[grade as keyof typeof gradeMap]}. Dùng ví dụ dễ hiểu, phù hợp lứa tuổi.\n\nBài tập: ${problem}`,
            },
          ],
          personaSystemPrompt:
            "Bạn là thầy cô dạy kèm trẻ em. Giải thích rõ, dễ hiểu, khuyến khích con tự suy nghĩ.",
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
    setProblem("")
    setOutput("")
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800">
            💡 Khuyến khích con tự làm trước. Công cụ này chỉ hỗ trợ giải thích!
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Trợ lý giải bài tập</h1>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Đề bài (Toán / Tiếng Việt / Tiếng Anh / Khoa học)
            </label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Dán hoặc nhập đề bài..."
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Lớp học
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="1-5">Lớp 1-5</option>
                <option value="6-9">Lớp 6-9</option>
                <option value="10-12">Lớp 10-12</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Chế độ
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="explain">Giải chi tiết</option>
                <option value="hint">Chỉ gợi ý</option>
                <option value="check">Kiểm tra lời giải</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={submit}
              disabled={loading || !problem.trim()}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              {loading ? "Đang xử lý..." : "Hỗ trợ"}
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
                <p className="text-sm font-medium text-slate-700">Hướng dẫn</p>
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

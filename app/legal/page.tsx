"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const SAMPLES = [
  "Tôi không hiểu điều khoản 5 trong hợp đồng này",
  "Làm thế nào để soạn email từ chối một yêu cầu pháp lý?",
  "Quyền lợi của người lao động khi bị sa thải có cơ sở không?",
]

export default function LegalPage() {
  const [question, setQuestion] = useState("")
  const [mode, setMode] = useState<"explain" | "draft" | "general">("explain")
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
    if (!question.trim() || loading) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setOutput("")
    setError(null)

    const modeMap = {
      explain: "Giải thích điều khoản hợp đồng sau, làm rõ ý nghĩa, quyền lợi và rủi ro:",
      draft: "Soạn một email/thư chuyên nghiệp dựa trên yêu cầu sau. Lịch sự, rõ ràng:",
      general: "Trả lời câu hỏi pháp luật sau bằng tiếng Việt, súc tích, dễ hiểu:",
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
              content: `${modeMap[mode]}\n\n${question}`,
            },
          ],
          personaSystemPrompt:
            "Bạn là trợ lý pháp lý. Trả lời rõ ràng, dễ hiểu. LUÔN LUÔN NHẮC NHỞ: Đây KHÔNG phải tư vấn pháp lý chính thức. Liên hệ luật sư để vấn đề cụ thể.",
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
    setQuestion("")
    setOutput("")
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-red-800">
            ⚠️ KHÔNG PHẢI TƯ VẤN PHÁP LÝ CHÍNH THỨC
          </p>
          <p className="text-xs text-red-700 mt-1">
            Thông tin này chỉ dùng tham khảo. Vấn đề pháp lý cụ thể cần tham khảo luật sư.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Trợ lý pháp lý</h1>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Chế độ
            </label>
            <div className="flex gap-2 flex-wrap">
              {(["explain", "draft", "general"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    mode === m
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  {m === "explain" && "Giải thích"}
                  {m === "draft" && "Soạn email"}
                  {m === "general" && "Hỏi pháp luật"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Câu hỏi / Nội dung
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Nhập câu hỏi hoặc dán điều khoản cần giải thích..."
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <p className="text-xs text-slate-600 mb-2">Mẫu:</p>
            <div className="flex gap-2 flex-wrap">
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuestion(s)}
                  className="text-xs px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded transition"
                >
                  {s.slice(0, 30)}...
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={submit}
              disabled={loading || !question.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Đang xử lý..." : "Gửi"}
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

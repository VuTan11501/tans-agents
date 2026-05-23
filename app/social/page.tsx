"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

export default function SocialPage() {
  const [idea, setIdea] = useState("")
  const [platform, setPlatform] = useState("twitter")
  const [tone, setTone] = useState("professional")
  const [addHashtags, setAddHashtags] = useState(true)
  const [addEmoji, setAddEmoji] = useState(true)
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
    if (!idea.trim() || loading) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setOutput("")
    setError(null)

    const platformMap = {
      twitter: "Twitter/X (tối đa 280 ký tự)",
      linkedin: "LinkedIn (chuyên nghiệp, dài)",
      facebook: "Facebook (cá nhân, dễ thân gần)",
      threads: "Threads (ngắn, trending)",
      instagram: "Instagram caption (hình ảnh, hấp dẫn)",
    }

    const toneMap = {
      professional: "chuyên nghiệp, trang trọng",
      funny: "hài hước, vui vẻ",
      inspiring: "truyền cảm hứng, lạc quan",
      sales: "bán hàng, thu hút, kêu gọi hành động",
      personal: "cá nhân, thân mật, tự nhiên",
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
              content: `Viết 3 phiên bản bài đăng khác nhau cho ${platformMap[platform as keyof typeof platformMap]}, với giọng điệu ${toneMap[tone as keyof typeof toneMap]}. ${addHashtags ? "Thêm hashtag phù hợp." : ""} ${addEmoji ? "Thêm emoji hợp lý." : ""} Mỗi phiên bản trên một dòng riêng, phân tách bằng "---".\n\nÝ tưởng: ${idea}`,
            },
          ],
          personaSystemPrompt:
            "Bạn là trợ lý soạn bài đăng mạng xã hội. Tạo nội dung hấp dẫn, phù hợp từng nền tảng.",
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
    setIdea("")
    setOutput("")
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Soạn bài đăng mạng xã hội</h1>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Ý tưởng / Chủ đề
            </label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Nhập ý tưởng hoặc chủ đề bài đăng..."
              rows={4}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nền tảng
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="twitter">Twitter/X</option>
                <option value="linkedin">LinkedIn</option>
                <option value="facebook">Facebook</option>
                <option value="threads">Threads</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Giọng điệu
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="professional">Chuyên nghiệp</option>
                <option value="funny">Hài hước</option>
                <option value="inspiring">Truyền cảm hứng</option>
                <option value="sales">Bán hàng</option>
                <option value="personal">Cá nhân</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={addHashtags}
                onChange={(e) => setAddHashtags(e.target.checked)}
                className="w-4 h-4"
              />
              Thêm hashtag
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={addEmoji}
                onChange={(e) => setAddEmoji(e.target.checked)}
                className="w-4 h-4"
              />
              Thêm emoji
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={submit}
              disabled={loading || !idea.trim()}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {loading ? "Đang soạn..." : "Tạo bài đăng"}
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

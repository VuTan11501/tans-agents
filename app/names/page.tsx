"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"

const TABS = [
  { id: "brand", label: "Sản phẩm/Thương hiệu" },
  { id: "baby", label: "Em bé" },
  { id: "business", label: "Doanh nghiệp" },
  { id: "domain", label: "Tên miền" },
  { id: "character", label: "Nhân vật" },
] as const

type TabId = (typeof TABS)[number]["id"]
type FieldKind = "input" | "select" | "textarea" | "number"
type FieldConfig = { key: string; label: string; placeholder?: string; kind?: FieldKind; options?: string[] }
type FormState = Record<TabId, Record<string, string>>
type NameIdea = { name: string; reason: string }

const FIELDS: Record<TabId, FieldConfig[]> = {
  brand: [
    { key: "industry", label: "Ngành hàng", placeholder: "VD: mỹ phẩm, app học tiếng Nhật" },
    { key: "audience", label: "Đối tượng mục tiêu", placeholder: "VD: Gen Z, dân văn phòng, mẹ bỉm" },
    { key: "style", label: "Phong cách", kind: "select", options: ["modern", "playful", "luxurious"] },
    { key: "include", label: "Từ muốn có", placeholder: "VD: tan, zen, glow" },
    { key: "exclude", label: "Từ không muốn có", placeholder: "VD: shop, 24h, cheap" },
  ],
  baby: [
    { key: "gender", label: "Giới tính", kind: "select", options: ["nam", "nữ", "trung tính"] },
    { key: "origin", label: "Nguồn gốc", kind: "select", options: ["Việt", "Hán Việt", "Phương Tây", "Nhật", "Hàn"] },
    { key: "meaning", label: "Ý nghĩa mong muốn", kind: "textarea", placeholder: "VD: bình an, thông minh, mạnh mẽ, nhân hậu..." },
  ],
  business: [
    { key: "sector", label: "Lĩnh vực", placeholder: "VD: tư vấn IT, logistics, giáo dục" },
    { key: "scale", label: "Quy mô", kind: "select", options: ["startup", "SME", "enterprise"] },
    { key: "tone", label: "Tone", kind: "select", options: ["chuyên nghiệp", "sáng tạo", "thân thiện"] },
  ],
  domain: [
    { key: "idea", label: "Ý tưởng chính", placeholder: "VD: công cụ AI quản lý lịch cá nhân" },
    { key: "language", label: "Ngôn ngữ", kind: "select", options: ["vi", "en"] },
    { key: "tld", label: "TLD ưa thích", kind: "select", options: [".com", ".io", ".vn", ".app", ".ai"] },
    { key: "maxLength", label: "Độ dài tối đa", kind: "number", placeholder: "VD: 12" },
  ],
  character: [
    { key: "genre", label: "Thể loại", kind: "select", options: ["fantasy", "sci-fi", "realistic", "anime"] },
    { key: "gender", label: "Giới tính", kind: "select", options: ["nam", "nữ", "trung tính", "khác"] },
    { key: "role", label: "Vai trò", kind: "select", options: ["hero", "villain", "sidekick"] },
    { key: "background", label: "Background", kind: "textarea", placeholder: "VD: kiếm sĩ lưu vong, hacker thành phố tương lai..." },
  ],
}

const INITIAL_FORMS: FormState = {
  brand: { industry: "", audience: "", style: "modern", include: "", exclude: "" },
  baby: { gender: "trung tính", origin: "Việt", meaning: "" },
  business: { sector: "", scale: "startup", tone: "chuyên nghiệp" },
  domain: { idea: "", language: "vi", tld: ".com", maxLength: "12" },
  character: { genre: "fantasy", gender: "trung tính", role: "hero", background: "" },
}

export default function NameGeneratorPage() {
  const [activeTab, setActiveTab] = useState<TabId>("brand")
  const [forms, setForms] = useState<FormState>(INITIAL_FORMS)
  const [output, setOutput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copiedName, setCopiedName] = useState<string | null>(null)
  const [seed, setSeed] = useState(() => Math.random().toString(36).slice(2, 8))
  const abortRef = useRef<AbortController | null>(null)

  const ideas = useMemo(() => parseNameIdeas(output), [output])
  const currentFields = FIELDS[activeTab]
  const currentForm = forms[activeTab]

  function updateField(key: string, value: string) {
    setForms((current) => ({
      ...current,
      [activeTab]: { ...current[activeTab], [key]: value },
    }))
  }

  async function generateNames(nextSeed = seed) {
    if (isLoading) return

    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
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
          messages: [{ role: "user", content: buildPrompt(activeTab, currentForm, nextSeed) }],
          personaSystemPrompt:
            "Bạn là chuyên gia đặt tên sáng tạo cho người Việt. Trả lời bằng tiếng Việt, đúng định dạng bullet list, không thêm lời dẫn dài dòng.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => {
        setOutput((current) => current + chunk)
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Đã huỷ yêu cầu.")
      } else {
        setError(err instanceof Error ? err.message : "Có lỗi khi gọi AI.")
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsLoading(false)
    }
  }

  async function copyIdea(idea: NameIdea) {
    await navigator.clipboard.writeText(`${idea.name} — ${idea.reason}`)
    setCopiedName(idea.name)
    window.setTimeout(() => setCopiedName(null), 1500)
  }

  function generateMore() {
    const nextSeed = Math.random().toString(36).slice(2, 8)
    setSeed(nextSeed)
    void generateNames(nextSeed)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">AI Naming Studio</p>
          <h1 className="text-2xl font-semibold tracking-tight">✨ Tạo tên bằng AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tạo nhanh tên thương hiệu, em bé, doanh nghiệp, tên miền hoặc nhân vật kèm lý do chọn.</p>
        </header>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Loại tên cần tạo">
            {TABS.map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {currentFields.map((field) => (
              <DynamicField key={field.key} field={field} value={currentForm[field.key] ?? ""} onChange={(value) => updateField(field.key, value)} />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => generateNames()} disabled={isLoading}>
              {isLoading ? "Đang tạo..." : "✨ Tạo 10 gợi ý"}
            </Button>
            <Button type="button" variant="secondary" onClick={generateMore} disabled={isLoading}>
              Tạo thêm
            </Button>
            {isLoading && (
              <Button type="button" variant="destructive" onClick={() => abortRef.current?.abort()}>
                Dừng
              </Button>
            )}
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Danh sách gợi ý</h2>
            <p className="text-sm text-muted-foreground">Mỗi tên có nút sao chép riêng để dùng nhanh.</p>
          </div>

          {ideas.length > 0 ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {ideas.map((idea, index) => (
                <li key={`${idea.name}-${index}`} className="rounded-lg border bg-background p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-tight">{idea.name}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{idea.reason}</p>
                    </div>
                    <Button type="button" variant="secondary" onClick={() => copyIdea(idea)}>
                      {copiedName === idea.name ? "Đã copy" : "Sao chép"}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="min-h-[14rem] whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm leading-relaxed">
              {output || <span className="text-muted-foreground">Chưa có gợi ý. Điền thông tin và bấm tạo.</span>}
              {isLoading && <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function DynamicField({ field, value, onChange }: { field: FieldConfig; value: string; onChange: (value: string) => void }) {
  const baseClass = "rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"

  if (field.kind === "select") {
    return (
      <label className="grid gap-2 text-sm font-medium">
        {field.label}
        <select value={value} onChange={(event) => onChange(event.target.value)} className={baseClass}>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (field.kind === "textarea") {
    return (
      <label className="grid gap-2 text-sm font-medium md:col-span-2">
        {field.label}
        <textarea value={value} onChange={(event) => onChange(event.target.value)} className={`${baseClass} min-h-28 resize-y`} placeholder={field.placeholder} />
      </label>
    )
  }

  return (
    <label className="grid gap-2 text-sm font-medium">
      {field.label}
      <input type={field.kind === "number" ? "number" : "text"} value={value} onChange={(event) => onChange(event.target.value)} className={baseClass} placeholder={field.placeholder} />
    </label>
  )
}

function buildPrompt(tab: TabId, values: Record<string, string>, seed: string) {
  const title = TABS.find((item) => item.id === tab)?.label ?? tab
  const details = FIELDS[tab]
    .map((field) => `${field.label}: ${values[field.key]?.trim() || "không chỉ định"}`)
    .join("\n")

  return `Tạo đúng 10 gợi ý tên cho mục "${title}" dựa trên thông tin sau:\n${details}\nSeed khác biệt: ${seed}.\n\nYêu cầu: trả về bullet list markdown, mỗi dòng theo đúng dạng "- **Tên**: vì sao phù hợp". Mỗi tên ngắn gọn, dễ nhớ, có rationale "vì sao" bằng tiếng Việt. Không thêm bảng, không thêm phần mở đầu hay kết luận.`
}

function parseNameIdeas(markdown: string): NameIdea[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^([-*]|\d+[.)])\s+/.test(line))
    .map((line) => line.replace(/^([-*]|\d+[.)])\s+/, ""))
    .map((line) => {
      const cleaned = line.replace(/`/g, "").trim()
      const match = cleaned.match(/^\*\*(.+?)\*\*\s*[:：\-–—]\s*(.+)$/) ?? cleaned.match(/^(.+?)\s*[:：\-–—]\s*(.+)$/)
      if (!match) return { name: cleanName(cleaned), reason: "" }
      return { name: cleanName(match[1]), reason: match[2].replace(/^vì sao\s*[:：]?\s*/i, "").trim() }
    })
    .filter((idea) => idea.name)
}

function cleanName(value: string) {
  return value.replace(/\*\*/g, "").replace(/^"|"$/g, "").trim()
}

async function readSseStream(body: ReadableStream<Uint8Array>, onContent: (content: string) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""

    for (const event of events) {
      parseSseEvent(event, onContent)
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) parseSseEvent(buffer, onContent)
}

function parseSseEvent(event: string, onContent: (content: string) => void) {
  const dataLines = event
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())

  for (const data of dataLines) {
    if (!data || data === "[DONE]") continue

    const payload = JSON.parse(data)
    if (payload?.error?.message) throw new Error(payload.error.message)

    const content = payload?.choices?.[0]?.delta?.content
    if (typeof content === "string") onContent(content)
  }
}

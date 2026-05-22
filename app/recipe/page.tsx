"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"

const PROVIDER = "groq"
const MODEL = "llama-3.1-8b-instant"
const STORAGE_KEY = "tans-agents:saved-recipes-v1"

const QUICK_ITEMS = ["Gà", "Bò", "Tôm", "Trứng", "Rau", "Mì", "Cơm", "Khoai tây"]
const CUISINES = ["Việt", "Nhật", "Trung", "Hàn", "Âu", "Mỹ", "Bất kỳ"]
const SERVINGS = ["1", "2", "4", "6"]
const TIMES = ["<15p", "15-30p", "30-60p", ">1h"]
const DIETS = ["Không", "Chay", "Thuần chay", "Keto", "Lành mạnh"]
const DIFFICULTIES = ["Dễ", "Vừa", "Khó"]

type SavedRecipe = {
  id: string
  title: string
  content: string
  createdAt: string
}

type RecipeAction = "suggest" | "plan" | "shopping"

export default function RecipePage() {
  const [ingredients, setIngredients] = useState("")
  const [cuisine, setCuisine] = useState("Bất kỳ")
  const [servings, setServings] = useState("2")
  const [time, setTime] = useState("15-30p")
  const [diet, setDiet] = useState("Không")
  const [difficulty, setDifficulty] = useState("Dễ")
  const [output, setOutput] = useState("")
  const [loadingAction, setLoadingAction] = useState<RecipeAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState<SavedRecipe[]>([])
  const [savedNotice, setSavedNotice] = useState(false)
  const [activeTab, setActiveTab] = useState<"compose" | "saved">("compose")
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setSaved(loadSavedRecipes())
  }, [])

  const parsedIngredients = useMemo(() => parseIngredients(ingredients), [ingredients])
  const isLoading = loadingAction !== null
  const canCook = parsedIngredients.length > 0 && !isLoading
  const canShopping = (parsedIngredients.length > 0 || output.trim().length > 0) && !isLoading

  function addQuickItem(item: string) {
    setIngredients((current) => {
      const items = parseIngredients(current)
      if (items.some((existing) => existing.toLowerCase() === item.toLowerCase())) return current
      return [...items, item].join("\n")
    })
  }

  function buildPrompt(action: RecipeAction) {
    const ingredientText = parsedIngredients.join(", ") || "không có nguyên liệu cụ thể"
    const settingText = `Ưu tiên ẩm thực ${cuisine}, dành cho ${servings} người, thời gian nấu ${time}, chế độ ăn ${diet}, độ khó ${difficulty}.`

    if (action === "suggest") {
      return `Đề xuất CHÍNH XÁC 3 món ăn từ nguyên liệu sau: ${ingredientText}. Mỗi món có ## Tên món, ## Mô tả ngắn, ## Nguyên liệu (kèm số lượng), ## Cách làm (bước số), ## Mẹo. ${settingText}`
    }

    if (action === "plan") {
      return `Lập thực đơn bữa tối 1 tuần (7 ngày) từ các nguyên liệu sau: ${ingredientText}. ${settingText} Mỗi ngày gồm tên món, nguyên liệu chính, thời gian nấu ước tính và 3-5 bước làm ngắn gọn. Trình bày markdown rõ ràng theo từng ngày.`
    }

    return `Tạo danh sách đi chợ có số lượng ước tính cho ${servings} người. Dựa trên nguyên liệu đang có: ${ingredientText}.${output.trim() ? `\n\nCông thức/thực đơn hiện có:\n${output.trim()}` : ""}\n\nHãy chia nhóm: Đạm, Rau củ, Gia vị, Tinh bột, Khác. Ghi rõ món nào dùng nguyên liệu đó nếu phù hợp.`
  }

  async function runAction(action: RecipeAction) {
    if ((action === "shopping" ? !canShopping : !canCook) || isLoading) return

    const controller = new AbortController()
    abortRef.current = controller
    setLoadingAction(action)
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
          messages: [{ role: "user", content: buildPrompt(action) }],
          personaSystemPrompt:
            "Bạn là trợ lý nấu ăn cho gia đình Việt. Trả lời bằng tiếng Việt, thực tế, định lượng rõ, ưu tiên an toàn thực phẩm và không thêm lời dẫn thừa.",
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error("Không nhận được stream từ server")

      await readSseStream(response.body, (chunk) => {
        setOutput((current) => current + chunk)
      })
    } catch (err: any) {
      setError(err?.name === "AbortError" ? "Đã huỷ yêu cầu." : err?.message ?? "Có lỗi khi gọi AI.")
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoadingAction(null)
    }
  }

  async function copyOutput() {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function saveOutput() {
    if (!output.trim()) return
    const nextItem: SavedRecipe = {
      id: `${Date.now()}`,
      title: extractTitle(output) || "Công thức đã lưu",
      content: output.trim(),
      createdAt: new Date().toISOString(),
    }
    const nextSaved = [nextItem, ...saved].slice(0, 50)
    setSaved(nextSaved)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSaved))
    setSavedNotice(true)
    window.setTimeout(() => setSavedNotice(false), 1500)
  }

  function deleteSaved(id: string) {
    const nextSaved = saved.filter((item) => item.id !== id)
    setSaved(nextSaved)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSaved))
  }

  function loadSaved(item: SavedRecipe) {
    setOutput(item.content)
    setActiveTab("compose")
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">AI Recipe Assistant</p>
          <h1 className="text-2xl font-semibold tracking-tight">Gợi ý món ăn từ nguyên liệu sẵn có</h1>
          <p className="mt-1 text-sm text-muted-foreground">Nhập nguyên liệu, chọn khẩu vị và nhận công thức, thực đơn hoặc danh sách đi chợ.</p>
        </header>

        <div className="flex w-fit rounded-lg border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("compose")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === "compose" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            Tạo món
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("saved")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === "saved" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            Đã lưu ({saved.length})
          </button>
        </div>

        {activeTab === "compose" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="grid gap-4">
                <div>
                  <label htmlFor="recipe-ingredients" className="text-sm font-medium">
                    Nguyên liệu đang có
                  </label>
                  <textarea
                    id="recipe-ingredients"
                    value={ingredients}
                    onChange={(event) => setIngredients(event.target.value)}
                    rows={8}
                    className="mt-2 w-full resize-y rounded-lg border bg-background p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                    placeholder="Mỗi dòng 1 nguyên liệu hoặc nhập cách nhau bằng dấu phẩy. Ví dụ: gà, trứng, rau cải, cơm nguội..."
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {QUICK_ITEMS.map((item) => (
                      <Button key={item} type="button" variant="secondary" size="sm" onClick={() => addQuickItem(item)} disabled={isLoading}>
                        + {item}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField id="recipe-cuisine" label="Ẩm thực" value={cuisine} onChange={setCuisine} options={CUISINES} />
                  <SelectField id="recipe-servings" label="Khẩu phần" value={servings} onChange={setServings} options={SERVINGS} />
                  <SelectField id="recipe-time" label="Thời gian nấu" value={time} onChange={setTime} options={TIMES} />
                  <SelectField id="recipe-diet" label="Chế độ ăn" value={diet} onChange={setDiet} options={DIETS} />
                  <SelectField id="recipe-difficulty" label="Độ khó" value={difficulty} onChange={setDifficulty} options={DIFFICULTIES} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => runAction("suggest")} disabled={!canCook}>
                    {loadingAction === "suggest" ? "Đang gợi ý..." : "🍳 Gợi ý 3 món"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => runAction("plan")} disabled={!canCook}>
                    {loadingAction === "plan" ? "Đang lập..." : "📋 Lập thực đơn 1 tuần"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => runAction("shopping")} disabled={!canShopping}>
                    {loadingAction === "shopping" ? "Đang tạo..." : "🛒 Danh sách đi chợ"}
                  </Button>
                  {isLoading && (
                    <Button type="button" variant="destructive" onClick={() => abortRef.current?.abort()}>
                      Dừng
                    </Button>
                  )}
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            </section>

            <section className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-medium">Kết quả</h2>
                  <p className="text-xs text-muted-foreground">Markdown streaming từ AI.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={copyOutput} disabled={!output}>
                    {copied ? "Đã copy" : "Copy"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={saveOutput} disabled={!output}>
                    {savedNotice ? "Đã lưu" : "Save"}
                  </Button>
                </div>
              </div>

              <div className="min-h-[30rem] rounded-lg border bg-background p-4 text-sm leading-relaxed">
                {output ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Công thức, thực đơn hoặc shopping list sẽ xuất hiện ở đây.</span>
                )}
                {isLoading && <span className="mt-2 inline-block h-4 w-2 animate-pulse rounded-sm bg-muted-foreground align-middle" />}
              </div>
            </section>
          </div>
        ) : (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-medium">Công thức đã lưu</h2>
              <p className="text-xs text-muted-foreground">Lưu trong localStorage của trình duyệt này.</p>
            </div>

            {saved.length === 0 ? (
              <div className="rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground">Chưa có công thức nào được lưu.</div>
            ) : (
              <div className="grid gap-3">
                {saved.map((item) => (
                  <article key={item.id} className="rounded-lg border bg-background p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-medium">{item.title}</h3>
                        <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("vi-VN")}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => loadSaved(item)}>
                          Mở
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => deleteSaved(item.id)}>
                          Xoá
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 max-h-48 overflow-auto rounded-md border bg-card p-3 text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}

function SelectField({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  )
}

function parseIngredients(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function loadSavedRecipes(): SavedRecipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function extractTitle(markdown: string) {
  const heading = markdown.match(/^#{1,3}\s+(.+)$/m)?.[1]
  if (heading) return heading.replace(/[*_`]/g, "").trim()
  const firstLine = markdown.split("\n").find((line) => line.trim())
  return firstLine?.replace(/[#*_`]/g, "").trim().slice(0, 80) ?? ""
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

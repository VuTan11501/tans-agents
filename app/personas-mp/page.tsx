"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronDown, Plus, RefreshCw, Settings2, Share2 } from "lucide-react"
import { PersonaCardMp } from "@/components/persona-card-mp"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  CUSTOM_PERSONAS_KEY,
  SEED_PERSONAS,
  UPVOTES_KEY,
  createPersonasMpGist,
  getPersonasMpGistId,
  getPersonasMpNick,
  getPersonasMpPat,
  pushSharedPersona,
  pullSharedPersonas,
  setPersonasMpGistId,
  setPersonasMpNick,
  setPersonasMpPat,
  type MarketplacePersona,
  type SharedPersona,
} from "@/lib/personas-share"

interface ShareFormState {
  name: string
  description: string
  systemPrompt: string
  emoji: string
  category: string
}

const EMPTY_FORM: ShareFormState = {
  name: "",
  description: "",
  systemPrompt: "",
  emoji: "✨",
  category: "coding",
}

function readJsonArray(key: string): unknown[] {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readIdSet(key: string): Set<string> {
  return new Set(
    readJsonArray(key)
      .map((item) => (typeof item === "string" ? item : ""))
      .filter(Boolean)
  )
}

function makePersonaId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36)
  return `mp-${slug || "persona"}-${Date.now().toString(36)}`
}

function getItemId(item: unknown): string {
  if (!item || typeof item !== "object" || !("id" in item)) return ""
  return String((item as { id?: unknown }).id ?? "")
}

function getImportedIds(): Set<string> {
  return new Set(readJsonArray(CUSTOM_PERSONAS_KEY).map(getItemId).filter(Boolean))
}

function importPersona(persona: MarketplacePersona) {
  const current = readJsonArray(CUSTOM_PERSONAS_KEY)
  const imported = {
    id: persona.id,
    name: persona.name,
    label: persona.name,
    description: persona.description,
    systemPrompt: persona.systemPrompt,
    emoji: persona.emoji || "✨",
    category: persona.category,
    source: "personas-mp",
    importedAt: Date.now(),
  }
  const next = [imported, ...current.filter((item) => getItemId(item) !== persona.id)]
  localStorage.setItem(CUSTOM_PERSONAS_KEY, JSON.stringify(next))
}

export default function PersonasMarketplacePage() {
  const [gistId, setGistIdState] = useState("")
  const [pat, setPat] = useState("")
  const [nick, setNick] = useState("")
  const [communityPersonas, setCommunityPersonas] = useState<SharedPersona[]>([])
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [configOpen, setConfigOpen] = useState(true)
  const [form, setForm] = useState<ShareFormState>(EMPTY_FORM)
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set())
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const savedGistId = getPersonasMpGistId()
    const savedPat = getPersonasMpPat()
    setGistIdState(savedGistId)
    setPat(savedPat)
    setNick(getPersonasMpNick())
    setConfigOpen(!savedGistId || !savedPat)
    setUpvotedIds(readIdSet(UPVOTES_KEY))
    setImportedIds(getImportedIds())
  }, [])

  const allPersonas = useMemo<MarketplacePersona[]>(() => {
    const community = communityPersonas.map((persona) => ({ ...persona, isSeed: false }))
    const seedIds = new Set(SEED_PERSONAS.map((persona) => persona.id))
    return [...SEED_PERSONAS, ...community.filter((persona) => !seedIds.has(persona.id))]
  }, [communityPersonas])

  const savePat = (value: string) => {
    setPat(value)
    setPersonasMpPat(value)
  }

  const saveGistId = (value: string) => {
    setGistIdState(value)
    setPersonasMpGistId(value)
  }

  const saveNick = (value: string) => {
    setNick(value)
    setPersonasMpNick(value)
  }

  const handlePull = async () => {
    if (!gistId || !pat) {
      setStatus("⚠️ Cần cấu hình Gist ID + GitHub PAT để xem từ cộng đồng")
      return
    }

    setBusy(true)
    setStatus("Đang đồng bộ...")
    try {
      const data = await pullSharedPersonas(gistId, pat)
      setCommunityPersonas(data.personas)
      setStatus(`✅ Đồng bộ ${data.personas.length} persona cộng đồng`)
    } catch (error) {
      setStatus(`❌ Không đồng bộ được: ${error instanceof Error ? error.message : "lỗi không xác định"}`)
    } finally {
      setBusy(false)
    }
  }

  const handleCreateGist = async () => {
    if (!pat) {
      setStatus("⚠️ Nhập GitHub PAT trước")
      return
    }

    setBusy(true)
    setStatus("Đang tạo Gist cho Chợ Persona...")
    try {
      const id = await createPersonasMpGist(pat)
      saveGistId(id)
      setCommunityPersonas([])
      setStatus(`✅ Đã tạo Gist: ${id}`)
    } catch (error) {
      setStatus(`❌ Không tạo được Gist: ${error instanceof Error ? error.message : "lỗi không xác định"}`)
    } finally {
      setBusy(false)
    }
  }

  const handleUpvote = (persona: MarketplacePersona) => {
    if (upvotedIds.has(persona.id)) {
      setStatus("Bạn đã thả tim persona này rồi ❤️")
      return
    }

    const next = new Set(upvotedIds)
    next.add(persona.id)
    setUpvotedIds(next)
    localStorage.setItem(UPVOTES_KEY, JSON.stringify(Array.from(next)))
    setStatus(`❤️ Đã upvote "${persona.name}" trên thiết bị này`)
  }

  const handleImport = (persona: MarketplacePersona) => {
    try {
      importPersona(persona)
      setImportedIds(getImportedIds())
      setStatus(`✅ Import "${persona.name}" vào tài khoản thành công`)
    } catch (error) {
      setStatus(`❌ Không import được: ${error instanceof Error ? error.message : "lỗi không xác định"}`)
    }
  }

  const handleShare = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!gistId || !pat) {
      setStatus("⚠️ Cần Gist ID + GitHub PAT trước khi chia sẻ")
      return
    }

    const name = form.name.trim()
    const description = form.description.trim()
    const systemPrompt = form.systemPrompt.trim()
    const category = form.category.trim()
    if (!name || !description || !systemPrompt || !category) {
      setStatus("⚠️ Điền đủ tên, mô tả, system prompt và category")
      return
    }

    setBusy(true)
    setStatus(`Đang chia sẻ "${name}"...`)
    try {
      const data = await pushSharedPersona(gistId, pat, {
        id: makePersonaId(name),
        name,
        description,
        systemPrompt,
        emoji: form.emoji.trim() || "✨",
        category,
        sharedBy: nick.trim() || "anon",
      })
      setCommunityPersonas(data.personas)
      setForm(EMPTY_FORM)
      setStatus(`✅ Đã chia sẻ. Cộng đồng hiện có ${data.personas.length} persona`)
    } catch (error) {
      setStatus(`❌ Không chia sẻ được: ${error instanceof Error ? error.message : "lỗi không xác định"}`)
    } finally {
      setBusy(false)
    }
  }

  const communityReady = Boolean(gistId && pat)

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">Cộng đồng</Badge>
            <Badge variant="outline">Persona</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">🛒 Chợ Persona</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Duyệt, Import và Chia sẻ system prompt với cộng đồng Tan&apos;s Agents.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" /> Quay lại Chat
          </Link>
        </Button>
      </header>

      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4" /> Cấu hình Gist
              </CardTitle>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="gap-2">
                  {configOpen ? "Ẩn" : "Mở"}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">GitHub PAT (scope: gist)</label>
                  <Input
                    type="password"
                    value={pat}
                    onChange={(event) => savePat(event.target.value)}
                    placeholder="ghp_..."
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ưu tiên đọc PAT từ Team Workspace, fallback sang PAT riêng của Chợ Persona.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Persona Marketplace Gist ID</label>
                  <div className="flex gap-2">
                    <Input
                      value={gistId}
                      onChange={(event) => saveGistId(event.target.value)}
                      placeholder="abc123..."
                      className="font-mono"
                    />
                    <Button type="button" variant="outline" onClick={handleCreateGist} disabled={busy || !pat}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Nickname khi chia sẻ</label>
                  <Input value={nick} onChange={(event) => saveNick(event.target.value)} placeholder="vd: Tan" />
                </div>
                <Button type="button" onClick={handlePull} disabled={busy || !gistId || !pat} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Đồng bộ về
                </Button>
              </div>
              {status && <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{status}</p>}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {!communityReady && (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Cấu hình Gist để xem từ cộng đồng. Hiện tại bạn vẫn có thể Import các persona mẫu bên dưới.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Share2 className="h-5 w-5" /> + Chia sẻ persona mới
          </CardTitle>
          <p className="text-sm text-muted-foreground">Tạo persona mới rồi chia sẻ lên Gist cộng đồng.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleShare}>
            <div className="grid gap-4 md:grid-cols-[1fr_120px_160px]">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Tên persona</label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Tạo persona mới"
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Emoji</label>
                <Input
                  value={form.emoji}
                  onChange={(event) => setForm((prev) => ({ ...prev, emoji: event.target.value }))}
                  placeholder="✨"
                  maxLength={8}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Input
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  placeholder="coding"
                  maxLength={40}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Mô tả</label>
              <Input
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Persona này giúp gì?"
                maxLength={240}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">System prompt</label>
              <Textarea
                value={form.systemPrompt}
                onChange={(event) => setForm((prev) => ({ ...prev, systemPrompt: event.target.value }))}
                placeholder="Bạn là..."
                className="min-h-32"
                maxLength={8000}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={busy || !gistId || !pat} className="gap-2">
                <Share2 className="h-4 w-4" /> Chia sẻ
              </Button>
              <p className="text-xs text-muted-foreground">Seed persona không thể sửa/xoá; persona bạn chia sẻ sẽ được dedupe theo ID.</p>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Cộng đồng Persona ({allPersonas.length})</h2>
            <p className="text-sm text-muted-foreground">
              {communityPersonas.length > 0
                ? `Đang hiển thị ${SEED_PERSONAS.length} seed + ${communityPersonas.length} persona cộng đồng.`
                : communityReady
                  ? "Nhấn Đồng bộ để tải persona cộng đồng, hoặc xem seed personas trước."
                  : "Cấu hình Gist để xem từ cộng đồng."}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={handlePull} disabled={busy || !gistId || !pat} className="w-fit gap-2">
            <RefreshCw className="h-4 w-4" /> Đồng bộ
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {allPersonas.map((persona) => (
            <PersonaCardMp
              key={persona.id}
              persona={persona}
              upvoteCount={(persona.upvotes ?? 0) + (upvotedIds.has(persona.id) ? 1 : 0)}
              upvoted={upvotedIds.has(persona.id)}
              imported={importedIds.has(persona.id)}
              onImport={handleImport}
              onUpvote={handleUpvote}
            />
          ))}
        </div>
      </section>
    </main>
  )
}

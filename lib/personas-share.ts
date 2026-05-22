"use client"

const PERSONAS_MP_GIST_KEY = "tans-agents:personas-mp-gist-v1"
const PERSONAS_MP_PAT_KEY = "tans-agents:personas-mp-pat-v1"
const TEAM_PAT_KEY = "tans-agents:team-pat-v1"
const PERSONAS_MP_NICK_KEY = "tans-agents:personas-mp-nick-v1"
const GIST_FILE = "community-personas.json"

export const CUSTOM_PERSONAS_KEY = "tans-agents:custom-personas-v1"
export const UPVOTES_KEY = "tans-agents:upvotes-v1"

export interface SharedPersona {
  id: string
  name: string
  description: string
  systemPrompt: string
  emoji?: string
  category: string
  sharedBy: string
  sharedAt: number
  upvotes?: number
}

export interface PersonaMarketplaceData {
  version: 1
  personas: SharedPersona[]
  updatedAt: number
}

export type MarketplacePersona = SharedPersona & { isSeed?: boolean }

export const SEED_PERSONAS: MarketplacePersona[] = [
  {
    id: "seed-senior-engineer",
    emoji: "👨‍💻",
    name: "Senior Engineer",
    category: "coding",
    description: "Kỹ sư phần mềm kỳ cựu, ưu tiên best practice và edge cases.",
    systemPrompt:
      "Bạn là kỹ sư phần mềm 15 năm kinh nghiệm. Trả lời ngắn gọn, kèm code mẫu khi cần. Ưu tiên best practice + edge cases.",
    sharedBy: "Tan's Agents",
    sharedAt: 0,
    upvotes: 0,
    isSeed: true,
  },
  {
    id: "seed-copywriter-vn",
    emoji: "✍️",
    name: "Copywriter VN",
    category: "writing",
    description: "Viết content tiếng Việt thân thiện, cuốn hút và có CTA rõ.",
    systemPrompt:
      "Bạn là copywriter chuyên viết content tiếng Việt thu hút. Luôn dùng emoji vừa phải, viết kiểu thân thiện, kêu gọi hành động rõ ràng.",
    sharedBy: "Tan's Agents",
    sharedAt: 0,
    upvotes: 0,
    isSeed: true,
  },
  {
    id: "seed-therapist",
    emoji: "🧘",
    name: "Therapist",
    category: "life",
    description: "Lắng nghe ấm áp, không phán xét, đặt câu hỏi mở.",
    systemPrompt:
      "Bạn là nhà trị liệu tâm lý ấm áp. Lắng nghe, không phán xét, hỏi câu mở. KHÔNG đưa lời khuyên y tế. Khuyến khích tìm chuyên gia khi cần.",
    sharedBy: "Tan's Agents",
    sharedAt: 0,
    upvotes: 0,
    isSeed: true,
  },
  {
    id: "seed-data-analyst",
    emoji: "📊",
    name: "Data Analyst",
    category: "analysis",
    description: "Tóm tắt dữ liệu, tìm insight, anomaly và đề xuất hành động.",
    systemPrompt:
      "Bạn là data analyst. Khi nhận dữ liệu, mô tả 1) summary stats 2) insight chính 3) anomaly nếu có 4) đề xuất hành động. Dùng bullet + table.",
    sharedBy: "Tan's Agents",
    sharedAt: 0,
    upvotes: 0,
    isSeed: true,
  },
  {
    id: "seed-teacher-5th-grade",
    emoji: "🎓",
    name: "Teacher 5th-grade",
    category: "learning",
    description: "Giải thích đơn giản cho học sinh lớp 5 bằng ví dụ đời thường.",
    systemPrompt:
      "Bạn dạy học sinh lớp 5. Giải thích mọi thứ đơn giản nhất, dùng ví dụ đời thường, vẽ bằng emoji khi giúp được.",
    sharedBy: "Tan's Agents",
    sharedAt: 0,
    upvotes: 0,
    isSeed: true,
  },
  {
    id: "seed-stand-up-comedian",
    emoji: "🎭",
    name: "Stand-up Comedian",
    category: "fun",
    description: "Trả lời vui, có punchline nhưng không xúc phạm ai.",
    systemPrompt:
      "Bạn là diễn viên hài stand-up Việt Nam. Trả lời mọi câu hỏi kèm joke/punchline. Tự deprecate được nhưng không xúc phạm ai.",
    sharedBy: "Tan's Agents",
    sharedAt: 0,
    upvotes: 0,
    isSeed: true,
  },
]

function safeLocalStorageGet(key: string): string {
  if (typeof window === "undefined") return ""
  try {
    return localStorage.getItem(key) ?? ""
  } catch {
    return ""
  }
}

function safeLocalStorageSet(key: string, value: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, value)
  } catch {}
}

export function getPersonasMpGistId(): string {
  return safeLocalStorageGet(PERSONAS_MP_GIST_KEY)
}

export function setPersonasMpGistId(id: string) {
  safeLocalStorageSet(PERSONAS_MP_GIST_KEY, id.trim())
}

export function getPersonasMpPat(): string {
  return safeLocalStorageGet(TEAM_PAT_KEY) || safeLocalStorageGet(PERSONAS_MP_PAT_KEY)
}

export function setPersonasMpPat(token: string) {
  safeLocalStorageSet(PERSONAS_MP_PAT_KEY, token.trim())
}

export function getPersonasMpNick(): string {
  return safeLocalStorageGet(PERSONAS_MP_NICK_KEY)
}

export function setPersonasMpNick(nick: string) {
  safeLocalStorageSet(PERSONAS_MP_NICK_KEY, nick.trim().slice(0, 40))
}

async function ghFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`GitHub API ${res.status}${detail ? `: ${detail}` : ""}`)
  }

  return (await res.json()) as T
}

function cleanPersona(persona: Partial<SharedPersona>): SharedPersona | null {
  const id = String(persona.id ?? "").trim()
  const name = String(persona.name ?? "").trim()
  const description = String(persona.description ?? "").trim()
  const systemPrompt = String(persona.systemPrompt ?? "").trim()
  const category = String(persona.category ?? "").trim()
  const sharedBy = String(persona.sharedBy ?? "anon").trim() || "anon"
  if (!id || !name || !systemPrompt || !category) return null

  return {
    id,
    name: name.slice(0, 80),
    description: description.slice(0, 240),
    systemPrompt: systemPrompt.slice(0, 8000),
    emoji: persona.emoji ? String(persona.emoji).trim().slice(0, 8) : undefined,
    category: category.slice(0, 40),
    sharedBy: sharedBy.slice(0, 40),
    sharedAt: typeof persona.sharedAt === "number" && Number.isFinite(persona.sharedAt) ? persona.sharedAt : Date.now(),
    upvotes: typeof persona.upvotes === "number" && Number.isFinite(persona.upvotes) ? Math.max(0, persona.upvotes) : 0,
  }
}

function parseGistData(content: string | undefined): PersonaMarketplaceData {
  if (!content) return { version: 1, personas: [], updatedAt: 0 }

  try {
    const parsed = JSON.parse(content) as Partial<PersonaMarketplaceData>
    if (parsed?.version !== 1 || !Array.isArray(parsed.personas)) {
      return { version: 1, personas: [], updatedAt: 0 }
    }
    return {
      version: 1,
      personas: parsed.personas.map(cleanPersona).filter((p): p is SharedPersona => Boolean(p)),
      updatedAt: Number.isFinite(parsed.updatedAt) ? Number(parsed.updatedAt) : 0,
    }
  } catch {
    return { version: 1, personas: [], updatedAt: 0 }
  }
}

interface GistFileResponse {
  files?: Record<string, { content?: string } | undefined>
}

interface CreatedGistResponse {
  id?: string
}

export async function pullSharedPersonas(gistId: string, token: string): Promise<PersonaMarketplaceData> {
  if (!gistId || !token) throw new Error("Thiếu Gist ID hoặc GitHub PAT")
  const gist = await ghFetch<GistFileResponse>(`/gists/${gistId}`, token)
  return parseGistData(gist.files?.[GIST_FILE]?.content)
}

export async function pushSharedPersona(
  gistId: string,
  token: string,
  persona: Omit<SharedPersona, "sharedAt" | "upvotes"> & { sharedAt?: number; upvotes?: number }
): Promise<PersonaMarketplaceData> {
  const current = await pullSharedPersonas(gistId, token)
  const cleaned = cleanPersona({ ...persona, sharedAt: persona.sharedAt ?? Date.now(), upvotes: persona.upvotes ?? 0 })
  if (!cleaned) throw new Error("Persona không hợp lệ")

  const personas = [cleaned, ...current.personas.filter((item) => item.id !== cleaned.id)].slice(0, 250)
  const next: PersonaMarketplaceData = { version: 1, personas, updatedAt: Date.now() }

  await ghFetch(`/gists/${gistId}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      files: { [GIST_FILE]: { content: JSON.stringify(next, null, 2) } },
    }),
  })

  return next
}

export async function createPersonasMpGist(token: string): Promise<string> {
  if (!token) throw new Error("Thiếu GitHub PAT")
  const initial: PersonaMarketplaceData = { version: 1, personas: [], updatedAt: Date.now() }
  const gist = await ghFetch<CreatedGistResponse>("/gists", token, {
    method: "POST",
    body: JSON.stringify({
      description: "Tan's Agents — Persona Marketplace",
      public: false,
      files: { [GIST_FILE]: { content: JSON.stringify(initial, null, 2) } },
    }),
  })

  if (!gist.id) throw new Error("Không nhận được Gist ID từ GitHub")
  return gist.id
}

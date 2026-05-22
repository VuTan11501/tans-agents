"use client"

const TEAM_GIST_KEY = "tans-agents:team-gist-id-v1"
const TEAM_PAT_KEY = "tans-agents:team-pat-v1"
const AUTHOR_ID_KEY = "tans-agents:share-author-id-v1"
const LOCAL_COMMENTS_KEY = "tans-agents:share-comments-local-v1"

export interface ShareComment {
  id: string
  shareId: string
  author: string
  content: string
  createdAt: number
}

type StoredShareComment = ShareComment & { authorId?: string }

type CommentsFile = {
  version: 1
  comments: StoredShareComment[]
  updatedAt: number
}

type LocalComments = Record<string, StoredShareComment[]>

function safeGet(key: string): string {
  if (typeof window === "undefined") return ""
  try {
    return localStorage.getItem(key) ?? ""
  } catch {
    return ""
  }
}

function safeSet(key: string, value: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, value)
  } catch {}
}

function getGistId(): string {
  return safeGet(TEAM_GIST_KEY).trim()
}

function getPat(): string {
  return safeGet(TEAM_PAT_KEY).trim()
}

function getFileName(shareId: string): string {
  return `share-comments-${shareId}.json`
}

export function getShareAuthorId(): string {
  const existing = safeGet(AUTHOR_ID_KEY)
  if (existing) return existing
  const next = crypto.randomUUID()
  safeSet(AUTHOR_ID_KEY, next)
  return next
}

function currentShareAuthorId(): string {
  return safeGet(AUTHOR_ID_KEY)
}

export function canDeleteComment(comment: ShareComment): boolean {
  const authorId = currentShareAuthorId()
  return Boolean(authorId && (comment as StoredShareComment).authorId === authorId)
}

function parseLocal(): LocalComments {
  const raw = safeGet(LOCAL_COMMENTS_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object") return parsed as LocalComments
  } catch {}
  return {}
}

function writeLocal(all: LocalComments) {
  safeSet(LOCAL_COMMENTS_KEY, JSON.stringify(all))
}

function readLocal(shareId: string): StoredShareComment[] {
  const comments = parseLocal()[shareId]
  return Array.isArray(comments) ? comments : []
}

function upsertLocal(shareId: string, comment: StoredShareComment) {
  const all = parseLocal()
  const comments = readLocal(shareId)
  all[shareId] = [comment, ...comments.filter((item) => item.id !== comment.id)].slice(0, 300)
  writeLocal(all)
}

function removeLocal(shareId: string, id: string) {
  const all = parseLocal()
  all[shareId] = readLocal(shareId).filter((item) => item.id !== id)
  writeLocal(all)
}

function isStoredShareComment(comment: StoredShareComment | null): comment is StoredShareComment {
  return comment !== null
}

function cleanComment(comment: unknown, shareId: string): StoredShareComment | null {
  if (!comment || typeof comment !== "object") return null
  const item = comment as Partial<StoredShareComment>
  const id = typeof item.id === "string" ? item.id : ""
  const author = typeof item.author === "string" ? item.author.trim() : ""
  const content = typeof item.content === "string" ? item.content.trim() : ""
  const createdAt = typeof item.createdAt === "number" && Number.isFinite(item.createdAt) ? item.createdAt : 0
  if (!id || !author || !content || !createdAt) return null
  return {
    id,
    shareId,
    author: author.slice(0, 60),
    content: content.slice(0, 2000),
    createdAt,
    ...(typeof item.authorId === "string" ? { authorId: item.authorId } : {}),
  }
}

async function ghFetch(path: string, token: string, init?: RequestInit) {
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
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text().catch(() => "")}`)
  return res.json()
}

function emptyFile(): CommentsFile {
  return { version: 1, comments: [], updatedAt: 0 }
}

async function pullRemote(shareId: string, gistId: string, token: string): Promise<CommentsFile> {
  const gist = await ghFetch(`/gists/${gistId}`, token)
  const file = gist?.files?.[getFileName(shareId)]
  if (!file?.content) return emptyFile()
  try {
    const parsed = JSON.parse(file.content)
    if (parsed?.version === 1 && Array.isArray(parsed.comments)) {
      return {
        version: 1,
        comments: parsed.comments.map((item: unknown) => cleanComment(item, shareId)).filter(isStoredShareComment),
        updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
      }
    }
  } catch {}
  return emptyFile()
}

async function pushRemote(shareId: string, gistId: string, token: string, comments: StoredShareComment[]) {
  const next: CommentsFile = { version: 1, comments, updatedAt: Date.now() }
  await ghFetch(`/gists/${gistId}`, token, {
    method: "PATCH",
    body: JSON.stringify({
      files: { [getFileName(shareId)]: { content: JSON.stringify(next, null, 2) } },
    }),
  })
}

function mergeComments(...groups: StoredShareComment[][]): StoredShareComment[] {
  const byId = new Map<string, StoredShareComment>()
  for (const group of groups) {
    for (const comment of group) byId.set(comment.id, comment)
  }
  return Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt)
}

export async function listComments(shareId: string): Promise<ShareComment[]> {
  const local = readLocal(shareId)
  const gistId = getGistId()
  const token = getPat()
  if (!gistId || !token) return mergeComments(local)

  try {
    const remote = await pullRemote(shareId, gistId, token)
    return mergeComments(remote.comments, local)
  } catch {
    return mergeComments(local)
  }
}

export async function addComment(shareId: string, author: string, content: string): Promise<ShareComment> {
  const authorId = getShareAuthorId()
  const comment: StoredShareComment = {
    id: crypto.randomUUID(),
    shareId,
    author: (author.trim() || "Ẩn danh").slice(0, 60),
    content: content.trim().slice(0, 2000),
    createdAt: Date.now(),
    authorId,
  }
  if (!comment.content) throw new Error("Bình luận không được để trống")

  upsertLocal(shareId, comment)

  const gistId = getGistId()
  const token = getPat()
  if (gistId && token) {
    try {
      const remote = await pullRemote(shareId, gistId, token)
      await pushRemote(shareId, gistId, token, mergeComments(remote.comments, readLocal(shareId)))
    } catch {}
  }

  return comment
}

export async function deleteComment(shareId: string, id: string): Promise<void> {
  const authorId = currentShareAuthorId()
  if (!authorId) throw new Error("Bạn chỉ có thể xoá bình luận của mình")

  const local = readLocal(shareId)
  const localComment = local.find((item) => item.id === id)
  if (localComment && localComment.authorId !== authorId) throw new Error("Bạn chỉ có thể xoá bình luận của mình")
  removeLocal(shareId, id)

  const gistId = getGistId()
  const token = getPat()
  if (!gistId || !token) return

  const remote = await pullRemote(shareId, gistId, token)
  const remoteComment = remote.comments.find((item) => item.id === id)
  if (remoteComment && remoteComment.authorId !== authorId) throw new Error("Bạn chỉ có thể xoá bình luận của mình")
  await pushRemote(
    shareId,
    gistId,
    token,
    remote.comments.filter((item) => item.id !== id)
  )
}

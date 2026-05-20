"use client"

import { extractFileText } from "@/lib/upload"

export interface DocumentCollection {
  id: string
  name: string
  createdAt: string
}

export interface DocumentChunk {
  id: string
  collectionId: string
  text: string
  embedding: Float32Array
  source: string
}

export interface CollectionSearchResult {
  text: string
  source: string
  score: number
}

const DB_NAME = "tans-agents:collections"
const DB_VERSION = 1
const CHUNK_SIZE = 900
const CHUNK_OVERLAP = 140
const TRANSFORMERS_CDN = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2"
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2"
export const RAG_ACTIVE_COLLECTION_KEY = "tans:rag:activeCollection"
export const RAG_ACTIVE_COLLECTION_EVENT = "tans:rag:activeCollectionChanged"

type FeatureExtractor = (text: string, options: { pooling: "mean"; normalize: boolean }) => Promise<{ data: Float32Array | number[] }>
let extractorPromise: Promise<FeatureExtractor> | null = null

export interface ActiveCollectionSearchResult {
  collection: DocumentCollection
  results: CollectionSearchResult[]
}

export function getActiveCollectionId(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(RAG_ACTIVE_COLLECTION_KEY)
}

export function setActiveCollectionId(collectionId: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(RAG_ACTIVE_COLLECTION_KEY, collectionId)
  notifyActiveCollectionChanged()
}

export function clearActiveCollectionId(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(RAG_ACTIVE_COLLECTION_KEY)
  notifyActiveCollectionChanged()
}

export async function listCollections(): Promise<DocumentCollection[]> {
  const db = await openCollectionsDb()
  return requestToPromise(db.transaction("collections", "readonly").objectStore("collections").getAll())
}

export async function createCollection(name: string): Promise<DocumentCollection> {
  const collection = { id: crypto.randomUUID(), name: name.trim() || "Bộ sưu tập mới", createdAt: new Date().toISOString() }
  const db = await openCollectionsDb()
  await requestToPromise(db.transaction("collections", "readwrite").objectStore("collections").add(collection))
  return collection
}

export async function deleteCollection(collectionId: string): Promise<void> {
  const db = await openCollectionsDb()
  const tx = db.transaction(["collections", "chunks"], "readwrite")
  tx.objectStore("collections").delete(collectionId)
  const index = tx.objectStore("chunks").index("collectionId")
  const keys = await requestToPromise<IDBValidKey[]>(index.getAllKeys(collectionId))
  for (const key of keys) tx.objectStore("chunks").delete(key)
  await transactionDone(tx)
  if (getActiveCollectionId() === collectionId) clearActiveCollectionId()
}

export async function countChunks(collectionId: string): Promise<number> {
  const db = await openCollectionsDb()
  return requestToPromise(db.transaction("chunks", "readonly").objectStore("chunks").index("collectionId").count(collectionId))
}

export async function ingestFiles(collectionId: string, files: File[], onProgress?: (message: string) => void): Promise<number> {
  let added = 0
  for (const file of files) {
    onProgress?.(`Đang đọc ${file.name}...`)
    const text = await extractFileText(file)
    const chunks = chunkText(text)
    for (let index = 0; index < chunks.length; index += 1) {
      onProgress?.(`Đang embedding ${file.name} (${index + 1}/${chunks.length})...`)
      await addChunk({ collectionId, text: chunks[index], source: `${file.name}#${index + 1}` })
      added += 1
    }
  }
  onProgress?.(`Đã thêm ${added} chunk.`)
  return added
}

export async function searchCollectionLocal({
  query,
  collectionId,
  topK = 5,
}: {
  query: string
  collectionId: string
  topK?: number
}): Promise<CollectionSearchResult[]> {
  const q = query.trim()
  if (!q) return []
  const queryEmbedding = await embedText(q)
  const chunks = await getChunks(collectionId)
  return chunks
    .map((chunk) => ({ text: chunk.text, source: chunk.source, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, topK))
}

export async function searchActiveCollection(query: string, topK = 5): Promise<ActiveCollectionSearchResult | null> {
  const activeId = getActiveCollectionId()
  if (!activeId) return null
  const collections = await listCollections()
  const collection = collections.find((item) => item.id === activeId)
  if (!collection) {
    clearActiveCollectionId()
    return null
  }
  const results = await searchCollectionLocal({ query, collectionId: activeId, topK: Math.min(Math.max(1, topK), 5) })
  return { collection, results }
}

async function addChunk(input: { collectionId: string; text: string; source: string }) {
  const chunk: DocumentChunk = {
    id: crypto.randomUUID(),
    collectionId: input.collectionId,
    text: input.text,
    embedding: await embedText(input.text),
    source: input.source,
  }
  const db = await openCollectionsDb()
  await requestToPromise(db.transaction("chunks", "readwrite").objectStore("chunks").add(chunk))
}

async function getChunks(collectionId: string): Promise<DocumentChunk[]> {
  const db = await openCollectionsDb()
  return requestToPromise(db.transaction("chunks", "readonly").objectStore("chunks").index("collectionId").getAll(collectionId))
}

async function embedText(text: string): Promise<Float32Array> {
  const extractor = await getExtractor()
  const output = await extractor(text.slice(0, 8000), { pooling: "mean", normalize: true })
  return output.data instanceof Float32Array ? output.data : new Float32Array(output.data)
}

async function getExtractor(): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const dynamicImport = new Function("url", "return import(url)") as (url: string) => Promise<{ pipeline: (task: string, model: string) => Promise<FeatureExtractor> }>
      const { pipeline } = await dynamicImport(TRANSFORMERS_CDN)
      return pipeline("feature-extraction", EMBEDDING_MODEL)
    })()
  }
  return extractorPromise
}

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return []
  const chunks: string[] = []
  for (let start = 0; start < clean.length; start += CHUNK_SIZE - CHUNK_OVERLAP) {
    chunks.push(clean.slice(start, start + CHUNK_SIZE).trim())
  }
  return chunks.filter(Boolean)
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const length = Math.min(a.length, b.length)
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (!normA || !normB) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function notifyActiveCollectionChanged() {
  window.dispatchEvent(new Event(RAG_ACTIVE_COLLECTION_EVENT))
}

function openCollectionsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains("collections")) db.createObjectStore("collections", { keyPath: "id" })
      if (!db.objectStoreNames.contains("chunks")) {
        const chunks = db.createObjectStore("chunks", { keyPath: "id" })
        chunks.createIndex("collectionId", "collectionId")
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Không mở được IndexedDB"))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request lỗi"))
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction lỗi"))
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction bị huỷ"))
  })
}

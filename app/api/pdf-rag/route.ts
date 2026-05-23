import { NextRequest, NextResponse } from "next/server"

const JINA_API_KEY = process.env.JINA_API_KEY

interface SearchRequest {
  query: string
  pdfId: string
  chunks: string[]
}

interface UploadResponse {
  success: boolean
  pdfId?: string
  chunkCount?: number
  chunks?: string[]
  error?: string
}

interface SearchResponse {
  success: boolean
  results?: Array<{
    chunk: string
    relevance: number
  }>
  error?: string
}

// Chunk text into fixed-size chunks with overlap
function chunkText(text: string, chunkSize = 500, overlapSize = 50): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += chunkSize - overlapSize) {
    chunks.push(text.slice(i, i + chunkSize))
  }
  return chunks
}

// Simple tokenization for similarity scoring
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2)
  )
}

// Calculate Jaccard similarity between query and chunk
function jaccardSimilarity(query: string, chunk: string): number {
  const queryTokens = tokenize(query)
  const chunkTokens = tokenize(chunk)

  const intersection = new Set([...queryTokens].filter((x) => chunkTokens.has(x)))
  const union = new Set([...queryTokens, ...chunkTokens])

  return union.size === 0 ? 0 : intersection.size / union.size
}

// Calculate term frequency scoring
function termFrequencySimilarity(query: string, chunk: string): number {
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  if (queryWords.length === 0) return 0

  const chunkLower = chunk.toLowerCase()
  let matchCount = 0

  for (const word of queryWords) {
    const regex = new RegExp(`\\b${word}\\b`, "g")
    const matches = chunkLower.match(regex)
    matchCount += matches ? matches.length : 0
  }

  return matchCount / queryWords.length / 10
}

// Combined similarity score
function calculateSimilarity(query: string, chunk: string): number {
  const jaccard = jaccardSimilarity(query, chunk)
  const tf = termFrequencySimilarity(query, chunk)

  // Weight: 60% Jaccard, 40% TF
  return Math.min(1, jaccard * 0.6 + tf * 0.4)
}

// Extract text from PDF using Jina API
async function extractPdfText(file: File): Promise<string> {
  if (!JINA_API_KEY) {
    throw new Error("JINA_API_KEY not configured")
  }

  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString("base64")
  const mimeType = file.type || "application/pdf"

  const response = await fetch("https://r.jina.ai/", {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      Authorization: `Bearer ${JINA_API_KEY}`,
    },
    body: buffer,
  })

  if (!response.ok) {
    throw new Error(`Jina API error: ${response.status} ${response.statusText}`)
  }

  const text = await response.text()
  return text.trim()
}

// Generate unique ID
function generateId(): string {
  return `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const action = req.headers.get("X-Action")

    if (action === "upload") {
      const formData = await req.formData()
      const file = formData.get("file") as File

      if (!file) {
        return NextResponse.json(
          { success: false, error: "No file provided" },
          { status: 400 }
        )
      }

      if (file.type !== "application/pdf") {
        return NextResponse.json(
          { success: false, error: "Only PDF files are supported" },
          { status: 400 }
        )
      }

      const text = await extractPdfText(file)

      if (!text || text.length === 0) {
        return NextResponse.json(
          { success: false, error: "Failed to extract text from PDF" },
          { status: 400 }
        )
      }

      const chunks = chunkText(text)
      const pdfId = generateId()

      return NextResponse.json({
        success: true,
        pdfId,
        chunkCount: chunks.length,
        chunks,
      } as UploadResponse)
    }

    if (action === "search") {
      const body = await req.json()
      const { query, chunks } = body as SearchRequest

      if (!query || !chunks || !Array.isArray(chunks)) {
        return NextResponse.json(
          { success: false, error: "Invalid search parameters" },
          { status: 400 }
        )
      }

      const results = chunks
        .map((chunk) => ({
          chunk,
          relevance: calculateSimilarity(query, chunk),
        }))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 3)
        .filter((r) => r.relevance > 0)

      return NextResponse.json({
        success: true,
        results,
      } as SearchResponse)
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    )
  } catch (error: any) {
    console.error("[pdf-rag] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message ?? "Internal server error",
      },
      { status: 500 }
    )
  }
}

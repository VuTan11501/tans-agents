"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import Markdown from "react-markdown"

interface StoredPDF {
  id: string
  fileName: string
  uploadedAt: string
  chunks: string[]
}

interface SearchResult {
  chunk: string
  relevance: number
}

const STORAGE_KEY = "tans-agents:pdf-docs-v1"

export default function PDFRAGPage() {
  const [pdfs, setPdfs] = useState<StoredPDF[]>([])
  const [uploading, setUploading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setPdfs(JSON.parse(stored))
      } catch {
        console.error("Failed to parse stored PDFs")
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pdfs))
  }, [pdfs])

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files
    if (!files?.length) return

    const file = files[0]
    setUploading(true)
    setUploadError(null)
    setSearchResults([])

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/pdf-rag", {
        method: "POST",
        body: formData,
        headers: {
          "X-Action": "upload",
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Upload failed")
      }

      const newPDF: StoredPDF = {
        id: data.pdfId,
        fileName: file.name,
        uploadedAt: new Date().toLocaleString("vi-VN"),
        chunks: data.chunks || [],
      }

      setPdfs((prev) => [newPDF, ...prev])
      setSelectedPdfId(newPDF.id)

      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (err: any) {
      setUploadError(err?.message ?? "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim() || !selectedPdfId || searching) return

    const selectedPDF = pdfs.find((p) => p.id === selectedPdfId)
    if (!selectedPDF) {
      setSearchError("PDF not found")
      return
    }

    setSearching(true)
    setSearchError(null)
    setSearchResults([])

    try {
      const response = await fetch("/api/pdf-rag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Action": "search",
        },
        body: JSON.stringify({
          query: searchQuery,
          pdfId: selectedPdfId,
          chunks: selectedPDF.chunks,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || "Search failed")
      }

      setSearchResults(data.results || [])
    } catch (err: any) {
      setSearchError(err?.message ?? "Search failed")
    } finally {
      setSearching(false)
    }
  }

  function deletePDF(id: string) {
    setPdfs((prev) => prev.filter((p) => p.id !== id))
    if (selectedPdfId === id) {
      setSelectedPdfId(null)
      setSearchResults([])
    }
  }

  const selectedPDF = pdfs.find((p) => p.id === selectedPdfId)

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <header className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">PDF RAG Search</p>
            <h1 className="text-2xl font-semibold tracking-tight">Upload & Search PDFs</h1>
            <p className="text-sm text-muted-foreground">
              Upload PDF files and search through their content using semantic similarity.
            </p>
          </div>
        </header>

        {/* Upload Section */}
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="space-y-3">
            <h2 className="text-sm font-medium">Upload PDF</h2>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                disabled={uploading}
                className="block flex-1 text-sm file:me-3 file:rounded-lg file:border file:border-input file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-secondary/80 disabled:opacity-50"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                variant="secondary"
              >
                {uploading ? "Uploading..." : "Choose File"}
              </Button>
            </div>
            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
          </div>
        </section>

        {/* PDF List */}
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium">Uploaded PDFs ({pdfs.length})</h2>
          {pdfs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No PDFs uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {pdfs.map((pdf) => (
                <div
                  key={pdf.id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                    selectedPdfId === pdf.id
                      ? "border-ring bg-secondary/50"
                      : "border-input hover:bg-secondary/30"
                  }`}
                >
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setSelectedPdfId(pdf.id)}>
                    <p className="truncate font-medium text-sm">{pdf.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {pdf.chunks.length} chunks • {pdf.uploadedAt}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => deletePDF(pdf.id)}
                    className="ml-2"
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Search Section */}
        {selectedPDF && (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-medium">Search in "{selectedPDF.fileName}"</h2>
            <div className="space-y-3">
              <textarea
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter your search query..."
                className="min-h-[4rem] w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="flex-1"
                >
                  {searching ? "Searching..." : "Search"}
                </Button>
                {searching && (
                  <span className="text-sm text-muted-foreground flex items-center">
                    <span className="inline-block h-3 w-2 animate-pulse rounded-sm bg-muted-foreground me-2" />
                    Searching...
                  </span>
                )}
              </div>
              {searchError && <p className="text-sm text-destructive">{searchError}</p>}
            </div>
          </section>
        )}

        {/* Results Section */}
        {searchResults.length > 0 && (
          <section className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-medium">Search Results ({searchResults.length})</h2>
            <div className="space-y-3">
              {searchResults.map((result, index) => (
                <div key={index} className="rounded-lg border border-input bg-secondary/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Result {index + 1}</span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {(result.relevance * 100).toFixed(1)}% match
                    </span>
                  </div>
                  <div className="prose prose-sm max-w-none text-sm leading-relaxed dark:prose-invert">
                    <Markdown>{result.chunk}</Markdown>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!selectedPDF && pdfs.length > 0 && searchResults.length === 0 && (
          <section className="rounded-lg border border-dashed bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Select a PDF from the list above to start searching.
            </p>
          </section>
        )}
      </div>
    </main>
  )
}
